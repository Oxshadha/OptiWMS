package com.optiwms.coreapp.slotting;

import com.optiwms.infra.inventory.InventoryItemEntity;
import com.optiwms.infra.inventory.InventoryItemRepository;
import com.optiwms.infra.master.MaterialDefaultLocationEntity;
import com.optiwms.infra.master.MaterialDefaultLocationRepository;
import com.optiwms.infra.operations.StockTransferLineEntity;
import com.optiwms.infra.operations.StockTransferLineRepository;
import com.optiwms.infra.slotting.SlottingPlanEntity;
import com.optiwms.infra.slotting.SlottingPlanLineEntity;
import com.optiwms.infra.slotting.SlottingPlanLineRepository;
import com.optiwms.infra.slotting.SlottingPlanRepository;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class WarehouseIntelligenceSnapshotService {

    public record RackPendingMoves(String rackId, int pendingMoveCount) {}

    public record PlanVsActual(String materialCode, String plannedLocation, String actualLocation) {}

    public record WarehouseIntelligenceSnapshot(
            UUID warehouseId,
            String activePlanCode,
            String executionStatus,
            int openTransferLines,
            int planMismatchCount,
            List<RackPendingMoves> pendingMovesByRack,
            List<PlanVsActual> planVsActual,
            List<DemandSpacePlanningService.DemandProfile> demandInsights) {}

    private final SlottingPlanRepository planRepository;
    private final SlottingPlanLineRepository lineRepository;
    private final StockTransferLineRepository transferLineRepository;
    private final InventoryItemRepository inventoryRepository;
    private final MaterialDefaultLocationRepository defaultLocationRepository;
    private final DemandSpacePlanningService demandSpacePlanningService;

    public WarehouseIntelligenceSnapshotService(
            SlottingPlanRepository planRepository,
            SlottingPlanLineRepository lineRepository,
            StockTransferLineRepository transferLineRepository,
            InventoryItemRepository inventoryRepository,
            MaterialDefaultLocationRepository defaultLocationRepository,
            DemandSpacePlanningService demandSpacePlanningService) {
        this.planRepository = planRepository;
        this.lineRepository = lineRepository;
        this.transferLineRepository = transferLineRepository;
        this.inventoryRepository = inventoryRepository;
        this.defaultLocationRepository = defaultLocationRepository;
        this.demandSpacePlanningService = demandSpacePlanningService;
    }

    public WarehouseIntelligenceSnapshot build(UUID warehouseId) {
        Optional<SlottingPlanEntity> activePlan = planRepository
                .findFirstByWarehouseIdAndStatusOrderByApprovedAtDesc(warehouseId, "ACTIVE");

        List<String> openStatuses = List.of("open", "in_progress", "partial");
        List<StockTransferLineEntity> openLines = transferLineRepository.findByStatusIn(openStatuses).stream()
                .filter(line -> warehouseId.equals(line.getSourceWarehouseId()))
                .toList();

        Map<String, Integer> pendingByRack = new HashMap<>();
        for (StockTransferLineEntity line : openLines) {
            String rack = deriveRackId(line.getDestLocationCode());
            if (rack != null) {
                pendingByRack.merge(rack, 1, Integer::sum);
            }
            String sourceRack = deriveRackId(line.getSourceLocationCode());
            if (sourceRack != null) {
                pendingByRack.merge(sourceRack, 1, Integer::sum);
            }
        }

        List<PlanVsActual> mismatches = new ArrayList<>();
        String planCode = null;
        String executionStatus = "NONE";
        if (activePlan.isPresent()) {
            SlottingPlanEntity plan = activePlan.get();
            planCode = plan.getPlanCode();
            executionStatus = plan.getExecutionStatus() != null ? plan.getExecutionStatus() : "NONE";
            List<SlottingPlanLineEntity> planLines = lineRepository.findByPlanIdOrderByMaterialCodeAsc(plan.getId());
            Map<UUID, String> actualPrimary = loadActualPrimary(warehouseId);
            for (SlottingPlanLineEntity line : planLines) {
                String planned = line.getFinalPrimaryLocationCode() != null
                        ? line.getFinalPrimaryLocationCode()
                        : line.getRecommendedPrimaryLocationCode();
                String actual = actualPrimary.get(line.getMaterialId());
                if (planned != null && actual != null && !planned.equalsIgnoreCase(actual)) {
                    mismatches.add(new PlanVsActual(line.getMaterialCode(), planned, actual));
                }
            }
        }

        List<RackPendingMoves> rackMoves = pendingByRack.entrySet().stream()
                .map(e -> new RackPendingMoves(e.getKey(), e.getValue()))
                .sorted(Comparator.comparingInt(RackPendingMoves::pendingMoveCount).reversed())
                .toList();

        List<DemandSpacePlanningService.DemandProfile> insights =
                demandSpacePlanningService.listInsights(warehouseId).stream().limit(25).toList();

        return new WarehouseIntelligenceSnapshot(
                warehouseId,
                planCode,
                executionStatus,
                openLines.size(),
                mismatches.size(),
                rackMoves,
                mismatches.stream().limit(20).toList(),
                insights);
    }

    private Map<UUID, String> loadActualPrimary(UUID warehouseId) {
        Map<UUID, String> fromInventory = inventoryRepository.findByWarehouseId(warehouseId).stream()
                .filter(i -> i.getQuantity() != null && i.getQuantity() > 0)
                .filter(i -> i.getLocationCode() != null)
                .collect(Collectors.toMap(
                        InventoryItemEntity::getMaterialId,
                        InventoryItemEntity::getLocationCode,
                        (a, b) -> a));

        for (MaterialDefaultLocationEntity d : defaultLocationRepository.findByWarehouseId(warehouseId)) {
            if (d.getPriority() != null && d.getPriority() == 1 && !fromInventory.containsKey(d.getMaterialId())) {
                fromInventory.put(d.getMaterialId(), d.getLocationCode());
            }
        }
        return fromInventory;
    }

    private String deriveRackId(String locationCode) {
        if (locationCode == null || locationCode.isBlank()) {
            return null;
        }
        String[] parts = locationCode.split("-");
        if (parts.length >= 2) {
            return parts[0] + "-" + parts[1];
        }
        return locationCode;
    }
}
