package com.optiwms.coreapi.slotting;

import com.optiwms.coreapp.slotting.DemandSpacePlanningService;
import com.optiwms.coreapp.slotting.WarehouseIntelligenceSnapshotService;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/slotting/intelligence")
public class SlottingIntelligenceController {

    private final WarehouseIntelligenceSnapshotService snapshotService;
    private final DemandSpacePlanningService demandSpacePlanningService;

    public SlottingIntelligenceController(
            WarehouseIntelligenceSnapshotService snapshotService,
            DemandSpacePlanningService demandSpacePlanningService) {
        this.snapshotService = snapshotService;
        this.demandSpacePlanningService = demandSpacePlanningService;
    }

    @GetMapping("/snapshot")
    public IntelligenceSnapshotDto snapshot(@RequestParam UUID warehouseId) {
        WarehouseIntelligenceSnapshotService.WarehouseIntelligenceSnapshot snap = snapshotService.build(warehouseId);
        return new IntelligenceSnapshotDto(
                snap.warehouseId().toString(),
                snap.activePlanCode(),
                snap.executionStatus(),
                snap.openTransferLines(),
                snap.planMismatchCount(),
                snap.pendingMovesByRack().stream()
                        .map(r -> new RackPendingMovesDto(r.rackId(), r.pendingMoveCount()))
                        .toList(),
                snap.planVsActual().stream()
                        .map(p -> new PlanVsActualDto(p.materialCode(), p.plannedLocation(), p.actualLocation()))
                        .toList(),
                snap.demandInsights().stream().map(this::toInsight).toList());
    }

    @GetMapping("/demand-insights")
    public List<DemandInsightDto> demandInsights(@RequestParam UUID warehouseId) {
        return demandSpacePlanningService.listInsights(warehouseId).stream()
                .map(this::toInsight)
                .toList();
    }

    private DemandInsightDto toInsight(DemandSpacePlanningService.DemandProfile profile) {
        return new DemandInsightDto(
                profile.materialId().toString(),
                profile.materialCode(),
                profile.demandTrend().name(),
                profile.forecastP50Units(),
                profile.forecastP90Units(),
                profile.currentBinCount(),
                profile.requiredPalletPositions(),
                profile.stockoutRiskScore(),
                profile.reclaimablePositions(),
                profile.confidencePct(),
                profile.evidenceStatus(),
                profile.rationale());
    }

    public record IntelligenceSnapshotDto(
            String warehouseId,
            String activePlanCode,
            String executionStatus,
            int openTransferLines,
            int planMismatchCount,
            List<RackPendingMovesDto> pendingMovesByRack,
            List<PlanVsActualDto> planVsActual,
            List<DemandInsightDto> demandInsights) {}

    public record RackPendingMovesDto(String rackId, int pendingMoveCount) {}

    public record PlanVsActualDto(String materialCode, String plannedLocation, String actualLocation) {}

    public record DemandInsightDto(
            String materialId,
            String materialCode,
            String trend,
            BigDecimal forecastP50,
            BigDecimal forecastP90,
            int currentBins,
            int recommendedBins,
            double stockoutRisk,
            int reclaimableBins,
            int confidencePct,
            String evidenceStatus,
            String rationale) {}
}
