package com.optiwms.coreapp.master;

import com.optiwms.domain.master.Supplier;
import com.optiwms.infra.master.SupplierEntity;
import com.optiwms.infra.master.SupplierRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class SupplierService {

    private final SupplierRepository repository;

    public SupplierService(SupplierRepository repository) {
        this.repository = repository;
    }

    public List<Supplier> listAll() {
        return repository.findAll().stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public Optional<Supplier> findById(UUID id) {
        return repository.findById(id).map(this::toDomain);
    }

    @Transactional
    public Supplier createOrUpdate(Supplier supplier) {
        SupplierEntity entity;
        if (supplier.getId() != null) {
            entity = repository.findById(supplier.getId())
                    .orElseThrow(() -> new IllegalArgumentException("Supplier not found with ID: " + supplier.getId()));
        } else {
            entity = repository.findByCode(supplier.getCode())
                    .orElse(new SupplierEntity());
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
        entity.setStatus(supplier.getStatus() != null ? supplier.getStatus() : "active");

        SupplierEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public void deleteById(UUID id) {
        repository.deleteById(id);
    }

    private Supplier toDomain(SupplierEntity entity) {
        Supplier s = new Supplier();
        s.setId(entity.getId());
        s.setCode(entity.getCode());
        s.setName(entity.getName());
        s.setContactPerson(entity.getContactPerson());
        s.setEmail(entity.getEmail());
        s.setPhone(entity.getPhone());
        s.setAddress(entity.getAddress());
        s.setCountry(entity.getCountry());
        s.setLeadTimeDays(entity.getLeadTimeDays());
        s.setRating(entity.getRating());
        s.setStatus(entity.getStatus());
        s.setCreatedAt(entity.getCreatedAt());
        return s;
    }
}

