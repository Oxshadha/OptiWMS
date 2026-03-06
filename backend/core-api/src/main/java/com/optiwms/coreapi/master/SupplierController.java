package com.optiwms.coreapi.master;

import com.optiwms.coreapp.master.SupplierService;
import com.optiwms.coreapi.config.ReferenceDataCacheSupport;
import com.optiwms.coreapp.master.SupplierMaterialService;
import com.optiwms.domain.master.Material;
import com.optiwms.domain.master.Supplier;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.request.WebRequest;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/master/suppliers")
public class SupplierController {

    private final SupplierService service;
    private final SupplierMaterialService supplierMaterialService;

    public SupplierController(SupplierService service, SupplierMaterialService supplierMaterialService) {
        this.service = service;
        this.supplierMaterialService = supplierMaterialService;
    }

    @GetMapping
    public ResponseEntity<List<SupplierDto>> list(WebRequest webRequest) {
        var data = service.listAll().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ReferenceDataCacheSupport.ok(webRequest, data, "suppliers", data);
    }

    @GetMapping("/paged")
    public ResponseEntity<PagedSupplierResponse> listPaged(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String q
    ) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 200);
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDir) ? Sort.Direction.ASC : Sort.Direction.DESC;
        String safeSortBy = sanitizeSortBy(sortBy);

        Page<Supplier> supplierPage = service.findPaged(
                status,
                q,
                PageRequest.of(safePage, safeSize, Sort.by(direction, safeSortBy).and(Sort.by(direction, "id")))
        );

        List<SupplierDto> data = supplierPage.getContent().stream().map(this::toDto).toList();
        return ResponseEntity.ok(new PagedSupplierResponse(
                data,
                supplierPage.getNumber(),
                supplierPage.getSize(),
                supplierPage.getTotalElements(),
                supplierPage.getTotalPages()
        ));
    }

    @GetMapping("/{id}")
    public ResponseEntity<SupplierDto> getSupplierById(@PathVariable UUID id) {
        return service.findById(id)
                .map(this::toDto)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<SupplierDto> createSupplier(@RequestBody SupplierDto supplierDto) {
        Supplier supplier = toDomain(supplierDto);
        Supplier created = service.createOrUpdate(supplier);
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(created));
    }

    @PutMapping("/{id}")
    public ResponseEntity<SupplierDto> updateSupplier(@PathVariable UUID id, @RequestBody SupplierDto supplierDto) {
        Supplier supplier = toDomain(supplierDto);
        supplier.setId(id);
        Supplier updated = service.createOrUpdate(supplier);
        return ResponseEntity.ok(toDto(updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteSupplier(@PathVariable UUID id) {
        service.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/materials")
    public ResponseEntity<List<SupplierMaterialDto>> listSupplierMaterials(
            @PathVariable UUID id,
            @RequestParam(required = false) String materialType
    ) {
        List<Material> materials = supplierMaterialService.getMaterialsForSupplier(id, materialType);
        List<SupplierMaterialDto> data = materials.stream()
                .map(this::toSupplierMaterialDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(data);
    }

    @PutMapping("/{id}/materials")
    public ResponseEntity<Void> replaceSupplierMaterials(
            @PathVariable UUID id,
            @RequestBody ReplaceSupplierMaterialsRequest request
    ) {
        supplierMaterialService.replaceMaterials(id, request.materialIds());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/materials/{materialId}")
    public ResponseEntity<Void> linkSupplierMaterial(
            @PathVariable UUID id,
            @PathVariable UUID materialId
    ) {
        supplierMaterialService.linkMaterial(id, materialId);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @DeleteMapping("/{id}/materials/{materialId}")
    public ResponseEntity<Void> unlinkSupplierMaterial(
            @PathVariable UUID id,
            @PathVariable UUID materialId
    ) {
        supplierMaterialService.unlinkMaterial(id, materialId);
        return ResponseEntity.noContent().build();
    }

    private Supplier toDomain(SupplierDto dto) {
        Supplier s = new Supplier();
        s.setId(dto.id());
        s.setCode(dto.code());
        s.setName(dto.name());
        s.setContactPerson(dto.contactPerson());
        s.setEmail(dto.email());
        s.setPhone(dto.phone());
        s.setAddress(dto.address());
        s.setCountry(dto.country());
        s.setLeadTimeDays(dto.leadTimeDays());
        s.setRating(dto.rating() != null ? new BigDecimal(dto.rating()) : null);
        s.setStatus(dto.status());
        return s;
    }

    private SupplierDto toDto(Supplier domain) {
        return new SupplierDto(
                domain.getId(),
                domain.getCode(),
                domain.getName(),
                domain.getContactPerson(),
                domain.getEmail(),
                domain.getPhone(),
                domain.getAddress(),
                domain.getCountry(),
                domain.getLeadTimeDays(),
                domain.getRating() != null ? domain.getRating().toString() : null,
                domain.getStatus()
        );
    }

    private SupplierMaterialDto toSupplierMaterialDto(Material material) {
        return new SupplierMaterialDto(
                material.getId(),
                material.getMaterialCode(),
                material.getDescription(),
                material.getMaterialType()
        );
    }

    public record SupplierDto(
            UUID id,
            String code,
            String name,
            String contactPerson,
            String email,
            String phone,
            String address,
            String country,
            Integer leadTimeDays,
            String rating,
            String status
    ) {}

    public record SupplierMaterialDto(
            UUID id,
            String materialCode,
            String description,
            String materialType
    ) {}

    public record PagedSupplierResponse(
            List<SupplierDto> data,
            int page,
            int size,
            long totalElements,
            int totalPages
    ) {}

    public record ReplaceSupplierMaterialsRequest(
            List<UUID> materialIds
    ) {}

    private String sanitizeSortBy(String sortBy) {
        if (sortBy == null || sortBy.isBlank()) return "createdAt";
        return switch (sortBy) {
            case "id", "code", "name", "contactPerson", "email", "phone", "country", "leadTimeDays", "rating", "status", "createdAt" -> sortBy;
            default -> "createdAt";
        };
    }
}
