package com.optiwms.coreapp.master;

import com.optiwms.domain.master.Customer;
import com.optiwms.infra.master.CustomerEntity;
import com.optiwms.infra.master.CustomerRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class CustomerService {

    private final CustomerRepository repository;

    public CustomerService(CustomerRepository repository) {
        this.repository = repository;
    }

    public List<Customer> listAll() {
        return repository.findAll().stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public Optional<Customer> findById(UUID id) {
        return repository.findById(id).map(this::toDomain);
    }

    public Page<Customer> findPaged(String status, String query, Pageable pageable) {
        Specification<CustomerEntity> spec = (root, cq, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (status != null && !status.isBlank()) {
                predicates.add(cb.equal(cb.lower(root.get("status")), status.toLowerCase()));
            }
            if (query != null && !query.isBlank()) {
                String pattern = "%" + query.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("code")), pattern),
                        cb.like(cb.lower(root.get("name")), pattern),
                        cb.like(cb.lower(root.get("email")), pattern),
                        cb.like(cb.lower(root.get("phone")), pattern),
                        cb.like(cb.lower(root.get("city")), pattern),
                        cb.like(cb.lower(root.get("country")), pattern)
                ));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        return repository.findAll(spec, pageable).map(this::toDomain);
    }

    @Transactional
    public Customer createOrUpdate(Customer customer) {
        CustomerEntity entity;
        if (customer.getId() != null) {
            entity = repository.findById(customer.getId())
                    .orElseThrow(() -> new IllegalArgumentException("Customer not found with ID: " + customer.getId()));
        } else {
            entity = repository.findByCode(customer.getCode())
                    .orElse(new CustomerEntity());
        }

        entity.setCode(customer.getCode());
        entity.setName(customer.getName());
        entity.setEmail(customer.getEmail());
        entity.setPhone(customer.getPhone());
        entity.setAddress(customer.getAddress());
        entity.setCity(customer.getCity());
        entity.setCountry(customer.getCountry() != null ? customer.getCountry() : "Sri Lanka");
        entity.setStatus(customer.getStatus() != null ? customer.getStatus() : "active");

        CustomerEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public void deleteById(UUID id) {
        repository.deleteById(id);
    }

    private Customer toDomain(CustomerEntity entity) {
        Customer c = new Customer();
        c.setId(entity.getId());
        c.setCode(entity.getCode());
        c.setName(entity.getName());
        c.setEmail(entity.getEmail());
        c.setPhone(entity.getPhone());
        c.setAddress(entity.getAddress());
        c.setCity(entity.getCity());
        c.setCountry(entity.getCountry());
        c.setStatus(entity.getStatus());
        c.setCreatedAt(entity.getCreatedAt());
        return c;
    }
}
