package com.optiwms.coreapi.planning;

import com.optiwms.infra.planning.SupplyPlanEntity;
import com.optiwms.infra.planning.SupplyPlanRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/planning/supply-plans")
@PreAuthorize("hasAnyRole('ADMIN', 'WAREHOUSE_MANAGER')")
public class SupplyPlanController {

    private final SupplyPlanRepository supplyPlanRepository;

    public SupplyPlanController(SupplyPlanRepository supplyPlanRepository) {
        this.supplyPlanRepository = supplyPlanRepository;
    }

    @GetMapping
    public ResponseEntity<List<SupplyPlanDto>> list(
            @RequestParam(required = false) UUID materialId,
            @RequestParam(required = false) UUID warehouseId,
            @RequestParam(required = false) Integer planYear,
            @RequestParam(required = false) Integer planMonth
    ) {
        List<SupplyPlanEntity> plans;

        if (materialId != null && warehouseId != null) {
            if (planYear != null && planMonth != null) {
                plans = supplyPlanRepository
                        .findByMaterialIdAndWarehouseIdAndPlanYearAndPlanMonth(materialId, warehouseId, planYear, planMonth)
                        .map(List::of)
                        .orElse(List.of());
            } else if (planYear != null) {
                plans = supplyPlanRepository.findByMaterialIdAndWarehouseIdAndPlanYear(materialId, warehouseId, planYear);
            } else {
                plans = supplyPlanRepository.findByMaterialIdAndWarehouseId(materialId, warehouseId);
            }
        } else if (materialId != null) {
            plans = supplyPlanRepository.findByMaterialId(materialId);
        } else if (warehouseId != null) {
            plans = supplyPlanRepository.findByWarehouseId(warehouseId);
        } else {
            plans = supplyPlanRepository.findAll();
        }

        List<SupplyPlanDto> dtos = plans.stream()
                .map(this::toDto)
                .collect(Collectors.toList());

        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/{id}")
    public ResponseEntity<SupplyPlanDto> getById(@PathVariable UUID id) {
        return supplyPlanRepository.findById(id)
                .map(plan -> ResponseEntity.ok(toDto(plan)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SupplyPlanDto> create(@RequestBody CreateSupplyPlanRequest request) {
        SupplyPlanEntity entity = new SupplyPlanEntity();
        entity.setMaterialId(request.materialId());
        entity.setWarehouseId(request.warehouseId());
        entity.setPlanYear(request.planYear());
        entity.setPlanMonth(request.planMonth());
        entity.setPlannedQuantity(request.plannedQuantity());
        entity.setActualQuantity(request.actualQuantity());
        entity.setVariance(request.variance());

        SupplyPlanEntity saved = supplyPlanRepository.save(entity);
        return ResponseEntity.status(org.springframework.http.HttpStatus.CREATED).body(toDto(saved));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SupplyPlanDto> update(@PathVariable UUID id, @RequestBody UpdateSupplyPlanRequest request) {
        return supplyPlanRepository.findById(id)
                .map(entity -> {
                    if (request.plannedQuantity() != null) {
                        entity.setPlannedQuantity(request.plannedQuantity());
                    }
                    if (request.actualQuantity() != null) {
                        entity.setActualQuantity(request.actualQuantity());
                    }
                    if (request.variance() != null) {
                        entity.setVariance(request.variance());
                    }
                    SupplyPlanEntity saved = supplyPlanRepository.save(entity);
                    return ResponseEntity.ok(toDto(saved));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        if (supplyPlanRepository.existsById(id)) {
            supplyPlanRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    private SupplyPlanDto toDto(SupplyPlanEntity entity) {
        return new SupplyPlanDto(
                entity.getId(),
                entity.getMaterialId(),
                entity.getWarehouseId(),
                entity.getPlanYear(),
                entity.getPlanMonth(),
                entity.getPlannedQuantity() != null ? entity.getPlannedQuantity().toString() : null,
                entity.getActualQuantity() != null ? entity.getActualQuantity().toString() : null,
                entity.getVariance() != null ? entity.getVariance().toString() : null,
                entity.getCreatedAt() != null ? entity.getCreatedAt().toString() : null,
                entity.getUpdatedAt() != null ? entity.getUpdatedAt().toString() : null
        );
    }

    public record SupplyPlanDto(
            UUID id,
            UUID materialId,
            UUID warehouseId,
            Integer planYear,
            Integer planMonth,
            String plannedQuantity,
            String actualQuantity,
            String variance,
            String createdAt,
            String updatedAt
    ) {}

    public record CreateSupplyPlanRequest(
            UUID materialId,
            UUID warehouseId,
            Integer planYear,
            Integer planMonth,
            java.math.BigDecimal plannedQuantity,
            java.math.BigDecimal actualQuantity,
            java.math.BigDecimal variance
    ) {}

    public record UpdateSupplyPlanRequest(
            java.math.BigDecimal plannedQuantity,
            java.math.BigDecimal actualQuantity,
            java.math.BigDecimal variance
    ) {}
}
