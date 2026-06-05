package com.optiwms.coreapp.master;

import com.optiwms.domain.master.SupplierConstraint;
import com.optiwms.infra.master.SupplierConstraintEntity;
import com.optiwms.infra.master.SupplierConstraintRepository;
import com.optiwms.infra.master.SupplierEntity;
import com.optiwms.infra.master.SupplierRepository;
import com.optiwms.infra.master.MaterialEntity;
import com.optiwms.infra.master.MaterialRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class SupplierConstraintService {

    private final SupplierConstraintRepository supplierConstraintRepository;
    private final SupplierRepository supplierRepository;
    private final MaterialRepository materialRepository;

    public SupplierConstraintService(
            SupplierConstraintRepository supplierConstraintRepository,
            SupplierRepository supplierRepository,
            MaterialRepository materialRepository) {
        this.supplierConstraintRepository = supplierConstraintRepository;
        this.supplierRepository = supplierRepository;
        this.materialRepository = materialRepository;
    }

    public List<SupplierConstraint> getConstraintsBySupplier(UUID supplierId) {
        return supplierConstraintRepository.findBySupplierId(supplierId).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<SupplierConstraint> getConstraintsByMaterial(UUID materialId) {
        return supplierConstraintRepository.findByMaterialId(materialId).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    @Transactional
    public SupplierConstraint createOrUpdateConstraint(SupplierConstraint constraint) {
        SupplierEntity supplier = supplierRepository.findById(constraint.getSupplierId())
                .orElseThrow(() -> new IllegalArgumentException("Supplier not found: " + constraint.getSupplierId()));

        MaterialEntity material = null;
        if (constraint.getMaterialId() != null) {
            material = materialRepository.findById(constraint.getMaterialId())
                    .orElseThrow(() -> new IllegalArgumentException("Material not found: " + constraint.getMaterialId()));
        }

        SupplierConstraintEntity entity;
        if (constraint.getId() != null) {
            entity = supplierConstraintRepository.findById(constraint.getId())
                    .orElse(new SupplierConstraintEntity());
        } else {
            entity = new SupplierConstraintEntity();
        }

        entity.setSupplier(supplier);
        entity.setMaterial(material);
        entity.setMinOrderQty(constraint.getMinOrderQty());
        entity.setMaxOrderQty(constraint.getMaxOrderQty());
        entity.setBulkDiscountThreshold(constraint.getBulkDiscountThreshold());
        entity.setBulkDiscountPercent(constraint.getBulkDiscountPercent());
        entity.setUnitPrice(constraint.getUnitPrice());
        entity.setCurrency(constraint.getCurrency());
        entity.setAvgShipmentDelayDays(constraint.getAvgShipmentDelayDays());
        entity.setLeadTimeStdDevDays(constraint.getLeadTimeStdDevDays());
        entity.setSupplierOtifPercent(constraint.getSupplierOtifPercent());
        entity.setOrderingCostPerOrder(constraint.getOrderingCostPerOrder());
        entity.setIsActive(constraint.getIsActive() != null ? constraint.getIsActive() : true);

        SupplierConstraintEntity saved = supplierConstraintRepository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public void deleteConstraint(UUID id) {
        supplierConstraintRepository.deleteById(id);
    }

    private SupplierConstraint toDomain(SupplierConstraintEntity entity) {
        SupplierConstraint domain = new SupplierConstraint();
        domain.setId(entity.getId());
        domain.setSupplierId(entity.getSupplier().getId());
        if (entity.getMaterial() != null) {
            domain.setMaterialId(entity.getMaterial().getId());
        }
        domain.setMinOrderQty(entity.getMinOrderQty());
        domain.setMaxOrderQty(entity.getMaxOrderQty());
        domain.setBulkDiscountThreshold(entity.getBulkDiscountThreshold());
        domain.setBulkDiscountPercent(entity.getBulkDiscountPercent());
        domain.setUnitPrice(entity.getUnitPrice());
        domain.setCurrency(entity.getCurrency());
        domain.setAvgShipmentDelayDays(entity.getAvgShipmentDelayDays());
        domain.setLeadTimeStdDevDays(entity.getLeadTimeStdDevDays());
        domain.setSupplierOtifPercent(entity.getSupplierOtifPercent());
        domain.setOrderingCostPerOrder(entity.getOrderingCostPerOrder());
        domain.setIsActive(entity.getIsActive());
        domain.setCreatedAt(entity.getCreatedAt());
        domain.setUpdatedAt(entity.getUpdatedAt());
        return domain;
    }
}
