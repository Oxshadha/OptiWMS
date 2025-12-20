package com.optiwms.coreapi.master;

import com.optiwms.coreapp.master.SupplierService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/suppliers")
public class SupplierController {

    private final SupplierService service;

    public SupplierController(SupplierService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<SupplierDto>> list() {
        var data = service.listAll().stream()
                .map(s -> new SupplierDto(
                        s.getId(),
                        s.getCode(),
                        s.getName(),
                        s.getContactPerson(),
                        s.getEmail(),
                        s.getPhone(),
                        s.getAddress(),
                        s.getCountry(),
                        s.getLeadTimeDays(),
                        s.getRating(),
                        s.getStatus()
                ))
                .toList();
        return ResponseEntity.ok(data);
    }

    @GetMapping("/{id}")
    public ResponseEntity<SupplierDto> getById(@PathVariable java.util.UUID id) {
        try {
            var supplier = service.findById(id);
            return ResponseEntity.ok(new SupplierDto(
                    supplier.getId(),
                    supplier.getCode(),
                    supplier.getName(),
                    supplier.getContactPerson(),
                    supplier.getEmail(),
                    supplier.getPhone(),
                    supplier.getAddress(),
                    supplier.getCountry(),
                    supplier.getLeadTimeDays(),
                    supplier.getRating(),
                    supplier.getStatus()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<SupplierDto> create(@RequestBody CreateSupplierRequest request) {
        try {
            var supplier = new com.optiwms.domain.master.Supplier();
            supplier.setCode(request.code());
            supplier.setName(request.name());
            supplier.setContactPerson(request.contactPerson());
            supplier.setEmail(request.email());
            supplier.setPhone(request.phone());
            supplier.setAddress(request.address());
            supplier.setCountry(request.country());
            supplier.setLeadTimeDays(request.leadTimeDays());
            supplier.setRating(request.rating());
            supplier.setStatus(request.status());

            var created = service.create(supplier);
            return ResponseEntity.ok(new SupplierDto(
                    created.getId(),
                    created.getCode(),
                    created.getName(),
                    created.getContactPerson(),
                    created.getEmail(),
                    created.getPhone(),
                    created.getAddress(),
                    created.getCountry(),
                    created.getLeadTimeDays(),
                    created.getRating(),
                    created.getStatus()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<SupplierDto> update(@PathVariable java.util.UUID id, @RequestBody UpdateSupplierRequest request) {
        try {
            var supplier = new com.optiwms.domain.master.Supplier();
            supplier.setCode(request.code());
            supplier.setName(request.name());
            supplier.setContactPerson(request.contactPerson());
            supplier.setEmail(request.email());
            supplier.setPhone(request.phone());
            supplier.setAddress(request.address());
            supplier.setCountry(request.country());
            supplier.setLeadTimeDays(request.leadTimeDays());
            supplier.setRating(request.rating());
            supplier.setStatus(request.status());

            var updated = service.update(id, supplier);
            return ResponseEntity.ok(new SupplierDto(
                    updated.getId(),
                    updated.getCode(),
                    updated.getName(),
                    updated.getContactPerson(),
                    updated.getEmail(),
                    updated.getPhone(),
                    updated.getAddress(),
                    updated.getCountry(),
                    updated.getLeadTimeDays(),
                    updated.getRating(),
                    updated.getStatus()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable java.util.UUID id) {
        try {
            service.delete(id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    public record SupplierDto(
            java.util.UUID id,
            String code,
            String name,
            String contactPerson,
            String email,
            String phone,
            String address,
            String country,
            Integer leadTimeDays,
            java.math.BigDecimal rating,
            String status
    ) {}

    public record CreateSupplierRequest(
            String code,
            String name,
            String contactPerson,
            String email,
            String phone,
            String address,
            String country,
            Integer leadTimeDays,
            java.math.BigDecimal rating,
            String status
    ) {}

    public record UpdateSupplierRequest(
            String code,
            String name,
            String contactPerson,
            String email,
            String phone,
            String address,
            String country,
            Integer leadTimeDays,
            java.math.BigDecimal rating,
            String status
    ) {}
}

