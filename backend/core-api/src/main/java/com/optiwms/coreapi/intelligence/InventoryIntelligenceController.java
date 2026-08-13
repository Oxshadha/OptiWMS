package com.optiwms.coreapi.intelligence;

import com.optiwms.coreapi.ai.AiProxyService;
import com.optiwms.coreapp.forecastspace.ForecastSpaceOptimizationService;
import com.optiwms.coreapp.forecastspace.InventoryPolicyRecommendationService;
import com.optiwms.coreapp.intelligence.ActionCenterService;
import com.optiwms.coreapp.slotting.SlottingPlanService;
import com.optiwms.infra.forecastspace.*;
import com.optiwms.infra.intelligence.PlanningCycleRepository;
import com.optiwms.infra.slotting.SlottingPlanEntity;
import com.optiwms.infra.slotting.SlottingPlanRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.*;

@RestController
@RequestMapping("/api/v1/intelligence")
public class InventoryIntelligenceController {
    private final ActionCenterService actionCenterService;
    private final InventoryPolicyRecommendationService policyService;
    private final ForecastSpaceOptimizationService spaceService;
    private final SlottingPlanService slottingService;
    private final InventoryPolicyRecommendationRunRepository policyRuns;
    private final SpaceOptimizationRunRepository spaceRuns;
    private final SlottingPlanRepository slottingPlans;
    private final PlanningCycleRepository planningCycles;
    private final AiProxyService aiProxyService;

    public InventoryIntelligenceController(ActionCenterService actionCenterService,
            InventoryPolicyRecommendationService policyService,
            ForecastSpaceOptimizationService spaceService,
            SlottingPlanService slottingService,
            InventoryPolicyRecommendationRunRepository policyRuns,
            SpaceOptimizationRunRepository spaceRuns,
            SlottingPlanRepository slottingPlans,
            PlanningCycleRepository planningCycles,
            AiProxyService aiProxyService) {
        this.actionCenterService = actionCenterService;
        this.policyService = policyService;
        this.spaceService = spaceService;
        this.slottingService = slottingService;
        this.policyRuns = policyRuns;
        this.spaceRuns = spaceRuns;
        this.slottingPlans = slottingPlans;
        this.planningCycles = planningCycles;
        this.aiProxyService = aiProxyService;
    }

    @GetMapping("/workspace")
    public ActionCenterService.ActionCenterSummary workspace(Authentication auth,
            @RequestParam(required = false) String warehouseId) {
        return actionCenterService.summarize(authorizedWarehouse(auth, warehouseId));
    }

    @GetMapping("/recommendations")
    public List<ActionCenterService.ActionItem> recommendations(Authentication auth,
            @RequestParam(required = false) String warehouseId) {
        return workspace(auth, warehouseId).actionItems();
    }

    @GetMapping("/recommendations/{id}")
    public ActionCenterService.ActionItem recommendation(Authentication auth, @PathVariable UUID id,
            @RequestParam(required = false) String warehouseId) {
        return workspace(auth, warehouseId).actionItems().stream()
                .filter(item -> id.equals(item.sourceId())).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Recommendation is not active for the authorized warehouse"));
    }

    @PostMapping("/recommendations/{id}/approve")
    @PreAuthorize("hasAnyRole('ADMIN','WAREHOUSE_MANAGER','MANAGER','SUPERVISOR')")
    public Map<String, Object> approve(Authentication auth, @PathVariable UUID id,
            @RequestBody DecisionRequest body) {
        UUID warehouse = authorizedWarehouse(auth, body.warehouseId());
        String actor = actor(auth, body.actor());
        return switch (body.type()) {
            case "APPROVE_POLICY" -> {
                requireWarehouse(policyRuns.findById(id).map(InventoryPolicyRecommendationRunEntity::getWarehouseId), warehouse);
                var run = policyService.approveRun(id, actor);
                yield result(id, body.type(), run.getStatus(), run.getPlanningCycleId());
            }
            case "APPROVE_SPACE" -> {
                requireWarehouse(spaceRuns.findById(id).map(SpaceOptimizationRunEntity::getWarehouseId), warehouse);
                var run = spaceService.approveRun(id, actor);
                yield result(id, body.type(), run.getStatus(), run.getPlanningCycleId());
            }
            case "APPROVE_SLOTTING_PLAN" -> {
                requireWarehouse(slottingPlans.findById(id).map(SlottingPlanEntity::getWarehouseId), warehouse);
                var plan = slottingService.approve(id, new SlottingPlanService.ApprovePlanRequest(actor, false));
                yield result(id, body.type(), plan.getStatus(), plan.getPlanningCycleId());
            }
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported approval action");
        };
    }

    @PostMapping("/recommendations/{id}/schedule")
    @PreAuthorize("hasAnyRole('ADMIN','WAREHOUSE_MANAGER','MANAGER','SUPERVISOR')")
    public Map<String, Object> schedule(Authentication auth, @PathVariable UUID id,
            @RequestBody DecisionRequest body) {
        UUID warehouse = authorizedWarehouse(auth, body.warehouseId());
        requireWarehouse(slottingPlans.findById(id).map(SlottingPlanEntity::getWarehouseId), warehouse);
        OffsetDateTime when = body.scheduledFor() != null ? OffsetDateTime.parse(body.scheduledFor()) : nextOffPeak();
        SlottingPlanEntity plan = slottingService.schedule(id, when);
        updateCycle(plan.getPlanningCycleId(), "SCHEDULED", when);
        return result(id, "SCHEDULE_SLOTTING_PLAN", plan.getStatus(), plan.getPlanningCycleId());
    }

    @PostMapping("/recommendations/{id}/defer")
    @PreAuthorize("hasAnyRole('ADMIN','WAREHOUSE_MANAGER','MANAGER','SUPERVISOR')")
    public Map<String, Object> defer(Authentication auth, @PathVariable UUID id,
            @RequestBody DecisionRequest body) {
        UUID warehouse = authorizedWarehouse(auth, body.warehouseId());
        UUID cycle = cycleFor(id, body.type(), warehouse);
        updateCycle(cycle, "DEFERRED", body.scheduledFor() != null ? OffsetDateTime.parse(body.scheduledFor()) : null);
        return result(id, body.type(), "DEFERRED", cycle);
    }

    @PostMapping("/recommendations/{id}/reject")
    @PreAuthorize("hasAnyRole('ADMIN','WAREHOUSE_MANAGER','MANAGER','SUPERVISOR')")
    public Map<String, Object> reject(Authentication auth, @PathVariable UUID id,
            @RequestBody DecisionRequest body) {
        UUID warehouse = authorizedWarehouse(auth, body.warehouseId());
        UUID cycle;
        switch (body.type()) {
            case "APPROVE_POLICY" -> {
                InventoryPolicyRecommendationRunEntity run = policyRuns.findById(id).orElseThrow();
                requireWarehouse(Optional.of(run.getWarehouseId()), warehouse);
                run.setStatus("REJECTED"); policyRuns.save(run); cycle = run.getPlanningCycleId();
            }
            case "APPROVE_SPACE" -> {
                SpaceOptimizationRunEntity run = spaceRuns.findById(id).orElseThrow();
                requireWarehouse(Optional.of(run.getWarehouseId()), warehouse);
                run.setStatus("REJECTED"); spaceRuns.save(run); cycle = run.getPlanningCycleId();
            }
            case "APPROVE_SLOTTING_PLAN", "SCHEDULE_SLOTTING_PLAN" -> {
                SlottingPlanEntity plan = slottingPlans.findById(id).orElseThrow();
                requireWarehouse(Optional.of(plan.getWarehouseId()), warehouse);
                plan.setStatus("CANCELLED"); plan.setExecutionStatus("CANCELLED"); slottingPlans.save(plan);
                cycle = plan.getPlanningCycleId();
            }
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported rejection action");
        }
        updateCycle(cycle, "REJECTED", null);
        return result(id, body.type(), "REJECTED", cycle);
    }

    private UUID cycleFor(UUID id, String type, UUID warehouse) {
        return switch (type) {
            case "APPROVE_POLICY", "CREATE_SPACE_RUN" -> {
                var run = policyRuns.findById(id).orElseThrow(); requireWarehouse(Optional.of(run.getWarehouseId()), warehouse);
                yield run.getPlanningCycleId();
            }
            case "APPROVE_SPACE" -> {
                var run = spaceRuns.findById(id).orElseThrow(); requireWarehouse(Optional.of(run.getWarehouseId()), warehouse);
                yield run.getPlanningCycleId();
            }
            default -> {
                var plan = slottingPlans.findById(id).orElseThrow(); requireWarehouse(Optional.of(plan.getWarehouseId()), warehouse);
                yield plan.getPlanningCycleId();
            }
        };
    }

    private void updateCycle(UUID cycleId, String status, OffsetDateTime scheduledFor) {
        if (cycleId == null) return;
        planningCycles.findById(cycleId).ifPresent(cycle -> {
            cycle.setLifecycleStatus(status);
            if (scheduledFor != null) cycle.setScheduledFor(scheduledFor);
            planningCycles.save(cycle);
        });
    }

    private UUID authorizedWarehouse(Authentication auth, String requested) {
        String scoped = aiProxyService.resolveWarehouseScope(auth, requested);
        if (scoped == null) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No authorized warehouse assignment");
        try { return UUID.fromString(scoped); }
        catch (IllegalArgumentException ex) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid warehouse scope"); }
    }

    private void requireWarehouse(Optional<UUID> actual, UUID expected) {
        if (actual.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Recommendation was not found");
        if (!expected.equals(actual.get())) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Recommendation belongs to another warehouse");
    }

    private String actor(Authentication auth, String requested) {
        return auth != null && auth.getName() != null ? auth.getName() : requested;
    }

    private OffsetDateTime nextOffPeak() {
        var now = OffsetDateTime.now(ZoneId.of("Asia/Colombo"));
        var today = now.toLocalDate().atTime(22, 0).atZone(ZoneId.of("Asia/Colombo")).toOffsetDateTime();
        return today.isAfter(now) ? today : today.plusDays(1);
    }

    private Map<String, Object> result(UUID id, String type, String status, UUID cycle) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", id); result.put("type", type); result.put("status", status);
        result.put("planningCycleId", cycle); result.put("asOf", OffsetDateTime.now());
        return result;
    }

    public record DecisionRequest(String type, String actor, String warehouseId, String reason, String scheduledFor) {}
}
