package com.optiwms.coreapp.master;

import com.optiwms.domain.master.Material;
import com.optiwms.infra.master.MaterialEntity;
import com.optiwms.infra.master.MaterialRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class MaterialService {

    private final MaterialRepository repository;

    public MaterialService(MaterialRepository repository) {
        this.repository = repository;
    }

    /**
     * Normalize material type to ensure consistent values in database.
     * Handles variations like "packing_material" -> "packaging_material"
     * Industry Best Practice: Centralized normalization prevents data inconsistencies
     */
    private String normalizeMaterialType(String materialType) {
        if (materialType == null || materialType.trim().isEmpty()) {
            return "raw_material"; // Default
        }
        
        String normalized = materialType.toLowerCase().trim();
        
        // Handle common variations
        if (normalized.equals("packing_material") || normalized.equals("packaging")) {
            return "packaging_material";
        }
        if (normalized.equals("raw") || normalized.equals("rawmaterial")) {
            return "raw_material";
        }
        if (normalized.equals("finished_good") || normalized.equals("finished_goods") 
            || normalized.equals("finished_product") || normalized.equals("products")) {
            return "product";
        }
        
        // Return valid values as-is, default invalid ones to raw_material
        if (normalized.equals("raw_material") || normalized.equals("packaging_material") || normalized.equals("product")) {
            return normalized;
        }
        
        // Invalid value - default to raw_material
        return "raw_material";
    }

    public List<Material> listAll() {
        return repository.findAll().stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<Material> findByMaterialType(String materialType) {
        return repository.findByMaterialType(materialType).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public Material findById(java.util.UUID id) {
        return repository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Material not found: " + id));
    }

    public Material findByCode(String materialCode) {
        return repository.findByMaterialCode(materialCode)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Material not found: " + materialCode));
    }

    @Transactional
    public Material create(Material material) {
        if (repository.existsByMaterialCode(material.getMaterialCode())) {
            throw new RuntimeException("Material code already exists: " + material.getMaterialCode());
        }
        return createOrUpdate(material);
    }

    @Transactional
    public Material update(java.util.UUID id, Material material) {
        MaterialEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Material not found: " + id));

        // Check if material code is being changed and if it conflicts
        if (!entity.getMaterialCode().equals(material.getMaterialCode())) {
            if (repository.existsByMaterialCode(material.getMaterialCode())) {
                throw new RuntimeException("Material code already exists: " + material.getMaterialCode());
            }
        }

        entity.setMaterialCode(material.getMaterialCode());
        entity.setDescription(material.getDescription());
        entity.setUnitType(material.getUnitType());
        entity.setStorageType(material.getStorageType() != null ? material.getStorageType() : "pallet");
        entity.setMaterialType(normalizeMaterialType(material.getMaterialType()));

        MaterialEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public void delete(java.util.UUID id) {
        if (!repository.existsById(id)) {
            throw new RuntimeException("Material not found: " + id);
        }
        repository.deleteById(id);
    }

    @Transactional
    public Material createOrUpdate(Material material) {
        MaterialEntity entity = repository.findByMaterialCode(material.getMaterialCode())
                .orElse(new MaterialEntity());

        entity.setMaterialCode(material.getMaterialCode());
        entity.setDescription(material.getDescription());
        entity.setUnitType(material.getUnitType());
        entity.setStorageType(material.getStorageType() != null ? material.getStorageType() : "pallet");
        entity.setMaterialType(normalizeMaterialType(material.getMaterialType()));

        MaterialEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public List<Material> importMaterials(List<Material> materials) {
        return materials.stream()
                .map(this::createOrUpdate)
                .collect(Collectors.toList());
    }

    private Material toDomain(MaterialEntity entity) {
        Material m = new Material();
        m.setId(entity.getId());
        m.setMaterialCode(entity.getMaterialCode());
        m.setDescription(entity.getDescription());
        m.setUnitType(entity.getUnitType());
        m.setStorageType(entity.getStorageType());
        m.setMaterialType(entity.getMaterialType());
        return m;
    }
}

