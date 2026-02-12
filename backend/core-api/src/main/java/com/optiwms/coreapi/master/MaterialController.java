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
                .map(m -> new MaterialDto(
                        m.getId(),
                        m.getMaterialCode(),
                        m.getDescription(),
                        m.getUnitType(),
                        m.getStorageType(),
                        m.getMaterialType(),
                        m.getWeightKg()
                ))
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
                    material.getMaterialType(),
                    material.getWeightKg()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/code/{materialCode}")
    public ResponseEntity<MaterialDto> getByCode(@PathVariable String materialCode) {
        try {
            var material = materialService.findByCode(materialCode);
            return ResponseEntity.ok(new MaterialDto(
                    material.getId(),
                    material.getMaterialCode(),
                    material.getDescription(),
                    material.getUnitType(),
                    material.getStorageType(),
                    material.getMaterialType(),
                    material.getWeightKg()
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
            material.setWeightKg(request.weightKg());

            var created = materialService.create(material);
            return ResponseEntity.ok(new MaterialDto(
                    created.getId(),
                    created.getMaterialCode(),
                    created.getDescription(),
                    created.getUnitType(),
                    created.getStorageType(),
                    created.getMaterialType(),
                    created.getWeightKg()
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
            material.setWeightKg(request.weightKg());

            var updated = materialService.update(id, material);
            return ResponseEntity.ok(new MaterialDto(
                    updated.getId(),
                    updated.getMaterialCode(),
                    updated.getDescription(),
                    updated.getUnitType(),
                    updated.getStorageType(),
                    updated.getMaterialType(),
                    updated.getWeightKg()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id) {
        try {
            java.util.UUID uuid;
            try {
                uuid = java.util.UUID.fromString(id);
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest()
                    .body(new ErrorResponse("Invalid material ID format. Expected UUID."));
            }
            
            try {
                materialService.delete(uuid);
                return ResponseEntity.noContent().build();
            } catch (RuntimeException e) {
                // Check if it's a "not found" error or a constraint violation
                String message = e.getMessage();
                if (message != null && message.contains("not found")) {
                    return ResponseEntity.status(404)
                        .body(new ErrorResponse("Material not found."));
                } else if (message != null && (message.contains("Cannot delete") || message.contains("used in") || message.contains("referenced"))) {
                    // User-friendly constraint violation message
                    return ResponseEntity.status(409) // Conflict
                        .body(new ErrorResponse(message));
                } else {
                    // Generic error - don't expose internal details
                    return ResponseEntity.status(500)
                        .body(new ErrorResponse("Unable to delete material. Please try again or contact support."));
                }
            }
        } catch (Exception e) {
            // Catch any unexpected errors and return generic message
            return ResponseEntity.status(500)
                .body(new ErrorResponse("An error occurred while deleting the material. Please try again."));
        }
    }
    
    // Helper class for error responses
    private record ErrorResponse(String message) {}

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
            String materialType,
            java.math.BigDecimal weightKg
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
            String materialType,
            java.math.BigDecimal weightKg
    ) {}

    public record UpdateMaterialRequest(
            String materialCode,
            String description,
            String unitType,
            String storageType,
            String materialType,
            java.math.BigDecimal weightKg
    ) {}
}
