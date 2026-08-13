package com.optiwms.coreapp.slotting;

import com.optiwms.coreapp.master.MaterialDefaultLocationService;
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

    public SlottingPlanExecutionService(
            MaterialDefaultLocationService defaultLocationService,
            StockTransferService stockTransferService,
            InventoryService inventoryService,
            MaterialRepository materialRepository,
            SlottingPlanLineRepository lineRepository,
            SlottingPlanReserveLineRepository reserveLineRepository) {
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

        StockTransfer transfer = new StockTransfer();
        transfer.setTransferType("slotting_relocation");
        transfer.setPlanningCycleId(plan.getPlanningCycleId());
        transfer.setMaterialId(transferLines.get(0).getMaterialId());
        transfer.setSourceWarehouseId(warehouseId);
        transfer.setDestWarehouseId(warehouseId);
        transfer.setQuantity(transferLines.stream().mapToInt(StockTransferLine::getRequestedQuantity).sum());
        transfer.setStatus("draft");
        transfer.setNotes("slotting_plan_id:" + plan.getId() + " plan:" + plan.getPlanCode());
        transfer.setLines(transferLines);

        StockTransfer created = stockTransferService.create(transfer);
        StockTransfer released = stockTransferService.releaseForSlotting(created.getId());

        return new ExecutionResult(1, released.getId(), "PENDING_MOVES", transferLines.size());
    }

    private void applyDefaultLocations(SlottingPlanLineEntity line, UUID warehouseId, String targetPrimary) {
        defaultLocationService.assignDefaultLocation(
                line.getMaterialId(), warehouseId, targetPrimary, 1, line.getMaterialType(), false);
        List<SlottingPlanReserveLineEntity> reserves =
                reserveLineRepository.findByPlanLineIdOrderBySequenceNoAsc(line.getId());
        int priority = 2;
        for (SlottingPlanReserveLineEntity reserve : reserves) {
            String reserveCode = reserve.getFinalReserveLocationCode() != null
                    ? reserve.getFinalReserveLocationCode()
                    : reserve.getRecommendedReserveLocationCode();
            if (reserveCode != null) {
                defaultLocationService.assignDefaultLocation(
                        line.getMaterialId(), warehouseId, reserveCode, priority++, line.getMaterialType(), false);
            }
        }
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
