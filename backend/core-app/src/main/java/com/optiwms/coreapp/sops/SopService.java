package com.optiwms.coreapp.sops;

import com.optiwms.domain.sops.Sop;
import com.optiwms.infra.sops.SopEntity;
import com.optiwms.infra.sops.SopRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class SopService {

    private final SopRepository repository;

    public SopService(SopRepository repository) {
        this.repository = repository;
    }

    public List<Sop> listAll(String category, String status) {
        List<SopEntity> entities;
        if (category != null && !category.isBlank() && status != null && !status.isBlank()) {
            entities = repository.findByCategoryIgnoreCaseAndStatusIgnoreCaseOrderByUpdatedAtDesc(category, status);
        } else if (category != null && !category.isBlank()) {
            entities = repository.findByCategoryIgnoreCaseOrderByUpdatedAtDesc(category);
        } else if (status != null && !status.isBlank()) {
            entities = repository.findByStatusIgnoreCaseOrderByUpdatedAtDesc(status);
        } else {
            entities = repository.findAllByOrderByUpdatedAtDesc();
        }

        return entities.stream().map(this::toDomain).collect(Collectors.toList());
    }

    public Sop findById(UUID id) {
        return repository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("SOP not found: " + id));
    }

    @Transactional
    public Sop create(Sop sop) {
        SopEntity saved = repository.save(toEntity(sop, new SopEntity()));
        return toDomain(saved);
    }

    @Transactional
    public Sop update(UUID id, Sop sop) {
        SopEntity existing = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("SOP not found: " + id));

        SopEntity saved = repository.save(toEntity(sop, existing));
        return toDomain(saved);
    }

    @Transactional
    public void deleteById(UUID id) {
        if (!repository.existsById(id)) {
            throw new RuntimeException("SOP not found: " + id);
        }
        repository.deleteById(id);
    }

    private Sop toDomain(SopEntity entity) {
        Sop sop = new Sop();
        sop.setId(entity.getId());
        sop.setTitle(entity.getTitle());
        sop.setCategory(entity.getCategory());
        sop.setContent(entity.getContent());
        sop.setVersion(entity.getVersion());
        sop.setStatus(entity.getStatus());
        sop.setCreatedBy(entity.getCreatedBy());
        sop.setApplicableRoles(parseRoles(entity.getApplicableRoles()));
        sop.setCreatedAt(entity.getCreatedAt());
        sop.setUpdatedAt(entity.getUpdatedAt());
        return sop;
    }

    private SopEntity toEntity(Sop domain, SopEntity entity) {
        entity.setTitle(domain.getTitle());
        entity.setCategory(domain.getCategory());
        entity.setContent(domain.getContent());
        entity.setVersion(domain.getVersion());
        entity.setStatus(domain.getStatus());
        entity.setCreatedBy(domain.getCreatedBy());
        entity.setApplicableRoles(stringifyRoles(domain.getApplicableRoles()));
        return entity;
    }

    private List<String> parseRoles(String applicableRoles) {
        if (applicableRoles == null || applicableRoles.isBlank()) {
            return Collections.emptyList();
        }
        return Arrays.stream(applicableRoles.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .collect(Collectors.toList());
    }

    private String stringifyRoles(List<String> roles) {
        if (roles == null || roles.isEmpty()) {
            return null;
        }
        return roles.stream()
                .filter(role -> role != null && !role.isBlank())
                .map(String::trim)
                .collect(Collectors.joining(","));
    }
}
