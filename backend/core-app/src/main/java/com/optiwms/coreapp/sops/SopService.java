package com.optiwms.coreapp.sops;

import com.optiwms.domain.sops.Sop;
import com.optiwms.infra.sops.SopEntity;
import com.optiwms.infra.sops.SopRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
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
            entities = repository.findByCategoryAndStatusOrderByUpdatedAtDesc(category, status);
        } else if (category != null && !category.isBlank()) {
            entities = repository.findByCategoryOrderByUpdatedAtDesc(category);
        } else if (status != null && !status.isBlank()) {
            entities = repository.findByStatusOrderByUpdatedAtDesc(status);
        } else {
            entities = repository.findAllByOrderByUpdatedAtDesc();
        }

        return entities.stream().map(this::toDomain).collect(Collectors.toList());
    }

    public Sop findById(UUID id) {
        return repository.findById(id).map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("SOP not found: " + id));
    }

    @Transactional
    public Sop create(Sop sop) {
        SopEntity entity = new SopEntity();
        entity.setTitle(sop.getTitle());
        entity.setCategory(sop.getCategory());
        entity.setContent(sop.getContent());
        entity.setVersion(sop.getVersion());
        entity.setStatus(sop.getStatus());
        entity.setCreatedBy(sop.getCreatedBy());
        entity.setApplicableRoles(serializeRoles(sop.getApplicableRoles()));
        return toDomain(repository.save(entity));
    }

    @Transactional
    public Sop update(UUID id, Sop sop) {
        SopEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("SOP not found: " + id));

        if (sop.getTitle() != null) entity.setTitle(sop.getTitle());
        if (sop.getCategory() != null) entity.setCategory(sop.getCategory());
        if (sop.getContent() != null) entity.setContent(sop.getContent());
        if (sop.getVersion() != null) entity.setVersion(sop.getVersion());
        if (sop.getStatus() != null) entity.setStatus(sop.getStatus());
        if (sop.getCreatedBy() != null) entity.setCreatedBy(sop.getCreatedBy());
        if (sop.getApplicableRoles() != null) entity.setApplicableRoles(serializeRoles(sop.getApplicableRoles()));

        return toDomain(repository.save(entity));
    }

    @Transactional
    public void delete(UUID id) {
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
        sop.setApplicableRoles(deserializeRoles(entity.getApplicableRoles()));
        sop.setCreatedAt(entity.getCreatedAt());
        sop.setUpdatedAt(entity.getUpdatedAt());
        return sop;
    }

    private String serializeRoles(List<String> roles) {
        if (roles == null || roles.isEmpty()) return "[]";
        return "[" + roles.stream()
                .map(role -> "\"" + escapeJson(role) + "\"")
                .collect(Collectors.joining(",")) + "]";
    }

    private List<String> deserializeRoles(String rolesJson) {
        if (rolesJson == null || rolesJson.isBlank()) return Collections.emptyList();
        String trimmed = rolesJson.trim();
        if (trimmed.equals("[]")) return Collections.emptyList();
        if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return Collections.emptyList();

        String content = trimmed.substring(1, trimmed.length() - 1).trim();
        if (content.isEmpty()) return Collections.emptyList();

        List<String> roles = new ArrayList<>();
        for (String part : content.split(",")) {
            String role = part.trim();
            if (role.startsWith("\"") && role.endsWith("\"") && role.length() >= 2) {
                role = role.substring(1, role.length() - 1);
            }
            role = role.replace("\\\"", "\"").replace("\\\\", "\\");
            if (!role.isBlank()) {
                roles.add(role);
            }
        }
        return roles;
    }

    private String escapeJson(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
