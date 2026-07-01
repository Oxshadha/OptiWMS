package com.optiwms.coreapp.master;

import com.optiwms.domain.master.Material;
import com.optiwms.infra.master.MaterialEntity;
import com.optiwms.infra.master.MaterialRepository;
import com.optiwms.infra.master.SupplierMaterialEntity;
import com.optiwms.infra.master.SupplierMaterialRepository;
import com.optiwms.infra.master.SupplierRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class SupplierMaterialService {

    private final SupplierMaterialRepository supplierMaterialRepository;
    private final SupplierRepository supplierRepository;
    private final MaterialRepository materialRepository;

    public SupplierMaterialService(
            SupplierMaterialRepository supplierMaterialRepository,
            SupplierRepository supplierRepository,
            MaterialRepository materialRepository
    ) {
        this.supplierMaterialRepository = supplierMaterialRepository;
        this.supplierRepository = supplierRepository;
        this.materialRepository = materialRepository;
    }

    public List<Material> getMaterialsForSupplier(UUID supplierId, String materialType) {
        assertSupplierExists(supplierId);

        List<SupplierMaterialEntity> links = supplierMaterialRepository.findBySupplierId(supplierId);
        if (links.isEmpty()) {
            return List.of();
        }

        List<UUID> materialIds = links.stream()
                .map(SupplierMaterialEntity::getMaterialId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        Map<UUID, MaterialEntity> materialMap = materialRepository.findAllById(materialIds).stream()
                .collect(Collectors.toMap(MaterialEntity::getId, Function.identity()));

        return materialIds.stream()
                .map(materialMap::get)
                .filter(Objects::nonNull)
                .filter(m -> matchesMaterialType(m.getMaterialType(), materialType))
                .map(this::toDomain)
                .sorted(Comparator.comparing(Material::getMaterialCode, Comparator.nullsLast(String::compareToIgnoreCase)))
                .toList();
    }

    public boolean isMaterialLinked(UUID supplierId, UUID materialId) {
        if (supplierId == null || materialId == null) {
            return false;
        }
        return supplierMaterialRepository.existsBySupplierIdAndMaterialId(supplierId, materialId);
    }

    public boolean hasAnyMaterialLink(UUID supplierId) {
        if (supplierId == null) {
            return false;
        }
        return supplierMaterialRepository.countBySupplierId(supplierId) > 0;
    }

    public Optional<SupplierMaterialRule> findRule(UUID supplierId, UUID materialId) {
        if (supplierId == null || materialId == null) {
            return Optional.empty();
        }
        return supplierMaterialRepository.findBySupplierIdAndMaterialId(supplierId, materialId)
                .map(entity -> new SupplierMaterialRule(
                        entity.getMinimumOrderQuantity(),
                        entity.getOrderMultiple(),
                        entity.getUnitsPerHandlingUnit(),
                        entity.getLeadTimeDays(),
                        Boolean.TRUE.equals(entity.getPreferred())));
    }

    @Transactional
    public void linkMaterial(UUID supplierId, UUID materialId) {
        assertSupplierExists(supplierId);
        assertMaterialExists(materialId);
        if (supplierMaterialRepository.existsBySupplierIdAndMaterialId(supplierId, materialId)) {
            return;
        }
        SupplierMaterialEntity entity = new SupplierMaterialEntity();
        entity.setSupplierId(supplierId);
        entity.setMaterialId(materialId);
        supplierMaterialRepository.save(entity);
    }

    @Transactional
    public void unlinkMaterial(UUID supplierId, UUID materialId) {
        supplierMaterialRepository.deleteBySupplierIdAndMaterialId(supplierId, materialId);
    }

    @Transactional
    public void replaceMaterials(UUID supplierId, List<UUID> materialIds) {
        assertSupplierExists(supplierId);

        List<UUID> sanitized = materialIds == null
                ? List.of()
                : materialIds.stream().filter(Objects::nonNull).distinct().toList();

        if (!sanitized.isEmpty()) {
            long existingCount = materialRepository.findAllById(sanitized).stream().count();
            if (existingCount != sanitized.size()) {
                throw new IllegalArgumentException("One or more materials do not exist");
            }
        }

        supplierMaterialRepository.deleteBySupplierId(supplierId);

        if (!sanitized.isEmpty()) {
            List<SupplierMaterialEntity> newLinks = sanitized.stream().map(materialId -> {
                SupplierMaterialEntity entity = new SupplierMaterialEntity();
                entity.setSupplierId(supplierId);
                entity.setMaterialId(materialId);
                return entity;
            }).toList();
            supplierMaterialRepository.saveAll(newLinks);
        }
    }

    @Transactional
    public void replaceMaterialRules(UUID supplierId, List<SupplierMaterialRuleUpdate> rules) {
        assertSupplierExists(supplierId);

        List<SupplierMaterialRuleUpdate> sanitized = rules == null
                ? List.of()
                : rules.stream().filter(rule -> rule != null && rule.materialId() != null).toList();

        if (!sanitized.isEmpty()) {
            List<UUID> materialIds = sanitized.stream().map(SupplierMaterialRuleUpdate::materialId).distinct().toList();
            long existingCount = materialRepository.findAllById(materialIds).stream().count();
            if (existingCount != materialIds.size()) {
                throw new IllegalArgumentException("One or more materials do not exist");
            }

            List<UUID> preferredMaterialIds = sanitized.stream()
                    .filter(rule -> Boolean.TRUE.equals(rule.preferred()))
                    .map(SupplierMaterialRuleUpdate::materialId)
                    .distinct()
                    .toList();
            for (UUID materialId : preferredMaterialIds) {
                List<SupplierMaterialEntity> existingPreferredLinks = supplierMaterialRepository.findByMaterialId(materialId);
                for (SupplierMaterialEntity link : existingPreferredLinks) {
                    if (!supplierId.equals(link.getSupplierId()) && Boolean.TRUE.equals(link.getPreferred())) {
                        link.setPreferred(false);
                    }
                }
                supplierMaterialRepository.saveAll(existingPreferredLinks);
            }
        }

        supplierMaterialRepository.deleteBySupplierId(supplierId);
        List<SupplierMaterialEntity> entities = sanitized.stream().map(rule -> {
            SupplierMaterialEntity entity = new SupplierMaterialEntity();
            entity.setSupplierId(supplierId);
            entity.setMaterialId(rule.materialId());
            entity.setMinimumOrderQuantity(rule.minimumOrderQuantity());
            entity.setOrderMultiple(rule.orderMultiple());
            entity.setUnitsPerHandlingUnit(rule.unitsPerHandlingUnit());
            entity.setLeadTimeDays(rule.leadTimeDays());
            entity.setPreferred(Boolean.TRUE.equals(rule.preferred()));
            return entity;
        }).toList();
        supplierMaterialRepository.saveAll(entities);
    }

    private boolean matchesMaterialType(String actualType, String filterType) {
        if (filterType == null || filterType.isBlank()) {
            return true;
        }
        String a = actualType == null ? "" : actualType.trim().toLowerCase();
        String f = filterType.trim().toLowerCase();
        return a.equals(f);
    }

    private void assertSupplierExists(UUID supplierId) {
        if (supplierId == null || !supplierRepository.existsById(supplierId)) {
            throw new IllegalArgumentException("Supplier not found: " + supplierId);
        }
    }

    private void assertMaterialExists(UUID materialId) {
        if (materialId == null || !materialRepository.existsById(materialId)) {
            throw new IllegalArgumentException("Material not found: " + materialId);
        }
    }

    private Material toDomain(MaterialEntity entity) {
        Material m = new Material();
        m.setId(entity.getId());
        m.setMaterialCode(entity.getMaterialCode());
        m.setDescription(entity.getDescription());
        m.setUnitType(entity.getUnitType());
        m.setStorageType(entity.getStorageType());
        m.setMaterialType(entity.getMaterialType());
        m.setLengthCm(entity.getLengthCm());
        m.setWidthCm(entity.getWidthCm());
        m.setHeightCm(entity.getHeightCm());
        m.setWeightKg(entity.getWeightKg());
        m.setVolumeCm3(entity.getVolumeCm3());
        m.setPalletSpaces(entity.getPalletSpaces());
        m.setStackable(entity.getStackable());
        m.setMaxStackHeight(entity.getMaxStackHeight());
        m.setTemperatureControlled(entity.getTemperatureControlled());
        m.setHazardous(entity.getHazardous());
        m.setFragile(entity.getFragile());
        m.setMaxPalletWeightKg(entity.getMaxPalletWeightKg());
        m.setMinOrderQuantity(entity.getMinOrderQuantity());
        m.setHandlingUnitType(entity.getHandlingUnitType());
        m.setUnitsPerHandlingUnit(entity.getUnitsPerHandlingUnit());
        m.setOrderMultiple(entity.getOrderMultiple());
        m.setSafetyStockLevel(entity.getSafetyStockLevel());
        return m;
    }

    public record SupplierMaterialRule(
            BigDecimal minimumOrderQuantity,
            BigDecimal orderMultiple,
            BigDecimal unitsPerHandlingUnit,
            Integer leadTimeDays,
            boolean preferred) {
    }

    public record SupplierMaterialRuleUpdate(
            UUID materialId,
            BigDecimal minimumOrderQuantity,
            BigDecimal orderMultiple,
            BigDecimal unitsPerHandlingUnit,
            Integer leadTimeDays,
            Boolean preferred) {
    }
}
