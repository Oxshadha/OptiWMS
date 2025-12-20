package com.optiwms.coreapp.master;

import com.optiwms.domain.master.Supplier;
import com.optiwms.infra.master.SupplierEntity;
import com.optiwms.infra.master.SupplierRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class SupplierService {

    private final SupplierRepository repository;

    public SupplierService(SupplierRepository repository) {
        this.repository = repository;
    }

    public List<Supplier> listAll() {
        return repository.findAll().stream().map(this::toDomain).collect(Collectors.toList());
    }

    public Supplier findById(UUID id) {
        return repository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Supplier not found: " + id));
    }

    @Transactional
    public Supplier create(Supplier supplier) {
        if (supplier.getCode() != null && repository.existsByCode(supplier.getCode())) {
            throw new RuntimeException("Supplier code already exists: " + supplier.getCode());
        }

        SupplierEntity entity = new SupplierEntity();
        entity.setCode(supplier.getCode());
        entity.setName(supplier.getName());
        entity.setContactPerson(supplier.getContactPerson());
        entity.setEmail(supplier.getEmail());
        entity.setPhone(supplier.getPhone());
        entity.setAddress(supplier.getAddress());
        entity.setCountry(supplier.getCountry());
        entity.setLeadTimeDays(supplier.getLeadTimeDays());
        entity.setRating(supplier.getRating());
        entity.setStatus(supplier.getStatus() != null ? supplier.getStatus() : "active");

        SupplierEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public Supplier update(UUID id, Supplier supplier) {
        SupplierEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Supplier not found: " + id));

        if (supplier.getCode() != null && !entity.getCode().equals(supplier.getCode())) {
            if (repository.existsByCode(supplier.getCode())) {
                throw new RuntimeException("Supplier code already exists: " + supplier.getCode());
            }
        }

        entity.setCode(supplier.getCode());
        entity.setName(supplier.getName());
        entity.setContactPerson(supplier.getContactPerson());
        entity.setEmail(supplier.getEmail());
        entity.setPhone(supplier.getPhone());
        entity.setAddress(supplier.getAddress());
        entity.setCountry(supplier.getCountry());
        entity.setLeadTimeDays(supplier.getLeadTimeDays());
        entity.setRating(supplier.getRating());
        entity.setStatus(supplier.getStatus());

        SupplierEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public void delete(UUID id) {
        if (!repository.existsById(id)) {
            throw new RuntimeException("Supplier not found: " + id);
        }
        repository.deleteById(id);
    }

    private Supplier toDomain(SupplierEntity entity) {
        Supplier supplier = new Supplier();
        supplier.setId(entity.getId());
        supplier.setCode(entity.getCode());
        supplier.setName(entity.getName());
        supplier.setContactPerson(entity.getContactPerson());
        supplier.setEmail(entity.getEmail());
        supplier.setPhone(entity.getPhone());
        supplier.setAddress(entity.getAddress());
        supplier.setCountry(entity.getCountry());
        supplier.setLeadTimeDays(entity.getLeadTimeDays());
        supplier.setRating(entity.getRating());
        supplier.setStatus(entity.getStatus());
        return supplier;
    }
}

