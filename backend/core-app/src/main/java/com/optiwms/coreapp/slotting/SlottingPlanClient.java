package com.optiwms.coreapp.slotting;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import com.optiwms.infra.master.LocationEntity;
import com.optiwms.infra.slotting.SlottingPlanLineEntity;

import java.math.BigDecimal;
import java.util.*;

/**
 * Calls the Python slotting-service ({@code POST /api/v1/slotting/plan/optimize}).
 * Used for optional A-class MILP refinement when the Docker AI service is running.
 */
@Component
public class SlottingPlanClient {

    private static final Logger log = LoggerFactory.getLogger(SlottingPlanClient.class);

    private final RestTemplate restTemplate;

    @Value("${ai.services.slotting-base-url:http://localhost:8093}")
    private String slottingBaseUrl;

    @Value("${ai.services.slotting-enabled:false}")
    private boolean slottingEnabled;

    @Value("${ai.services.auth-token:}")
    private String authToken;

    public SlottingPlanClient(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public boolean isEnabled() {
        return slottingEnabled;
    }

    public boolean isHealthy() {
        if (!slottingEnabled) {
            return false;
        }
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> body = restTemplate.getForObject(
                    slottingBaseUrl + "/health", Map.class);
            return body != null && "ok".equalsIgnoreCase(String.valueOf(body.get("status")));
        } catch (Exception e) {
            log.debug("Slotting service health check failed: {}", e.getMessage());
            return false;
        }
    }

    public Optional<PlanOptimizeResponse> optimize(PlanOptimizeRequest request) {
        if (!slottingEnabled) {
            return Optional.empty();
        }
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            if (authToken != null && !authToken.isBlank()) {
                headers.setBearerAuth(authToken);
            }
            HttpEntity<PlanOptimizeRequest> entity = new HttpEntity<>(request, headers);
            PlanOptimizeResponse response = restTemplate.postForObject(
                    slottingBaseUrl + "/api/v1/slotting/plan/optimize",
                    entity,
                    PlanOptimizeResponse.class);
            if (response == null || response.assignments == null) {
                return Optional.empty();
            }
            return Optional.of(response);
        } catch (RestClientException e) {
            log.warn("Slotting service plan/optimize failed, using Java heuristic only: {}", e.getMessage());
            return Optional.empty();
        }
    }

    public static PlanOptimizeRequest buildRequest(
            UUID warehouseId,
            BigDecimal relocationBudgetPct,
            boolean useMilpAClass,
            List<SlottingPlanOptimizer.MaterialCandidate> materials,
            List<LocationEntity> locations,
            Map<UUID, String> incumbentPrimary,
            Set<UUID> lockedMaterialIds) {
        return buildRequest(
                warehouseId,
                relocationBudgetPct,
                useMilpAClass,
                materials,
                locations,
                incumbentPrimary,
                lockedMaterialIds,
                Map.of());
    }

    public static PlanOptimizeRequest buildRequest(
            UUID warehouseId,
            BigDecimal relocationBudgetPct,
            boolean useMilpAClass,
            List<SlottingPlanOptimizer.MaterialCandidate> materials,
            List<LocationEntity> locations,
            Map<UUID, String> incumbentPrimary,
            Set<UUID> lockedMaterialIds,
            Map<UUID, DemandSpacePlanningService.DemandProfile> demandProfiles) {

        Map<UUID, DemandSpacePlanningService.DemandProfile> profiles =
                demandProfiles != null ? demandProfiles : Map.of();
        PlanOptimizeRequest req = new PlanOptimizeRequest();
        req.warehouse_id = warehouseId.toString();
        req.relocation_budget_pct = relocationBudgetPct != null
                ? relocationBudgetPct.doubleValue() : 30.0;
        req.use_milp_a_class = useMilpAClass;
        req.locked_material_ids = lockedMaterialIds.stream().map(UUID::toString).toList();

        req.materials = new ArrayList<>();
        for (SlottingPlanOptimizer.MaterialCandidate m : materials) {
            PlanMaterialPayload p = new PlanMaterialPayload();
            p.material_id = m.materialId().toString();
            p.material_code = m.materialCode();
            p.material_type = m.materialType();
            p.amalgamated_class = m.amalgamatedClass();
            p.abc_class = m.abcClass();
            p.fms_class = m.fmsClass();
            p.issue_volume = m.issueVolume();
            p.issue_count = m.issueCount();
            p.weight_kg = m.weightKg() != null ? m.weightKg().doubleValue() : null;
            p.volume_cm3 = m.volumeCm3() != null ? m.volumeCm3().doubleValue() : null;
            p.pallet_spaces = m.palletSpaces() != null ? m.palletSpaces().doubleValue() : null;
            p.incumbent_primary_location_code = incumbentPrimary.get(m.materialId());
            p.locked = lockedMaterialIds.contains(m.materialId());
            DemandSpacePlanningService.DemandProfile profile = profiles.get(m.materialId());
            if (profile != null) {
                p.required_pallets = profile.requiredPalletPositions();
                p.demand_trend = profile.demandTrend().name();
                p.min_stock_units = profile.minStockUnits() != null
                        ? profile.minStockUnits().doubleValue() : null;
            }
            req.materials.add(p);
        }

        req.locations = new ArrayList<>();
        for (LocationEntity loc : locations) {
            PlanLocationPayload l = new PlanLocationPayload();
            l.location_id = loc.getId().toString();
            l.location_code = loc.getLocationCode();
            l.amalgamated_class = loc.getAmalgamatedClass();
            l.area = loc.getArea();
            l.level_number = loc.getLevelNumber() != null ? loc.getLevelNumber() : 1;
            l.accessibility_rating = loc.getAccessibilityRating() != null ? loc.getAccessibilityRating() : 3;
            l.coordinate_x = loc.getCoordinateX() != null ? loc.getCoordinateX().doubleValue() : 0;
            l.coordinate_y = loc.getCoordinateY() != null ? loc.getCoordinateY().doubleValue() : 0;
            l.max_weight_kg = loc.getMaxWeightKg() != null ? loc.getMaxWeightKg().doubleValue() : null;
            l.max_volume_cm3 = loc.getMaxVolumeCm3() != null ? loc.getMaxVolumeCm3().doubleValue() : null;
            l.capacity = loc.getCapacity() != null ? loc.getCapacity().doubleValue() : null;
            l.max_pallet_capacity = loc.getMaxPalletCapacity();
            l.is_active = Boolean.TRUE.equals(loc.getIsActive());
            req.locations.add(l);
        }
        return req;
    }

    /** Maps Python assignments onto Java heuristic lines (A-class MILP refine). */
    public List<SlottingPlanOptimizer.OptimizedLine> mergePythonAssignments(
            List<SlottingPlanOptimizer.OptimizedLine> javaLines,
            PlanOptimizeResponse pythonResponse) {

        Map<String, PlanAssignmentPayload> byMaterialId = new HashMap<>();
        for (PlanAssignmentPayload a : pythonResponse.assignments) {
            byMaterialId.put(a.material_id, a);
        }

        List<SlottingPlanOptimizer.OptimizedLine> merged = new ArrayList<>();
        for (SlottingPlanOptimizer.OptimizedLine line : javaLines) {
            PlanAssignmentPayload py = byMaterialId.get(line.material().materialId().toString());
            if (py == null || !"A".equals(line.material().abcClass())) {
                merged.add(line);
                continue;
            }
            String primary = py.final_primary_location_code != null
                    ? py.final_primary_location_code
                    : py.recommended_primary_location_code;
            if (primary == null) {
                merged.add(line);
                continue;
            }
            UUID locId = py.recommended_primary_location_id != null
                    ? UUID.fromString(py.recommended_primary_location_id) : line.recommendedPrimaryLocationId();

            String reason = py.move_reason != null ? py.move_reason : line.moveReason();
            if (pythonResponse.algorithm != null && pythonResponse.algorithm.contains("MILP")) {
                reason = reason + " (A-class MILP via slotting-service)";
            }

            merged.add(new SlottingPlanOptimizer.OptimizedLine(
                    line.material(),
                    line.currentPrimary(),
                    primary,
                    locId,
                    py.relocation_applied ? primary : line.finalPrimary(),
                    py.active_pick_pallet_positions > 0 ? py.active_pick_pallet_positions : line.activePickPp(),
                    py.required_reserve_pallet_positions,
                    py.max_stock_pallet_positions > 0 ? py.max_stock_pallet_positions : line.maxStockPp(),
                    mapReserves(py),
                    py.distance_saved_meters > 0
                            ? BigDecimal.valueOf(py.distance_saved_meters) : line.distanceSavedMeters(),
                    py.zone_upgrade != null ? py.zone_upgrade : line.zoneUpgrade(),
                    reason,
                    py.gain_score > 0 ? BigDecimal.valueOf(py.gain_score) : line.gainScore(),
                    py.relocation_applied,
                    py.relocation_applied,
                    py.status != null ? py.status : line.status()));
        }
        return merged;
    }

    private static List<SlottingPlanOptimizer.ReserveSlot> mapReserves(PlanAssignmentPayload py) {
        if (py.reserve_locations == null) {
            return List.of();
        }
        List<SlottingPlanOptimizer.ReserveSlot> slots = new ArrayList<>();
        for (PlanReservePayload r : py.reserve_locations) {
            slots.add(new SlottingPlanOptimizer.ReserveSlot(
                    r.location_code,
                    r.reserve_pallet_positions > 0 ? r.reserve_pallet_positions : 1,
                    r.reserve_zone_hint != null ? r.reserve_zone_hint : "deep_reserve"));
        }
        return slots;
    }

    // JSON DTOs (public fields for Jackson)
    public static class PlanOptimizeRequest {
        public String warehouse_id;
        public double relocation_budget_pct = 30.0;
        public List<PlanMaterialPayload> materials = List.of();
        public List<PlanLocationPayload> locations = List.of();
        public List<String> locked_material_ids = List.of();
        public boolean use_milp_a_class = true;
    }

    public static class PlanMaterialPayload {
        public String material_id;
        public String material_code;
        public String material_type;
        public String amalgamated_class;
        public String abc_class;
        public String fms_class;
        public double issue_volume;
        public int issue_count;
        public Double weight_kg;
        public Double volume_cm3;
        public Double pallet_spaces;
        public String incumbent_primary_location_code;
        public boolean locked;
        public Integer required_pallets;
        public String demand_trend;
        public Double min_stock_units;
    }

    public static class PlanLocationPayload {
        public String location_id;
        public String location_code;
        public String amalgamated_class;
        public String area;
        public int level_number;
        public int accessibility_rating;
        public double coordinate_x;
        public double coordinate_y;
        public Double max_weight_kg;
        public Double max_volume_cm3;
        public Double capacity;
        public Integer max_pallet_capacity;
        public boolean is_active;
    }

    public static class PlanOptimizeResponse {
        public String warehouse_id;
        public String algorithm;
        public List<PlanAssignmentPayload> assignments = List.of();
        public int total_moves_proposed;
        public int relocation_moves_applied;
    }

    public static class PlanAssignmentPayload {
        public String material_id;
        public String material_code;
        public String recommended_primary_location_code;
        public String recommended_primary_location_id;
        public String final_primary_location_code;
        public int active_pick_pallet_positions;
        public int required_reserve_pallet_positions;
        public int max_stock_pallet_positions;
        public List<PlanReservePayload> reserve_locations;
        public double distance_saved_meters;
        public String zone_upgrade;
        public String move_reason;
        public double gain_score;
        public boolean relocation_applied;
        public String status;
    }

    public static class PlanReservePayload {
        public String location_code;
        public int reserve_pallet_positions;
        public String reserve_zone_hint;
    }
}
