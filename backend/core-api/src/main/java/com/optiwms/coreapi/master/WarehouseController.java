package com.optiwms.coreapi.master;

import com.optiwms.coreapp.master.WarehouseService;
import com.optiwms.coreapi.config.ReferenceDataCacheSupport;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.request.WebRequest;

import java.util.List;

@RestController
@RequestMapping("/api/master/warehouses")
public class WarehouseController {

    private final WarehouseService service;

    public WarehouseController(WarehouseService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<WarehouseDto>> list(WebRequest webRequest) {
        var data = service.listAll().stream()
                .map(w -> new WarehouseDto(
                        w.getId(),
                        w.getCode(),
                        w.getName(),
                        w.getAddress(),
                        w.getCity(),
                        w.getCountry(),
                        w.getContactPerson(),
                        w.getPhone(),
                        w.getEmail(),
                        w.getStatus()
                ))
                .toList();
        return ReferenceDataCacheSupport.ok(webRequest, data, "warehouses", data);
    }

    @GetMapping("/{id}")
    public ResponseEntity<WarehouseDto> getById(@PathVariable java.util.UUID id) {
        try {
            var warehouse = service.findById(id);
            return ResponseEntity.ok(new WarehouseDto(
                    warehouse.getId(),
                    warehouse.getCode(),
                    warehouse.getName(),
                    warehouse.getAddress(),
                    warehouse.getCity(),
                    warehouse.getCountry(),
                    warehouse.getContactPerson(),
                    warehouse.getPhone(),
                    warehouse.getEmail(),
                    warehouse.getStatus()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<WarehouseDto> create(@RequestBody CreateWarehouseRequest request) {
        try {
            var warehouse = new com.optiwms.domain.master.Warehouse();
            warehouse.setCode(request.code());
            warehouse.setName(request.name());
            warehouse.setAddress(request.address());
            warehouse.setCity(request.city());
            warehouse.setCountry(request.country());
            warehouse.setContactPerson(request.contactPerson());
            warehouse.setPhone(request.phone());
            warehouse.setEmail(request.email());
            warehouse.setStatus(request.status());

            var created = service.create(warehouse);
            return ResponseEntity.ok(new WarehouseDto(
                    created.getId(),
                    created.getCode(),
                    created.getName(),
                    created.getAddress(),
                    created.getCity(),
                    created.getCountry(),
                    created.getContactPerson(),
                    created.getPhone(),
                    created.getEmail(),
                    created.getStatus()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<WarehouseDto> update(@PathVariable java.util.UUID id, @RequestBody UpdateWarehouseRequest request) {
        try {
            var warehouse = new com.optiwms.domain.master.Warehouse();
            warehouse.setCode(request.code());
            warehouse.setName(request.name());
            warehouse.setAddress(request.address());
            warehouse.setCity(request.city());
            warehouse.setCountry(request.country());
            warehouse.setContactPerson(request.contactPerson());
            warehouse.setPhone(request.phone());
            warehouse.setEmail(request.email());
            warehouse.setStatus(request.status());

            var updated = service.update(id, warehouse);
            return ResponseEntity.ok(new WarehouseDto(
                    updated.getId(),
                    updated.getCode(),
                    updated.getName(),
                    updated.getAddress(),
                    updated.getCity(),
                    updated.getCountry(),
                    updated.getContactPerson(),
                    updated.getPhone(),
                    updated.getEmail(),
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

    public record WarehouseDto(
            java.util.UUID id,
            String code,
            String name,
            String address,
            String city,
            String country,
            String contactPerson,
            String phone,
            String email,
            String status
    ) {}

    public record CreateWarehouseRequest(
            String code,
            String name,
            String address,
            String city,
            String country,
            String contactPerson,
            String phone,
            String email,
            String status
    ) {}

    public record UpdateWarehouseRequest(
            String code,
            String name,
            String address,
            String city,
            String country,
            String contactPerson,
            String phone,
            String email,
            String status
    ) {}
}

