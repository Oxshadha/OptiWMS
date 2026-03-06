package com.optiwms.coreapi.master;

import com.optiwms.coreapp.master.CustomerService;
import com.optiwms.coreapi.config.ReferenceDataCacheSupport;
import com.optiwms.domain.master.Customer;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.request.WebRequest;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/master/customers")
public class CustomerController {

    private final CustomerService service;

    public CustomerController(CustomerService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<CustomerDto>> list(WebRequest webRequest) {
        var data = service.listAll().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ReferenceDataCacheSupport.ok(webRequest, data, "customers", data);
    }

    @GetMapping("/paged")
    public ResponseEntity<PagedCustomerResponse> listPaged(
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

        Page<Customer> customerPage = service.findPaged(
                status,
                q,
                PageRequest.of(safePage, safeSize, Sort.by(direction, safeSortBy).and(Sort.by(direction, "id")))
        );

        List<CustomerDto> data = customerPage.getContent().stream().map(this::toDto).toList();
        return ResponseEntity.ok(new PagedCustomerResponse(
                data,
                customerPage.getNumber(),
                customerPage.getSize(),
                customerPage.getTotalElements(),
                customerPage.getTotalPages()
        ));
    }

    @GetMapping("/{id}")
    public ResponseEntity<CustomerDto> getCustomerById(@PathVariable UUID id) {
        return service.findById(id)
                .map(this::toDto)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<CustomerDto> createCustomer(@RequestBody CustomerDto customerDto) {
        Customer customer = toDomain(customerDto);
        Customer created = service.createOrUpdate(customer);
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(created));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CustomerDto> updateCustomer(@PathVariable UUID id, @RequestBody CustomerDto customerDto) {
        Customer customer = toDomain(customerDto);
        customer.setId(id);
        Customer updated = service.createOrUpdate(customer);
        return ResponseEntity.ok(toDto(updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCustomer(@PathVariable UUID id) {
        service.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private Customer toDomain(CustomerDto dto) {
        Customer c = new Customer();
        c.setId(dto.id());
        c.setCode(dto.code());
        c.setName(dto.name());
        c.setEmail(dto.email());
        c.setPhone(dto.phone());
        c.setAddress(dto.address());
        c.setCity(dto.city());
        c.setCountry(dto.country());
        c.setStatus(dto.status());
        return c;
    }

    private CustomerDto toDto(Customer domain) {
        return new CustomerDto(
                domain.getId(),
                domain.getCode(),
                domain.getName(),
                domain.getEmail(),
                domain.getPhone(),
                domain.getAddress(),
                domain.getCity(),
                domain.getCountry(),
                domain.getStatus()
        );
    }

    public record CustomerDto(
            UUID id,
            String code,
            String name,
            String email,
            String phone,
            String address,
            String city,
            String country,
            String status
    ) {}

    public record PagedCustomerResponse(
            List<CustomerDto> data,
            int page,
            int size,
            long totalElements,
            int totalPages
    ) {}

    private String sanitizeSortBy(String sortBy) {
        if (sortBy == null || sortBy.isBlank()) return "createdAt";
        return switch (sortBy) {
            case "id", "code", "name", "email", "phone", "city", "country", "status", "createdAt" -> sortBy;
            default -> "createdAt";
        };
    }
}
