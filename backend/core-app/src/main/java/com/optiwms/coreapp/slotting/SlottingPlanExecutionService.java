package com.optiwms.coreapp.slotting;

import com.optiwms.coreapp.master.MaterialDefaultLocationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.optiwms.coreapp.operations.StockTransferService;
import com.optiwms.domain.inventory.InventoryItem;
import com.optiwms.domain.operations.StockTransfer;
import com.optiwms.domain.operations.StockTransferLine;
import com.optiwms.coreapp.inventory.InventoryService;
import com.optiwms.infra.master.MaterialEntity;
import com.optiwms.infra.master.MaterialRepository;
import com.optiwms.infra.slotting.SlottingPlanEntity;
import com.optiwms.infra.slotting.SlottingPlanLineEntity;
import com.optiwms.infra.slotting.SlottingPlanReserveLineEntity;
import com.optiwms.infra.slotting.SlottingPlanReserveLineRepository;
import com.optiwms.infra.slotting.SlottingPlanLineRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Applies approved slotting plans via stock transfer jobs instead of teleporting inventory.
 */
@Service
public class SlottingPlanExecutionService {

    private static final Logger log = LoggerFactory.getLogger(SlottingPlanExecutionService.class);

    public record ExecutionResult(
            int transfersCreated,
            UUID transferId,
            String executionStatus,
            int moveLines) {}

    private final MaterialDefaultLocationService defaultLocationService;
    private final StockTransferService stockTransferService;
    private final InventoryService inventoryService;
    private final MaterialRepository materialRepository;
    private final SlottingPlanLineRepository lineRepository;
    private final SlottingPlanReserveLineRepository reserveLineRepository;
    private final DefaultLocationAssignmentIsolation defaultLocationIsolation;

    public SlottingPlanExecutionService(
            MaterialDefaultLocationService defaultLocationService,
            StockTransferService stockTransferService,
            InventoryService inventoryService,
            MaterialRepository materialRepository,
            SlottingPlanLineRepository lineRepository,
            SlottingPlanReserveLineRepository reserveLineRepository,
            DefaultLocationAssignmentIsolation defaultLocationIsolation) {
        this.defaultLocationIsolation = defaultLocationIsolation;
        this.defaultLocationService = defaultLocationService;
        this.stockTransferService = stockTransferService;
        this.inventoryService = inventoryService;
        this.materialRepository = materialRepository;
        this.lineRepository = lineRepository;
        this.reserveLineRepository = reserveLineRepository;
    }

    @Transactional
    public ExecutionResult executeApprovedPlan(SlottingPlanEntity plan, List<SlottingPlanLineEntity> lines) {
        UUID warehouseId = plan.getWarehouseId();
        List<StockTransferLine> transferLines = new ArrayList<>();
        int lineNo = 1;

        for (SlottingPlanLineEntity line : lines) {
            String targetPrimary = resolvePrimary(line);
            if (targetPrimary == null) {
                continue;
            }

            if (!Boolean.TRUE.equals(line.getRelocationFlag())) {
                applyDefaultLocations(line, warehouseId, targetPrimary);
                line.setStatus("APPLIED");
                lineRepository.save(line);
                continue;
            }

            String source = line.getCurrentPrimaryLocationCode();
            if (source == null || source.equalsIgnoreCase(targetPrimary)) {
                applyDefaultLocations(line, warehouseId, targetPrimary);
                line.setStatus("APPLIED");
                lineRepository.save(line);
                continue;
            }

            int moveQty = resolveMoveQuantity(line.getMaterialId(), warehouseId, source);
            if (moveQty <= 0) {
                applyDefaultLocations(line, warehouseId, targetPrimary);
                line.setStatus("APPLIED");
                lineRepository.save(line);
                continue;
            }

            StockTransferLine transferLine = new StockTransferLine();
            transferLine.setLineNumber(lineNo++);
            transferLine.setMaterialId(line.getMaterialId());
            transferLine.setSourceWarehouseId(warehouseId);
            transferLine.setSourceLocationCode(source);
            transferLine.setDestWarehouseId(warehouseId);
            transferLine.setDestLocationCode(targetPrimary);
            transferLine.setRequestedQuantity(moveQty);
            transferLine.setMovedQuantity(0);
            transferLine.setStatus("open");
            transferLine.setPlanningCycleId(plan.getPlanningCycleId());
            transferLine.setSlottingPlanLineId(line.getId());
            transferLine.setNotes("Slotting plan " + plan.getPlanCode() + " relocation");
            transferLines.add(transferLine);

            line.setStatus("PENDING_MOVE");
            lineRepository.save(line);
        }

        if (transferLines.isEmpty()) {
            return new ExecutionResult(0, null, "COMPLETED", 0);
        }

        // One transfer per relocation. A single document bundling every move
        // was one job on the floor for work that is many separate pallet moves,
        // and its header could only name one material, so a 34-move release
        // showed up as a single job labelled with whichever material happened to
        // be first.
        UUID firstTransferId = null;
        int created = 0;

        for (StockTransferLine line : transferLines) {
            StockTransfer transfer = new StockTransfer();
            transfer.setTransferType("slotting_relocation");
            transfer.setPlanningCycleId(plan.getPlanningCycleId());
            transfer.setMaterialId(line.getMaterialId());
            transfer.setSourceWarehouseId(warehouseId);
            transfer.setDestWarehouseId(warehouseId);
            transfer.setQuantity(line.getRequestedQuantity());
            transfer.setStatus("draft");
            transfer.setNotes("slotting_plan_id:" + plan.getId() + " plan:" + plan.getPlanCode());

            // Each document carries exactly its own move, renumbered from one.
            line.setLineNumber(1);
            transfer.setLines(new ArrayList<>(List.of(line)));

            StockTransfer saved = stockTransferService.create(transfer);
            StockTransfer released = stockTransferService.releaseForSlotting(saved.getId());
            if (firstTransferId == null) {
                firstTransferId = released.getId();
            }
            created++;
        }

        return new ExecutionResult(created, firstTransferId, "PENDING_MOVES", transferLines.size());
    }

    /**
     * Writes the plan's destinations onto the material's default locations.
     *
     * <p>A bin already claimed as another material's primary is refused by
     * {@code assignDefaultLocation}. That refusal used to escape here and abort the whole release:
     * one stale default anywhere in the catalogue rolled back every move in the plan, left the plan
     * stuck in SCHEDULED, and produced no transfers -- with the reason visible only in the server
     * log. There are currently 134 such bins from earlier data drift, so this was not a rare edge.
     *
     * <p>A contested default is a bookkeeping conflict, not a reason to cancel physical work. The
     * conflict is recorded on the line and the release continues; the pallet still moves, and the
     * unresolved default surfaces on the line rather than silently in a stack trace.
     */
    private void applyDefaultLocations(SlottingPlanLineEntity line, UUID warehouseId, String targetPrimary) {
        List<String> conflicts = new ArrayList<>();
        assignDefaultTolerantly(line, warehouseId, targetPrimary, 1, conflicts);

        List<SlottingPlanReserveLineEntity> reserves =
                reserveLineRepository.findByPlanLineIdOrderBySequenceNoAsc(line.getId());
        int priority = 2;
        for (SlottingPlanReserveLineEntity reserve : reserves) {
            String reserveCode = reserve.getFinalReserveLocationCode() != null
                    ? reserve.getFinalReserveLocationCode()
                    : reserve.getRecommendedReserveLocationCode();
            if (reserveCode != null) {
                assignDefaultTolerantly(line, warehouseId, reserveCode, priority++, conflicts);
            }
        }

        if (!conflicts.isEmpty()) {
            line.setMoveReason(trimToColumn((line.getMoveReason() == null ? "" : line.getMoveReason() + " ")
                    + "Default location not updated: " + String.join("; ", conflicts)));
            log.warn("Slotting line {} ({}) released with unresolved default locations: {}",
                    line.getId(), line.getMaterialCode(), conflicts);
        }
    }

    private void assignDefaultTolerantly(
            SlottingPlanLineEntity line, UUID warehouseId, String locationCode, int priority, List<String> conflicts) {
        try {
            // Isolated transaction: a rejected bin must not mark this release rollback-only.
            defaultLocationIsolation.assign(
                    line.getMaterialId(), warehouseId, locationCode, priority, line.getMaterialType());
        } catch (RuntimeException conflict) {
            conflicts.add(locationCode + " (" + conflict.getMessage() + ")");
        }
    }

    /** move_reason is a bounded column; a long conflict list must not fail the insert. */
    private String trimToColumn(String value) {
        return value.length() <= 480 ? value : value.substring(0, 477) + "...";
    }

    private String resolvePrimary(SlottingPlanLineEntity line) {
        if (line.getFinalPrimaryLocationCode() != null) {
            return line.getFinalPrimaryLocationCode();
        }
        return line.getRecommendedPrimaryLocationCode();
    }

    private int resolveMoveQuantity(UUID materialId, UUID warehouseId, String locationCode) {
        List<InventoryItem> items = inventoryService.findByMaterialAndWarehouse(materialId, warehouseId);
        int atLocation = items.stream()
                .filter(i -> locationCode.equalsIgnoreCase(i.getLocationCode()))
                .map(InventoryItem::getQuantity)
                .filter(Objects::nonNull)
                .mapToInt(Integer::intValue)
                .sum();
        if (atLocation <= 0) {
            return 0;
        }
        MaterialEntity material = materialRepository.findById(materialId).orElse(null);
        int palletUnits = material != null && material.getPalletSpaces() != null
                ? material.getPalletSpaces().setScale(0, java.math.RoundingMode.CEILING).intValue()
                : atLocation;
        palletUnits = Math.max(palletUnits, 1);
        return Math.min(atLocation, palletUnits);
    }
}
