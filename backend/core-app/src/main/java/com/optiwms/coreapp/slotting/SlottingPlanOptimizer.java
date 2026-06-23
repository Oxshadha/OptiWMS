package com.optiwms.coreapp.slotting;

import com.optiwms.coreapp.master.StockPlacementPlanner;
import com.optiwms.infra.master.LocationEntity;
import com.optiwms.infra.master.MaterialEntity;
import com.optiwms.infra.slotting.MaterialIssueStatsRollupEntity;
import com.optiwms.infra.slotting.SlottingPlanLineEntity;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Within-aisle heuristic: pick-face primary + reserve overflow, gain-ranked relocation budget.
 */
public class SlottingPlanOptimizer {

    private static final double RELOCATION_COST = 15.0;
    private static final Set<String> RM_AREAS = Set.of("RM", "RAW", "RAW_MATERIAL");
    private static final Set<String> PM_AREAS = Set.of("PM", "PACK", "PACKING", "PACKAGING");
    private static final Set<String> FG_AREAS = Set.of("FG", "FINISHED", "PRODUCT", "A", "B", "C", "D");

    private final com.optiwms.coreapp.master.HandlingUnitCapacityService capacityService;
    private final com.optiwms.coreapp.master.StockPlacementPlanner placementPlanner;

    public SlottingPlanOptimizer() {
        this(null, null);
    }

    public SlottingPlanOptimizer(
            com.optiwms.coreapp.master.HandlingUnitCapacityService capacityService,
            com.optiwms.coreapp.master.StockPlacementPlanner placementPlanner) {
        this.capacityService = capacityService;
        this.placementPlanner = placementPlanner;
    }

    public OptimizerResult optimize(OptimizerInput input) {
        List<LocationEntity> eligible = input.locations().stream()
                .filter(this::isStorageLocation)
                .filter(loc -> matchesMaterialArea(loc, input.materialTypeFilter()))
                .sorted(Comparator
                        .comparingInt((LocationEntity l) -> pickFaceScore(l, true))
                        .thenComparing(l -> distanceToDispatch(l, input.dispatchAnchor())))
                .toList();

        List<LocationEntity> reservePool = input.locations().stream()
                .filter(this::isStorageLocation)
                .filter(loc -> matchesMaterialArea(loc, input.materialTypeFilter()))
                .sorted(Comparator
                        .comparingInt((LocationEntity l) -> pickFaceScore(l, false))
                        .reversed()
                        .thenComparing(l -> distanceToDispatch(l, input.dispatchAnchor()), Comparator.reverseOrder()))
                .toList();

        Set<String> assignedPrimary = new HashSet<>();
        Map<UUID, ProposedAssignment> idealByMaterial = new LinkedHashMap<>();

        List<MaterialCandidate> sortedMaterials = input.materials().stream()
                .sorted(Comparator
                        .comparingInt((MaterialCandidate m) -> amalgamatedPriority(m.amalgamatedClass()))
                        .thenComparing(Comparator.comparingLong(MaterialCandidate::issueVolume).reversed()))
                .toList();

        for (MaterialCandidate material : sortedMaterials) {
            if (input.lockedMaterialIds().contains(material.materialId())) {
                continue;
            }
            String amalgamated = material.amalgamatedClass();
            LocationEntity primary = findBestLocation(
                    eligible, amalgamated, assignedPrimary, material, true, input.dispatchAnchor());
            if (primary == null) {
                primary = findBestLocation(
                        eligible, amalgamated, assignedPrimary, material, false, input.dispatchAnchor());
            }
            if (primary != null) {
                assignedPrimary.add(primary.getLocationCode());
            }

            int maxPp = computeMaxStockPp(material);
            int activePp = computeActivePickPp(material, maxPp);
            int reservePp = Math.max(0, maxPp - activePp);

            List<ReserveSlot> reserves = new ArrayList<>();
            if (reservePp > 0) {
                String anchorCode = primary != null
                        ? primary.getLocationCode()
                        : input.incumbentPrimary().get(material.materialId());
                if (placementPlanner != null && input.warehouseId() != null) {
                    Set<String> exclude = new HashSet<>(assignedPrimary);
                    int unitsPerPallet = material.palletSpaces() != null
                            ? material.palletSpaces().setScale(0, RoundingMode.CEILING).intValue()
                            : 1;
                    int reserveQty = Math.max(reservePp * Math.max(unitsPerPallet, 1), reservePp);
                    StockPlacementPlanner.PlacementPlan placementPlan = placementPlanner.planPlacement(
                            input.warehouseId(),
                            material.materialId(),
                            reserveQty,
                            anchorCode,
                            exclude);
                    for (StockPlacementPlanner.PlacementLine line : placementPlan.lines()) {
                        reserves.add(new ReserveSlot(line.locationCode(), line.palletCount(), "reserve_cluster"));
                        assignedPrimary.add(line.locationCode());
                    }
                }
                if (reserves.isEmpty()) {
                    Set<String> usedReserve = new HashSet<>();
                    LocationEntity reserveLoc = findBestLocation(
                            reservePool, amalgamated, usedReserve, material, false, input.dispatchAnchor());
                    if (reserveLoc != null) {
                        reserves.add(new ReserveSlot(reserveLoc.getLocationCode(), reservePp, "deep_reserve"));
                    }
                }
            }

            String incumbent = input.incumbentPrimary().get(material.materialId());
            String recommended = primary != null ? primary.getLocationCode() : incumbent;

            double incumbentDist = distanceForCode(incumbent, input.locationIndex(), input.dispatchAnchor());
            double recommendedDist = primary != null
                    ? distanceToDispatch(primary, input.dispatchAnchor())
                    : incumbentDist;
            double distanceSaved = Math.max(0, incumbentDist - recommendedDist);

            String incumbentZone = zoneLabel(incumbent, input.locationIndex());
            String recommendedZone = primary != null
                    ? Optional.ofNullable(primary.getAmalgamatedClass()).orElse(zoneFromCode(primary.getLocationCode()))
                    : incumbentZone;
            String zoneUpgrade = formatZoneUpgrade(incumbentZone, recommendedZone);

            double gain = computeGainScore(distanceSaved, zoneUpgrade, material, incumbent, recommended);

            idealByMaterial.put(material.materialId(), new ProposedAssignment(
                    material,
                    incumbent,
                    recommended,
                    primary != null ? primary.getId() : null,
                    activePp,
                    reservePp,
                    maxPp,
                    reserves,
                    distanceSaved,
                    zoneUpgrade,
                    gain,
                    buildMoveReason(material, recommended, incumbent, zoneUpgrade)
            ));
        }

        applyLockedOverrides(idealByMaterial, input.existingLines());
        applyRelocationBudget(idealByMaterial, input.relocationBudgetPct());

        List<OptimizedLine> lines = new ArrayList<>();
        double totalDistanceSaved = 0;
        int movesProposed = 0;
        int movesApplied = 0;

        for (ProposedAssignment assignment : idealByMaterial.values()) {
            boolean move = assignment.relocationApplied();
            if (assignment.recommendedPrimary() != null
                    && assignment.incumbentPrimary() != null
                    && !assignment.recommendedPrimary().equals(assignment.incumbentPrimary())) {
                movesProposed++;
            }
            if (move) {
                movesApplied++;
                totalDistanceSaved += assignment.distanceSavedMeters();
            }
            lines.add(toOptimizedLine(assignment));
        }

        return new OptimizerResult(lines, movesProposed, movesApplied, totalDistanceSaved);
    }

    private void applyLockedOverrides(
            Map<UUID, ProposedAssignment> ideal,
            List<SlottingPlanLineEntity> existingLines) {
        for (SlottingPlanLineEntity line : existingLines) {
            if (!Boolean.TRUE.equals(line.getLocked()) && !Boolean.TRUE.equals(line.getManagerOverride())) {
                continue;
            }
            String forced = line.getFinalPrimaryLocationCode() != null
                    ? line.getFinalPrimaryLocationCode()
                    : line.getRecommendedPrimaryLocationCode();
            ProposedAssignment current = ideal.get(line.getMaterialId());
            if (current == null || forced == null) {
                continue;
            }
            ideal.put(line.getMaterialId(), new ProposedAssignment(
                    current.material(),
                    current.incumbentPrimary(),
                    forced,
                    current.recommendedPrimaryLocationId(),
                    current.activePickPp(),
                    current.requiredReservePp(),
                    current.maxStockPp(),
                    current.reserveSlots(),
                    current.distanceSavedMeters(),
                    current.zoneUpgrade(),
                    current.gainScore(),
                    "Manager override — locked line",
                    false,
                    "OVERRIDDEN"
            ));
        }
    }

    private void applyRelocationBudget(Map<UUID, ProposedAssignment> ideal, BigDecimal budgetPct) {
        double pct = budgetPct != null ? budgetPct.doubleValue() : 30.0;
        int budget = (int) Math.floor(ideal.size() * (pct / 100.0));

        List<ProposedAssignment> movable = ideal.values().stream()
                .filter(a -> a.incumbentPrimary() != null
                        && a.recommendedPrimary() != null
                        && !a.incumbentPrimary().equals(a.recommendedPrimary()))
                .sorted(Comparator.comparingDouble(ProposedAssignment::gainScore).reversed())
                .toList();

        Set<UUID> approved = new HashSet<>();
        for (int i = 0; i < Math.min(budget, movable.size()); i++) {
            approved.add(movable.get(i).material().materialId());
        }

        Map<UUID, ProposedAssignment> updated = new LinkedHashMap<>();
        for (Map.Entry<UUID, ProposedAssignment> entry : ideal.entrySet()) {
            ProposedAssignment a = entry.getValue();
            if ("OVERRIDDEN".equals(a.status())) {
                updated.put(entry.getKey(), a);
                continue;
            }
            boolean shouldMove = approved.contains(entry.getKey());
            if (shouldMove) {
                updated.put(entry.getKey(), new ProposedAssignment(
                        a.material(),
                        a.incumbentPrimary(),
                        a.recommendedPrimary(),
                        a.recommendedPrimaryLocationId(),
                        a.activePickPp(),
                        a.requiredReservePp(),
                        a.maxStockPp(),
                        a.reserveSlots(),
                        a.distanceSavedMeters(),
                        a.zoneUpgrade(),
                        a.gainScore(),
                        a.moveReason(),
                        true,
                        "PROPOSED"));
            } else if (a.incumbentPrimary() != null
                    && a.recommendedPrimary() != null
                    && !a.incumbentPrimary().equals(a.recommendedPrimary())) {
                updated.put(entry.getKey(), new ProposedAssignment(
                        a.material(),
                        a.incumbentPrimary(),
                        a.incumbentPrimary(),
                        a.recommendedPrimaryLocationId(),
                        a.activePickPp(),
                        a.requiredReservePp(),
                        a.maxStockPp(),
                        a.reserveSlots(),
                        0.0,
                        a.zoneUpgrade(),
                        a.gainScore(),
                        "Marginal gain — relocation budget exhausted",
                        false,
                        "KEPT_INCUMBENT"
                ));
            } else {
                updated.put(entry.getKey(), new ProposedAssignment(
                        a.material(),
                        a.incumbentPrimary(),
                        a.recommendedPrimary(),
                        a.recommendedPrimaryLocationId(),
                        a.activePickPp(),
                        a.requiredReservePp(),
                        a.maxStockPp(),
                        a.reserveSlots(),
                        a.distanceSavedMeters(),
                        a.zoneUpgrade(),
                        a.gainScore(),
                        a.moveReason(),
                        false,
                        "PROPOSED"
                ));
            }
        }
        ideal.clear();
        ideal.putAll(updated);
    }

    private OptimizedLine toOptimizedLine(ProposedAssignment a) {
        String finalLoc = a.relocationApplied()
                ? a.recommendedPrimary()
                : (a.incumbentPrimary() != null ? a.incumbentPrimary() : a.recommendedPrimary());
        boolean relocationFlag = a.incumbentPrimary() != null
                && finalLoc != null
                && !a.incumbentPrimary().equals(finalLoc);

        return new OptimizedLine(
                a.material(),
                a.incumbentPrimary(),
                a.recommendedPrimary(),
                a.recommendedPrimaryLocationId(),
                finalLoc,
                a.activePickPp(),
                a.requiredReservePp(),
                a.maxStockPp(),
                a.reserveSlots(),
                BigDecimal.valueOf(a.distanceSavedMeters()).setScale(2, RoundingMode.HALF_UP),
                a.zoneUpgrade(),
                a.moveReason(),
                BigDecimal.valueOf(a.gainScore()).setScale(4, RoundingMode.HALF_UP),
                a.relocationApplied(),
                relocationFlag,
                a.status()
        );
    }

    private LocationEntity findBestLocation(
            List<LocationEntity> pool,
            String amalgamated,
            Set<String> used,
            MaterialCandidate material,
            boolean pickFace,
            double[] anchor) {

        for (LocationEntity loc : pool) {
            if (used.contains(loc.getLocationCode())) {
                continue;
            }
            if (!isCompatibleAmalgamated(loc.getAmalgamatedClass(), amalgamated)) {
                continue;
            }
            if (!supportsPhysicalFit(loc, material)) {
                continue;
            }
            if (pickFace && pickFaceScore(loc, true) > 2) {
                continue;
            }
            return loc;
        }
        return null;
    }

    private boolean isStorageLocation(LocationEntity loc) {
        if (!Boolean.TRUE.equals(loc.getIsActive())) {
            return false;
        }
        String status = loc.getRackStatus() != null ? loc.getRackStatus().toLowerCase() : "active";
        if (Set.of("reserved", "maintenance", "out_of_service").contains(status)) {
            return false;
        }
        String type = loc.getLocationType() != null ? loc.getLocationType().toLowerCase() : "";
        return type.contains("storage") || "storage".equals(type) || loc.getZoneType() != null;
    }

    private boolean matchesMaterialArea(LocationEntity loc, String materialTypeFilter) {
        if (materialTypeFilter == null || materialTypeFilter.isBlank()) {
            return true;
        }
        String area = loc.getArea() != null ? loc.getArea().toUpperCase() : "";
        return switch (materialTypeFilter) {
            case "raw_material" -> RM_AREAS.stream().anyMatch(area::contains) || area.startsWith("R");
            case "packaging_material" -> PM_AREAS.stream().anyMatch(area::contains) || area.contains("P");
            case "product" -> FG_AREAS.stream().anyMatch(a -> area.contains(a) || area.equals(a));
            default -> true;
        };
    }

    private boolean isCompatibleAmalgamated(String locationClass, String skuClass) {
        if (locationClass == null || locationClass.isBlank()) {
            return true;
        }
        if (skuClass == null || skuClass.isBlank()) {
            return true;
        }
        if (locationClass.length() < 1 || skuClass.length() < 1) {
            return true;
        }
        return locationClass.equals(skuClass)
                || locationClass.charAt(0) == skuClass.charAt(0);
    }

    private boolean supportsPhysicalFit(LocationEntity loc, MaterialCandidate material) {
        if (!supportsWeight(loc, material)) {
            return false;
        }
        if (!supportsVolume(loc, material)) {
            return false;
        }
        return supportsPalletCapacity(loc, material);
    }

    private boolean supportsWeight(LocationEntity loc, MaterialCandidate material) {
        BigDecimal palletWeight = resolvePalletWeightKg(material);
        if (palletWeight == null || palletWeight.compareTo(BigDecimal.ZERO) <= 0) {
            return loc.getMaxWeightKg() != null || material.weightKg() == null;
        }
        if (loc.getMaxWeightKg() == null) {
            return true;
        }
        return palletWeight.compareTo(loc.getMaxWeightKg()) <= 0;
    }

    private BigDecimal resolvePalletWeightKg(MaterialCandidate material) {
        if (material.maxPalletWeightKg() != null
                && material.maxPalletWeightKg().compareTo(BigDecimal.ZERO) > 0) {
            return material.maxPalletWeightKg();
        }
        if (material.weightKg() != null
                && material.palletSpaces() != null
                && material.palletSpaces().compareTo(BigDecimal.ZERO) > 0) {
            return material.weightKg().multiply(material.palletSpaces());
        }
        return material.weightKg();
    }

    private boolean supportsVolume(LocationEntity loc, MaterialCandidate material) {
        if (material.volumeCm3() == null || loc.getMaxVolumeCm3() == null) {
            return true;
        }
        return material.volumeCm3().doubleValue() <= loc.getMaxVolumeCm3().doubleValue();
    }

    private boolean supportsPalletCapacity(LocationEntity loc, MaterialCandidate material) {
        int activePp = computeActivePickPp(material, computeMaxStockPp(material));
        Integer maxPallet = loc.getMaxPalletCapacity();
        if (maxPallet != null && maxPallet > 0 && activePp > maxPallet) {
            return false;
        }
        if (loc.getCapacity() != null && loc.getCapacity().doubleValue() > 0
                && material.palletSpaces() != null
                && material.palletSpaces().doubleValue() > loc.getCapacity().doubleValue()) {
            return false;
        }
        return true;
    }

    private int pickFaceScore(LocationEntity loc, boolean preferPickFace) {
        int level = loc.getLevelNumber() != null ? loc.getLevelNumber() : 3;
        int access = loc.getAccessibilityRating() != null ? loc.getAccessibilityRating() : 3;
        if (preferPickFace) {
            return level + (5 - access);
        }
        return (5 - level) + access;
    }

    private double distanceToDispatch(LocationEntity loc, double[] anchor) {
        double x = loc.getCoordinateX() != null ? loc.getCoordinateX().doubleValue() : 0;
        double y = loc.getCoordinateY() != null ? loc.getCoordinateY().doubleValue() : 0;
        double ax = anchor[0];
        double ay = anchor[1];
        return Math.hypot(x - ax, y - ay);
    }

    private double distanceForCode(String code, Map<String, LocationEntity> index, double[] anchor) {
        if (code == null) {
            return 0;
        }
        LocationEntity loc = index.get(code);
        return loc != null ? distanceToDispatch(loc, anchor) : 0;
    }

    private int computeMaxStockPp(MaterialCandidate m) {
        long monthly = Math.max(1, m.issueVolume() / 12);
        int weeks = "packaging_material".equals(m.materialType()) ? 2 : 4;
        return (int) Math.max(1, Math.ceil(monthly * weeks / 4.0));
    }

    private int computeActivePickPp(MaterialCandidate m, int maxPp) {
        int weeks = "packaging_material".equals(m.materialType()) ? 2 : 2;
        long monthly = Math.max(1, m.issueVolume() / 12);
        int active = (int) Math.max(1, Math.ceil(monthly * weeks / 4.0));
        return Math.min(active, maxPp);
    }

    private double computeGainScore(
            double distanceSaved, String zoneUpgrade, MaterialCandidate m,
            String incumbent, String recommended) {
        double zoneBonus = zoneUpgrade != null && zoneUpgrade.contains("→") ? 10.0 : 0;
        double freqBonus = "F".equals(m.fmsClass()) ? 5.0 : ("M".equals(m.fmsClass()) ? 2.0 : 0);
        double movePenalty = (incumbent != null && recommended != null && !incumbent.equals(recommended))
                ? RELOCATION_COST : 0;
        return distanceSaved * 0.5 + zoneBonus + freqBonus - movePenalty;
    }

    private String buildMoveReason(MaterialCandidate m, String recommended, String incumbent, String zoneUpgrade) {
        if (incumbent != null && incumbent.equals(recommended)) {
            return "Incumbent location optimal for " + m.amalgamatedClass();
        }
        if ("AF".equals(m.amalgamatedClass()) || "AM".equals(m.amalgamatedClass())) {
            return "Fast/high-volume SKU — golden pick-face slot";
        }
        if (zoneUpgrade != null && zoneUpgrade.contains("→")) {
            return "Zone upgrade: " + zoneUpgrade;
        }
        return "Within-aisle heuristic assignment for " + m.amalgamatedClass();
    }

    private String formatZoneUpgrade(String from, String to) {
        if (from == null && to == null) return null;
        if (Objects.equals(from, to)) return null;
        return (from != null ? from : "?") + " → " + (to != null ? to : "?");
    }

    private String zoneLabel(String code, Map<String, LocationEntity> index) {
        if (code == null) return null;
        LocationEntity loc = index.get(code);
        if (loc != null && loc.getAmalgamatedClass() != null) {
            return loc.getAmalgamatedClass();
        }
        return zoneFromCode(code);
    }

    private String zoneFromCode(String code) {
        if (code == null || code.isEmpty()) return "?";
        return code.length() >= 2 ? code.substring(0, 2) : code.substring(0, 1);
    }

    private int amalgamatedPriority(String amalgamated) {
        return switch (amalgamated != null ? amalgamated : "CS") {
            case "AF" -> 1;
            case "AM" -> 2;
            case "AS" -> 3;
            case "BF" -> 4;
            case "BM" -> 5;
            case "BS" -> 6;
            case "CF" -> 7;
            case "CM" -> 8;
            default -> 9;
        };
    }

    public record MaterialCandidate(
            UUID materialId,
            String materialCode,
            String materialType,
            String amalgamatedClass,
            String abcClass,
            String fmsClass,
            long issueVolume,
            int issueCount,
            BigDecimal weightKg,
            BigDecimal volumeCm3,
            BigDecimal palletSpaces,
            BigDecimal maxPalletWeightKg) {}

    public record ReserveSlot(String locationCode, int palletPositions, String zoneHint) {}

    public record OptimizerInput(
            String materialTypeFilter,
            List<MaterialCandidate> materials,
            List<LocationEntity> locations,
            Map<String, LocationEntity> locationIndex,
            Map<UUID, String> incumbentPrimary,
            Set<UUID> lockedMaterialIds,
            List<SlottingPlanLineEntity> existingLines,
            BigDecimal relocationBudgetPct,
            double[] dispatchAnchor,
            UUID warehouseId) {}

    public record OptimizedLine(
            MaterialCandidate material,
            String currentPrimary,
            String recommendedPrimary,
            UUID recommendedPrimaryLocationId,
            String finalPrimary,
            int activePickPp,
            int requiredReservePp,
            int maxStockPp,
            List<ReserveSlot> reserveSlots,
            BigDecimal distanceSavedMeters,
            String zoneUpgrade,
            String moveReason,
            BigDecimal gainScore,
            boolean relocationApplied,
            boolean relocationFlag,
            String status) {}

    public record OptimizerResult(
            List<OptimizedLine> lines,
            int movesProposed,
            int movesApplied,
            double totalDistanceSaved) {}

    private record ProposedAssignment(
            MaterialCandidate material,
            String incumbentPrimary,
            String recommendedPrimary,
            UUID recommendedPrimaryLocationId,
            int activePickPp,
            int requiredReservePp,
            int maxStockPp,
            List<ReserveSlot> reserveSlots,
            double distanceSavedMeters,
            String zoneUpgrade,
            double gainScore,
            String moveReason,
            boolean relocationApplied,
            String status) {

        ProposedAssignment(
                MaterialCandidate material,
                String incumbentPrimary,
                String recommendedPrimary,
                UUID recommendedPrimaryLocationId,
                int activePickPp,
                int requiredReservePp,
                int maxStockPp,
                List<ReserveSlot> reserveSlots,
                double distanceSavedMeters,
                String zoneUpgrade,
                double gainScore,
                String moveReason) {
            this(material, incumbentPrimary, recommendedPrimary, recommendedPrimaryLocationId,
                    activePickPp, requiredReservePp, maxStockPp, reserveSlots,
                    distanceSavedMeters, zoneUpgrade, gainScore, moveReason,
                    incumbentPrimary == null || !incumbentPrimary.equals(recommendedPrimary),
                    incumbentPrimary == null || !incumbentPrimary.equals(recommendedPrimary)
                            ? "PROPOSED" : "PROPOSED");
        }
    }
}
