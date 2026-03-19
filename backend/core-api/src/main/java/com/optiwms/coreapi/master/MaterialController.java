package com.optiwms.coreapi.master;

import com.optiwms.coreapp.imports.CsvImportService;
import com.optiwms.coreapi.config.ReferenceDataCacheSupport;
import com.optiwms.coreapp.master.MaterialService;
import com.optiwms.coreapp.master.SupplierMaterialService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.context.request.WebRequest;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/master/materials")
public class MaterialController {

    private final MaterialService materialService;
    private final SupplierMaterialService supplierMaterialService;
    private final CsvImportService csvImportService;

    public MaterialController(
            MaterialService materialService,
            SupplierMaterialService supplierMaterialService,
            CsvImportService csvImportService
    ) {
        this.materialService = materialService;
        this.supplierMaterialService = supplierMaterialService;
        this.csvImportService = csvImportService;
    }

    @GetMapping
    public ResponseEntity<List<MaterialDto>> list(
            @RequestParam(required = false) String materialType,
            @RequestParam(required = false) UUID supplierId,
            @NonNull WebRequest webRequest
    ) {
        var materials = supplierId != null
                ? supplierMaterialService.getMaterialsForSupplier(supplierId, materialType)
                : (materialType != null
                    ? materialService.findByMaterialType(materialType)
                    : materialService.listAll());
        var data = materials.stream()
                .map(m -> new MaterialDto(
                        m.getId(),
                        m.getMaterialCode(),
                        m.getDescription(),
                        m.getUnitType(),
                        m.getStorageType(),
                        m.getMaterialType(),
                        m.getLengthCm(),
                        m.getWidthCm(),
                        m.getHeightCm(),
                        m.getWeightKg(),
                        m.getVolumeCm3(),
                        m.getPalletSpaces(),
                        m.getMaxPalletWeightKg()))
                .toList();
        return ReferenceDataCacheSupport.ok(
                webRequest,
                data,
                "materials",
                materialType,
                supplierId,
                data
        );
    }

    @GetMapping("/paged")
    public ResponseEntity<PagedMaterialResponse> listPaged(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            @RequestParam(required = false) String materialType,
            @RequestParam(required = false) UUID supplierId,
            @RequestParam(required = false) String q
    ) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 200);
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDir) ? Sort.Direction.ASC : Sort.Direction.DESC;
        String safeSortBy = sanitizeSortBy(sortBy);

        Page<com.optiwms.domain.master.Material> materialPage;
        if (supplierId != null) {
            // Supplier filter currently served via supplier-material mapping API;
            // apply paging in memory for this branch.
            var supplierMaterials = supplierMaterialService.getMaterialsForSupplier(supplierId, materialType);
            List<com.optiwms.domain.master.Material> filtered = new ArrayList<>(supplierMaterials);
            if (q != null && !q.isBlank()) {
                String query = q.toLowerCase();
                filtered = filtered.stream()
                        .filter(m ->
                                contains(m.getMaterialCode(), query) ||
                                contains(m.getDescription(), query) ||
                                contains(m.getUnitType(), query) ||
                                contains(m.getStorageType(), query) ||
                                contains(m.getMaterialType(), query))
                        .toList();
            }
            filtered.sort((a, b) -> compareMaterial(a, b, safeSortBy, direction));
            int from = Math.min(safePage * safeSize, filtered.size());
            int to = Math.min(from + safeSize, filtered.size());
            materialPage = new PageImpl<>(filtered.subList(from, to), PageRequest.of(safePage, safeSize), filtered.size());
        } else {
            materialPage = materialService.findPaged(
                    materialType,
                    q,
                    PageRequest.of(safePage, safeSize, Sort.by(direction, safeSortBy).and(Sort.by(direction, "id")))
            );
        }

        var data = materialPage.getContent().stream()
                .map(m -> new MaterialDto(
                        m.getId(),
                        m.getMaterialCode(),
                        m.getDescription(),
                        m.getUnitType(),
                        m.getStorageType(),
                        m.getMaterialType(),
                        m.getLengthCm(),
                        m.getWidthCm(),
                        m.getHeightCm(),
                        m.getWeightKg(),
                        m.getVolumeCm3(),
                        m.getPalletSpaces(),
                        m.getMaxPalletWeightKg()))
                .toList();

        return ResponseEntity.ok(new PagedMaterialResponse(
                data,
                materialPage.getNumber(),
                materialPage.getSize(),
                materialPage.getTotalElements(),
                materialPage.getTotalPages()
        ));
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
                    material.getLengthCm(),
                    material.getWidthCm(),
                    material.getHeightCm(),
                    material.getWeightKg(),
                    material.getVolumeCm3(),
                    material.getPalletSpaces(),
                    material.getMaxPalletWeightKg()
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
                    material.getLengthCm(),
                    material.getWidthCm(),
                    material.getHeightCm(),
                    material.getWeightKg(),
                    material.getVolumeCm3(),
                    material.getPalletSpaces(),
                    material.getMaxPalletWeightKg()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody CreateMaterialRequest request) {
        try {
            var material = new com.optiwms.domain.master.Material();
            material.setMaterialCode(request.materialCode());
            material.setDescription(request.description());
            material.setUnitType(request.unitType());
            material.setStorageType(request.storageType());
            material.setMaterialType(request.materialType());
            material.setLengthCm(request.lengthCm());
            material.setWidthCm(request.widthCm());
            material.setHeightCm(request.heightCm());
            material.setWeightKg(request.weightKg());
            material.setVolumeCm3(request.volumeCm3());
            material.setPalletSpaces(request.palletSpaces());
            material.setMaxPalletWeightKg(request.maxPalletWeightKg());

            var created = materialService.create(material);
            return ResponseEntity.ok(new MaterialDto(
                    created.getId(),
                    created.getMaterialCode(),
                    created.getDescription(),
                    created.getUnitType(),
                    created.getStorageType(),
                    created.getMaterialType(),
                    created.getLengthCm(),
                    created.getWidthCm(),
                    created.getHeightCm(),
                    created.getWeightKg(),
                    created.getVolumeCm3(),
                    created.getPalletSpaces(),
                    created.getMaxPalletWeightKg()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse(e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable java.util.UUID id, @RequestBody UpdateMaterialRequest request) {
        try {
            var material = new com.optiwms.domain.master.Material();
            material.setMaterialCode(request.materialCode());
            material.setDescription(request.description());
            material.setUnitType(request.unitType());
            material.setStorageType(request.storageType());
            material.setMaterialType(request.materialType());
            material.setLengthCm(request.lengthCm());
            material.setWidthCm(request.widthCm());
            material.setHeightCm(request.heightCm());
            material.setWeightKg(request.weightKg());
            material.setVolumeCm3(request.volumeCm3());
            material.setPalletSpaces(request.palletSpaces());
            material.setMaxPalletWeightKg(request.maxPalletWeightKg());

            var updated = materialService.update(id, material);
            return ResponseEntity.ok(new MaterialDto(
                    updated.getId(),
                    updated.getMaterialCode(),
                    updated.getDescription(),
                    updated.getUnitType(),
                    updated.getStorageType(),
                    updated.getMaterialType(),
                    updated.getLengthCm(),
                    updated.getWidthCm(),
                    updated.getHeightCm(),
                    updated.getWeightKg(),
                    updated.getVolumeCm3(),
                    updated.getPalletSpaces(),
                    updated.getMaxPalletWeightKg()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse(e.getMessage()));
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
            java.math.BigDecimal lengthCm,
            java.math.BigDecimal widthCm,
            java.math.BigDecimal heightCm,
            java.math.BigDecimal weightKg,
            java.math.BigDecimal volumeCm3,
            java.math.BigDecimal palletSpaces,
            java.math.BigDecimal maxPalletWeightKg
    ) {}

    public record ImportResponse(
            int successCount,
            int errorCount,
            List<String> errors
    ) {}

    public record PagedMaterialResponse(
            List<MaterialDto> data,
            int page,
            int size,
            long totalElements,
            int totalPages
    ) {}

    public record CreateMaterialRequest(
            String materialCode,
            String description,
            String unitType,
            String storageType,
            String materialType,
            java.math.BigDecimal lengthCm,
            java.math.BigDecimal widthCm,
            java.math.BigDecimal heightCm,
            java.math.BigDecimal weightKg,
            java.math.BigDecimal volumeCm3,
            java.math.BigDecimal palletSpaces,
            java.math.BigDecimal maxPalletWeightKg
    ) {}

    public record UpdateMaterialRequest(
            String materialCode,
            String description,
            String unitType,
            String storageType,
            String materialType,
            java.math.BigDecimal lengthCm,
            java.math.BigDecimal widthCm,
            java.math.BigDecimal heightCm,
            java.math.BigDecimal weightKg,
            java.math.BigDecimal volumeCm3,
            java.math.BigDecimal palletSpaces,
            java.math.BigDecimal maxPalletWeightKg
    ) {}

    private String sanitizeSortBy(String sortBy) {
        if (sortBy == null || sortBy.isBlank()) return "createdAt";
        return switch (sortBy) {
            case "id", "materialCode", "description", "unitType", "storageType", "materialType", "createdAt" -> sortBy;
            default -> "createdAt";
        };
    }

    private boolean contains(String value, String query) {
        return value != null && value.toLowerCase().contains(query);
    }

    private int compareMaterial(com.optiwms.domain.master.Material a, com.optiwms.domain.master.Material b, String sortBy, Sort.Direction direction) {
        String av;
        String bv;
        switch (sortBy) {
            case "materialCode" -> {
                av = safe(a.getMaterialCode());
                bv = safe(b.getMaterialCode());
            }
            case "description" -> {
                av = safe(a.getDescription());
                bv = safe(b.getDescription());
            }
            case "unitType" -> {
                av = safe(a.getUnitType());
                bv = safe(b.getUnitType());
            }
            case "storageType" -> {
                av = safe(a.getStorageType());
                bv = safe(b.getStorageType());
            }
            case "materialType" -> {
                av = safe(a.getMaterialType());
                bv = safe(b.getMaterialType());
            }
            default -> {
                av = a.getId() != null ? a.getId().toString() : "";
                bv = b.getId() != null ? b.getId().toString() : "";
            }
        }
        int cmp = av.compareToIgnoreCase(bv);
        if (cmp == 0) {
            String aid = a.getId() != null ? a.getId().toString() : "";
            String bid = b.getId() != null ? b.getId().toString() : "";
            cmp = aid.compareToIgnoreCase(bid);
        }
        return direction == Sort.Direction.ASC ? cmp : -cmp;
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }
}
