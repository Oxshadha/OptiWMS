package com.optiwms.coreapi.master;

import com.optiwms.coreapp.master.CustomerService;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {

    private final CustomerService service;

    public CustomerController(CustomerService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<CustomerDto>> list() {
        var data = service.listAll().stream()
                .map(c -> new CustomerDto(
                        c.getId(),
                        c.getCode(),
                        c.getName(),
                        c.getEmail(),
                        c.getPhone(),
                        c.getAddress(),
                        c.getCity(),
                        c.getCountry(),
                        c.getStatus()
                ))
                .toList();
        return ResponseEntity.ok(data);
    }

    @GetMapping("/{id}")
    public ResponseEntity<CustomerDto> getById(@PathVariable @NonNull java.util.UUID id) {
        try {
            var customer = service.findById(id);
            return ResponseEntity.ok(new CustomerDto(
                    customer.getId(),
                    customer.getCode(),
                    customer.getName(),
                    customer.getEmail(),
                    customer.getPhone(),
                    customer.getAddress(),
                    customer.getCity(),
                    customer.getCountry(),
                    customer.getStatus()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<CustomerDto> create(@RequestBody CreateCustomerRequest request) {
        try {
            var customer = new com.optiwms.domain.master.Customer();
            customer.setCode(request.code());
            customer.setName(request.name());
            customer.setEmail(request.email());
            customer.setPhone(request.phone());
            customer.setAddress(request.address());
            customer.setCity(request.city());
            customer.setCountry(request.country());
            customer.setStatus(request.status());

            var created = service.create(customer);
            return ResponseEntity.ok(new CustomerDto(
                    created.getId(),
                    created.getCode(),
                    created.getName(),
                    created.getEmail(),
                    created.getPhone(),
                    created.getAddress(),
                    created.getCity(),
                    created.getCountry(),
                    created.getStatus()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<CustomerDto> update(@PathVariable @NonNull java.util.UUID id, @RequestBody UpdateCustomerRequest request) {
        try {
            var customer = new com.optiwms.domain.master.Customer();
            customer.setCode(request.code());
            customer.setName(request.name());
            customer.setEmail(request.email());
            customer.setPhone(request.phone());
            customer.setAddress(request.address());
            customer.setCity(request.city());
            customer.setCountry(request.country());
            customer.setStatus(request.status());

            var updated = service.update(id, customer);
            return ResponseEntity.ok(new CustomerDto(
                    updated.getId(),
                    updated.getCode(),
                    updated.getName(),
                    updated.getEmail(),
                    updated.getPhone(),
                    updated.getAddress(),
                    updated.getCity(),
                    updated.getCountry(),
                    updated.getStatus()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable @NonNull java.util.UUID id) {
        try {
            service.delete(id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    public record CustomerDto(
            java.util.UUID id,
            String code,
            String name,
            String email,
            String phone,
            String address,
            String city,
            String country,
            String status
    ) {}

    public record CreateCustomerRequest(
            String code,
            String name,
            String email,
            String phone,
            String address,
            String city,
            String country,
            String status
    ) {}

    public record UpdateCustomerRequest(
            String code,
            String name,
            String email,
            String phone,
            String address,
            String city,
            String country,
            String status
    ) {}
}

