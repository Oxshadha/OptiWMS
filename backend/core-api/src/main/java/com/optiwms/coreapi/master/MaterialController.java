package com.optiwms.coreapi.master;

import com.optiwms.coreapp.imports.CsvImportService;
import com.optiwms.coreapp.master.MaterialService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/master/materials")
public class MaterialController {

    private final MaterialService materialService;
    private final CsvImportService csvImportService;

    public MaterialController(MaterialService materialService, CsvImportService csvImportService) {
        this.materialService = materialService;
        this.csvImportService = csvImportService;
    }

    @GetMapping
    public ResponseEntity<List<MaterialDto>> list(
            @RequestParam(required = false) String materialType
    ) {
        var materials = materialType != null 
                ? materialService.findByMaterialType(materialType)
                : materialService.listAll();
        var data = materials.stream()
                .map(m -> new MaterialDto(m.getId(), m.getMaterialCode(), m.getDescription(), m.getUnitType(), m.getStorageType(), m.getMaterialType()))
                .toList();
        return ResponseEntity.ok(data);
    }

    @GetMapping("/{id}")
    public ResponseEntity<MaterialDto> getById(@PathVariable java.util.UUID id) {
        try {
            var material = materialService.findById(id);
            return ResponseEntity.ok(new MaterialDto(
                    material.getId(),
                    material.getMaterialCode(),
                    material.getDescription(),
                    material.getUnitType(),
                    material.getStorageType(),
                    material.getMaterialType()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<MaterialDto> create(@RequestBody CreateMaterialRequest request) {
        try {
            var material = new com.optiwms.domain.master.Material();
            material.setMaterialCode(request.materialCode());
            material.setDescription(request.description());
            material.setUnitType(request.unitType());
            material.setStorageType(request.storageType());
            material.setMaterialType(request.materialType());

            var created = materialService.create(material);
            return ResponseEntity.ok(new MaterialDto(
                    created.getId(),
                    created.getMaterialCode(),
                    created.getDescription(),
                    created.getUnitType(),
                    created.getStorageType(),
                    created.getMaterialType()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<MaterialDto> update(@PathVariable java.util.UUID id, @RequestBody UpdateMaterialRequest request) {
        try {
            var material = new com.optiwms.domain.master.Material();
            material.setMaterialCode(request.materialCode());
            material.setDescription(request.description());
            material.setUnitType(request.unitType());
            material.setStorageType(request.storageType());
            material.setMaterialType(request.materialType());

            var updated = materialService.update(id, material);
            return ResponseEntity.ok(new MaterialDto(
                    updated.getId(),
                    updated.getMaterialCode(),
                    updated.getDescription(),
                    updated.getUnitType(),
                    updated.getStorageType(),
                    updated.getMaterialType()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable java.util.UUID id) {
        try {
            materialService.delete(id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/import")
    public ResponseEntity<ImportResponse> importCsv(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(new ImportResponse(0, 1, List.of("File is empty")));
        }

        try {
            CsvImportService.ImportResult result = csvImportService.importMaterials(file.getInputStream());
            return ResponseEntity.ok(new ImportResponse(
                    result.getSuccessCount(),
                    result.getErrorCount(),
                    result.getErrors()
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(new ImportResponse(0, 1, List.of("Error reading file: " + e.getMessage())));
        }
    }

    @PostMapping("/inventory/import")
    public ResponseEntity<ImportResponse> importInventoryCsv(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(new ImportResponse(0, 1, List.of("File is empty")));
        }

        try {
            CsvImportService.ImportResult result = csvImportService.importInventory(file.getInputStream());
            return ResponseEntity.ok(new ImportResponse(
                    result.getSuccessCount(),
                    result.getErrorCount(),
                    result.getErrors()
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(new ImportResponse(0, 1, List.of("Error reading file: " + e.getMessage())));
        }
    }

    public record MaterialDto(
            java.util.UUID id,
            String materialCode,
            String description,
            String unitType,
            String storageType,
            String materialType
    ) {}

    public record ImportResponse(
            int successCount,
            int errorCount,
            List<String> errors
    ) {}

    public record CreateMaterialRequest(
            String materialCode,
            String description,
            String unitType,
            String storageType,
            String materialType
    ) {}

    public record UpdateMaterialRequest(
            String materialCode,
            String description,
            String unitType,
            String storageType,
            String materialType
    ) {}
}

