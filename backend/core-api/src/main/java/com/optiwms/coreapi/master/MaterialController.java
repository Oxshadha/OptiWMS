package com.optiwms.coreapi.master;

import com.optiwms.coreapp.imports.CsvImportService;
import com.optiwms.coreapp.master.MaterialDimensionImportService;
import com.optiwms.coreapi.config.ReferenceDataCacheSupport;
import com.optiwms.coreapp.master.MaterialService;
import com.optiwms.coreapp.master.SupplierMaterialService;
import com.optiwms.infra.inventory.InventoryItemRepository;
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
import java.math.BigDecimal;

@RestController
@RequestMapping("/api/master/materials")
public class MaterialController {

    private final MaterialService materialService;
    private final SupplierMaterialService supplierMaterialService;
    private final CsvImportService csvImportService;
    private final MaterialDimensionImportService dimensionImportService;
    private final InventoryItemRepository inventoryItemRepository;

    public MaterialController(
            MaterialService materialService,
            SupplierMaterialService supplierMaterialService,
            CsvImportService csvImportService,
            MaterialDimensionImportService dimensionImportService,
            InventoryItemRepository inventoryItemRepository) {
        this.materialService = materialService;
        this.supplierMaterialService = supplierMaterialService;
        this.csvImportService = csvImportService;
        this.dimensionImportService = dimensionImportService;
        this.inventoryItemRepository = inventoryItemRepository;
    }

    @GetMapping
    public ResponseEntity<List<MaterialDto>> list(
            @RequestParam(required = false) String materialType,
            @RequestParam(required = false) UUID supplierId,
            @RequestParam(defaultValue = "false") boolean includeLegacy,
            @NonNull WebRequest webRequest) {
        var materials = supplierId != null
                ? supplierMaterialService.getMaterialsForSupplier(supplierId, materialType)
                : (includeLegacy
                        ? (materialType != null
                                ? materialService.findByMaterialType(materialType)
                                : materialService.listAll())
                        : (materialType != null
                                ? materialService.findOperationalByMaterialType(materialType)
                                : materialService.listOperational()));
        var data = materials.stream().map(this::toMaterialDto).toList();
        return ReferenceDataCacheSupport.ok(
                webRequest,
                data,
                "materials",
                materialType,
                supplierId,
                includeLegacy,
                data);
    }

    @GetMapping("/paged")
    public ResponseEntity<PagedMaterialResponse> listPaged(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "materialCode") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir,
            @RequestParam(required = false) String materialType,
            @RequestParam(required = false) UUID supplierId,
            @RequestParam(defaultValue = "false") boolean includeLegacy,
            @RequestParam(required = false) String q) {
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
                        .filter(m -> contains(m.getMaterialCode(), query) ||
                                contains(m.getDescription(), query) ||
                                contains(m.getUnitType(), query) ||
                                contains(m.getStorageType(), query) ||
                                contains(m.getMaterialType(), query))
                        .toList();
            }
            filtered.sort((a, b) -> compareMaterial(a, b, safeSortBy, direction));
            int from = Math.min(safePage * safeSize, filtered.size());
            int to = Math.min(from + safeSize, filtered.size());
            materialPage = new PageImpl<>(filtered.subList(from, to), PageRequest.of(safePage, safeSize),
                    filtered.size());
        } else {
            materialPage = materialService.findPaged(
                    materialType,
                    q,
                    includeLegacy,
                    PageRequest.of(safePage, safeSize, Sort.by(direction, safeSortBy).and(Sort.by(direction, "id"))));
        }

        var data = materialPage.getContent().stream().map(this::toMaterialDto).toList();

        return ResponseEntity.ok(new PagedMaterialResponse(
                data,
                materialPage.getNumber(),
                materialPage.getSize(),
                materialPage.getTotalElements(),
                materialPage.getTotalPages()));
    }

    @GetMapping("/summary")
    public ResponseEntity<MaterialSummaryResponse> summary() {
        var materials = materialService.listOperational();
        long dimensioned = materials.stream().filter(this::hasCompleteDimensions).count();
        long rawMaterials = materials.stream()
                .filter(material -> "raw_material".equals(material.getMaterialType()))
                .count();
        long products = materials.stream()
                .filter(material -> "product".equals(material.getMaterialType()))
                .count();
        long packaging = materials.stream()
                .filter(material -> "packaging_material".equals(material.getMaterialType()))
                .count();
        return ResponseEntity.ok(new MaterialSummaryResponse(
                materials.size(), dimensioned, rawMaterials, products, packaging));
    }

    @GetMapping("/{id}")
    public ResponseEntity<MaterialDto> getById(@PathVariable java.util.UUID id) {
        try {
            var material = materialService.findById(id);
            return ResponseEntity.ok(toMaterialDto(material));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/code/{materialCode}")
    public ResponseEntity<MaterialDto> getByCode(@PathVariable String materialCode) {
        try {
            var material = materialService.findByCode(materialCode);
            return ResponseEntity.ok(toMaterialDto(material));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/{id}/ordering-profile")
    public ResponseEntity<?> getOrderingProfile(
            @PathVariable UUID id,
            @RequestParam(required = false) UUID supplierId,
            @RequestParam(required = false) UUID warehouseId) {
        try {
            var material = materialService.findById(id);
            var supplierRule = supplierMaterialService.findRule(supplierId, id).orElse(null);
            BigDecimal moq = firstPositive(
                    supplierRule != null ? supplierRule.minimumOrderQuantity() : null,
                    material.getMinOrderQuantity(),
                    BigDecimal.ONE);
            BigDecimal unitsPerHandlingUnit = firstPositive(
                    supplierRule != null ? supplierRule.unitsPerHandlingUnit() : null,
                    material.getUnitsPerHandlingUnit(),
                    material.getPalletSpaces(),
                    BigDecimal.ONE);
            BigDecimal orderMultiple = firstPositive(
                    supplierRule != null ? supplierRule.orderMultiple() : null,
                    material.getOrderMultiple(),
                    unitsPerHandlingUnit,
                    BigDecimal.ONE);
            BigDecimal warehouseAvailableQuantity = null;
            if (warehouseId != null) {
                warehouseAvailableQuantity = inventoryItemRepository
                        .summarizeByWarehouseId(warehouseId)
                        .stream()
                        .filter(summary -> id.equals(summary.getMaterialId()))
                        .map(InventoryItemRepository.InventoryMaterialSummary::getAvailableQuantity)
                        .findFirst()
                        .orElse(BigDecimal.ZERO);
            }
            return ResponseEntity.ok(new OrderingProfileDto(
                    toMaterialDto(material),
                    supplierRule != null ? supplierRule.minimumOrderQuantity() : null,
                    supplierRule != null ? supplierRule.orderMultiple() : null,
                    supplierRule != null ? supplierRule.unitsPerHandlingUnit() : null,
                    supplierRule != null ? supplierRule.leadTimeDays() : null,
                    supplierRule != null && supplierRule.preferred(),
                    moq,
                    orderMultiple,
                    unitsPerHandlingUnit,
                    warehouseAvailableQuantity));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse(e.getMessage()));
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
            material.setMinOrderQuantity(request.minOrderQuantity());
            material.setHandlingUnitType(request.handlingUnitType());
            material.setUnitsPerHandlingUnit(request.unitsPerHandlingUnit());
            material.setOrderMultiple(request.orderMultiple());

            var created = materialService.create(material);
            return ResponseEntity.ok(toMaterialDto(created));
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
            material.setMinOrderQuantity(request.minOrderQuantity());
            material.setHandlingUnitType(request.handlingUnitType());
            material.setUnitsPerHandlingUnit(request.unitsPerHandlingUnit());
            material.setOrderMultiple(request.orderMultiple());

            var updated = materialService.update(id, material);
            return ResponseEntity.ok(toMaterialDto(updated));
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
                } else if (message != null && (message.contains("Cannot delete") || message.contains("used in")
                        || message.contains("referenced"))) {
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
    private record ErrorResponse(String message) {
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
                    result.getErrors()));
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
                    result.getErrors()));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(new ImportResponse(0, 1, List.of("Error reading file: " + e.getMessage())));
        }
    }

    @PostMapping("/import-dimensions")
    public ResponseEntity<DimensionImportResponse> importDimensionsCsv(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(new DimensionImportResponse(0, 0, 1, "File is empty"));
        }
        try {
            MaterialDimensionImportService.ImportResult result =
                    dimensionImportService.importCsv(file.getInputStream());
            return ResponseEntity.ok(new DimensionImportResponse(
                    result.updated(),
                    result.skipped(),
                    result.errors(),
                    result.message()));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(new DimensionImportResponse(0, 0, 1, "Error reading file: " + e.getMessage()));
        }
    }

    public record DimensionImportResponse(
            int updated,
            int skipped,
            int errors,
            String message) {
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
            Integer unitsPerPallet,
            Integer maxStackHeight,
            java.math.BigDecimal maxPalletWeightKg,
            java.math.BigDecimal minOrderQuantity,
            String handlingUnitType,
            java.math.BigDecimal unitsPerHandlingUnit,
            java.math.BigDecimal orderMultiple) {
    }

    public record OrderingProfileDto(
            MaterialDto material,
            BigDecimal supplierMinimumOrderQuantity,
            BigDecimal supplierOrderMultiple,
            BigDecimal supplierUnitsPerHandlingUnit,
            Integer supplierLeadTimeDays,
            Boolean preferred,
            BigDecimal effectiveMinimumOrderQuantity,
            BigDecimal effectiveOrderMultiple,
            BigDecimal effectiveUnitsPerHandlingUnit,
            BigDecimal warehouseAvailableQuantity) {
    }

    public record ImportResponse(
            int successCount,
            int errorCount,
            List<String> errors) {
    }

    public record PagedMaterialResponse(
            List<MaterialDto> data,
            int page,
            int size,
            long totalElements,
            int totalPages) {
    }

    public record MaterialSummaryResponse(
            long total,
            long dimensioned,
            long rawMaterials,
            long products,
            long packaging) {
    }

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
            java.math.BigDecimal maxPalletWeightKg,
            java.math.BigDecimal minOrderQuantity,
            String handlingUnitType,
            java.math.BigDecimal unitsPerHandlingUnit,
            java.math.BigDecimal orderMultiple) {
    }

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
            java.math.BigDecimal maxPalletWeightKg,
            java.math.BigDecimal minOrderQuantity,
            String handlingUnitType,
            java.math.BigDecimal unitsPerHandlingUnit,
            java.math.BigDecimal orderMultiple) {
    }

    private MaterialDto toMaterialDto(com.optiwms.domain.master.Material material) {
        return new MaterialDto(
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
                material.getUnitsPerPallet(),
                material.getMaxStackHeight(),
                material.getMaxPalletWeightKg(),
                material.getMinOrderQuantity(),
                material.getHandlingUnitType(),
                material.getUnitsPerHandlingUnit(),
                material.getOrderMultiple());
    }

    private boolean hasCompleteDimensions(com.optiwms.domain.master.Material material) {
        return isPositive(material.getLengthCm())
                && isPositive(material.getWidthCm())
                && isPositive(material.getHeightCm())
                && isPositive(material.getWeightKg())
                && isPositive(material.getVolumeCm3())
                && isPositive(material.getPalletSpaces());
    }

    private boolean isPositive(BigDecimal value) {
        return value != null && value.compareTo(BigDecimal.ZERO) > 0;
    }

    private BigDecimal firstPositive(BigDecimal... values) {
        for (BigDecimal value : values) {
            if (value != null && value.compareTo(BigDecimal.ZERO) > 0) {
                return value;
            }
        }
        return BigDecimal.ONE;
    }

    private String sanitizeSortBy(String sortBy) {
        if (sortBy == null || sortBy.isBlank())
            return "createdAt";
        return switch (sortBy) {
            case "id", "materialCode", "description", "unitType", "storageType", "materialType", "createdAt" -> sortBy;
            default -> "createdAt";
        };
    }

    private boolean contains(String value, String query) {
        return value != null && value.toLowerCase().contains(query);
    }

    private int compareMaterial(com.optiwms.domain.master.Material a, com.optiwms.domain.master.Material b,
            String sortBy, Sort.Direction direction) {
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
