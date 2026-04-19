package com.optiwms.coreapi.planning;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.optiwms.infra.planning.BomAuditLogEntity;
import com.optiwms.infra.planning.BomAuditLogRepository;
import com.optiwms.infra.planning.BomComponentEntity;
import com.optiwms.infra.planning.BomComponentRepository;
import com.optiwms.infra.planning.BomHeaderEntity;
import com.optiwms.infra.planning.BomHeaderRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/planning/bom")
@PreAuthorize("hasAnyRole('ADMIN', 'WAREHOUSE_MANAGER')")
public class BomMasterController {

    private static final String ENTITY_TYPE_HEADER = "bom_header";
    private static final String ENTITY_TYPE_COMPONENT = "bom_component";

    private final BomHeaderRepository bomHeaderRepository;
    private final BomComponentRepository bomComponentRepository;
    private final BomAuditLogRepository bomAuditLogRepository;
    private final ObjectMapper objectMapper;

    public BomMasterController(
            BomHeaderRepository bomHeaderRepository,
            BomComponentRepository bomComponentRepository,
            BomAuditLogRepository bomAuditLogRepository,
            ObjectMapper objectMapper
    ) {
        this.bomHeaderRepository = bomHeaderRepository;
        this.bomComponentRepository = bomComponentRepository;
        this.bomAuditLogRepository = bomAuditLogRepository;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/headers")
    public ResponseEntity<List<BomHeaderDto>> listHeaders(
            @RequestParam(required = false) UUID parentMaterialId,
            @RequestParam(required = false) UUID warehouseId,
            @RequestParam(required = false) String status
    ) {
        List<BomHeaderEntity> headers;
        if (parentMaterialId != null) {
            headers = bomHeaderRepository.findByParentMaterialId(parentMaterialId);
        } else if (warehouseId != null) {
            headers = bomHeaderRepository.findByWarehouseId(warehouseId);
        } else if (status != null && !status.isBlank()) {
            headers = bomHeaderRepository.findByStatus(status.trim().toLowerCase());
        } else {
            headers = bomHeaderRepository.findAll();
        }

        List<BomHeaderDto> response = headers.stream()
                .map(this::toHeaderDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/headers/{id}")
    public ResponseEntity<BomHeaderDto> getHeader(@PathVariable UUID id) {
        return bomHeaderRepository.findById(id)
                .map(header -> ResponseEntity.ok(toHeaderDto(header)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/headers")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<BomHeaderDto> createHeader(
            @RequestBody CreateBomHeaderRequest request,
            Authentication authentication
    ) {
        BomHeaderEntity entity = new BomHeaderEntity();
        entity.setParentMaterialId(request.parentMaterialId());
        entity.setWarehouseId(request.warehouseId());
        entity.setVersion(defaultIfBlank(request.version(), "v1"));
        entity.setStatus(defaultIfBlank(request.status(), "active").toLowerCase());
        entity.setEffectiveFrom(request.effectiveFrom());
        entity.setEffectiveTo(request.effectiveTo());
        entity.setNotes(request.notes());

        BomHeaderEntity saved = bomHeaderRepository.save(entity);
        Map<String, Object> payload = new HashMap<>();
        payload.put("parent_material_id", saved.getParentMaterialId());
        payload.put("warehouse_id", saved.getWarehouseId());
        payload.put("version", saved.getVersion());
        payload.put("status", saved.getStatus());
        writeAudit("create", ENTITY_TYPE_HEADER, saved.getId(), actor(authentication), payload);

        return ResponseEntity.status(HttpStatus.CREATED).body(toHeaderDto(saved));
    }

    @PutMapping("/headers/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<BomHeaderDto> updateHeader(
            @PathVariable UUID id,
            @RequestBody UpdateBomHeaderRequest request,
            Authentication authentication
    ) {
        return bomHeaderRepository.findById(id)
                .map(entity -> {
                    if (request.status() != null) {
                        entity.setStatus(request.status().trim().toLowerCase());
                    }
                    if (request.effectiveFrom() != null) {
                        entity.setEffectiveFrom(request.effectiveFrom());
                    }
                    if (request.effectiveTo() != null) {
                        entity.setEffectiveTo(request.effectiveTo());
                    }
                    if (request.notes() != null) {
                        entity.setNotes(request.notes());
                    }
                    if (request.version() != null && !request.version().isBlank()) {
                        entity.setVersion(request.version().trim());
                    }
                    BomHeaderEntity saved = bomHeaderRepository.save(entity);
                    Map<String, Object> payload = new HashMap<>();
                    payload.put("status", saved.getStatus());
                    payload.put("effective_from", saved.getEffectiveFrom());
                    payload.put("effective_to", saved.getEffectiveTo());
                    writeAudit("update", ENTITY_TYPE_HEADER, saved.getId(), actor(authentication), payload);
                    return ResponseEntity.ok(toHeaderDto(saved));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/headers/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<Void> deleteHeader(@PathVariable UUID id, Authentication authentication) {
        if (!bomHeaderRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        bomComponentRepository.deleteByBomHeaderId(id);
        bomHeaderRepository.deleteById(id);
        writeAudit("delete", ENTITY_TYPE_HEADER, id, actor(authentication), Map.of("deleted", true));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/headers/{headerId}/components")
    public ResponseEntity<List<BomComponentDto>> listComponents(@PathVariable UUID headerId) {
        if (!bomHeaderRepository.existsById(headerId)) {
            return ResponseEntity.notFound().build();
        }
        List<BomComponentDto> response = bomComponentRepository.findByBomHeaderId(headerId)
                .stream()
                .map(this::toComponentDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/headers/{headerId}/components")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<BomComponentDto> createComponent(
            @PathVariable UUID headerId,
            @RequestBody CreateBomComponentRequest request,
            Authentication authentication
    ) {
        if (!bomHeaderRepository.existsById(headerId)) {
            return ResponseEntity.notFound().build();
        }
        BomComponentEntity entity = new BomComponentEntity();
        entity.setBomHeaderId(headerId);
        entity.setComponentMaterialId(request.componentMaterialId());
        entity.setComponentType(defaultIfBlank(request.componentType(), "raw_material").toLowerCase());
        entity.setQtyPerParent(request.qtyPerParent());
        entity.setScrapRate(request.scrapRate() == null ? BigDecimal.ZERO : request.scrapRate());
        entity.setLeadTimeDays(request.leadTimeDays());
        entity.setUom(request.uom());

        BomComponentEntity saved = bomComponentRepository.save(entity);
        Map<String, Object> payload = new HashMap<>();
        payload.put("bom_header_id", saved.getBomHeaderId());
        payload.put("component_material_id", saved.getComponentMaterialId());
        payload.put("component_type", saved.getComponentType());
        writeAudit("create", ENTITY_TYPE_COMPONENT, saved.getId(), actor(authentication), payload);

        return ResponseEntity.status(HttpStatus.CREATED).body(toComponentDto(saved));
    }

    @PutMapping("/components/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<BomComponentDto> updateComponent(
            @PathVariable UUID id,
            @RequestBody UpdateBomComponentRequest request,
            Authentication authentication
    ) {
        return bomComponentRepository.findById(id)
                .map(entity -> {
                    if (request.componentType() != null && !request.componentType().isBlank()) {
                        entity.setComponentType(request.componentType().trim().toLowerCase());
                    }
                    if (request.qtyPerParent() != null) {
                        entity.setQtyPerParent(request.qtyPerParent());
                    }
                    if (request.scrapRate() != null) {
                        entity.setScrapRate(request.scrapRate());
                    }
                    if (request.leadTimeDays() != null) {
                        entity.setLeadTimeDays(request.leadTimeDays());
                    }
                    if (request.uom() != null) {
                        entity.setUom(request.uom());
                    }
                    BomComponentEntity saved = bomComponentRepository.save(entity);
                    Map<String, Object> payload = new HashMap<>();
                    payload.put("component_type", saved.getComponentType());
                    payload.put("qty_per_parent", saved.getQtyPerParent());
                    payload.put("scrap_rate", saved.getScrapRate());
                    writeAudit("update", ENTITY_TYPE_COMPONENT, saved.getId(), actor(authentication), payload);
                    return ResponseEntity.ok(toComponentDto(saved));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/components/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteComponent(@PathVariable UUID id, Authentication authentication) {
        if (!bomComponentRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        bomComponentRepository.deleteById(id);
        writeAudit("delete", ENTITY_TYPE_COMPONENT, id, actor(authentication), Map.of("deleted", true));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/audit")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<BomAuditDto>> listAudit(
            @RequestParam(defaultValue = "100") int limit,
            @RequestParam(required = false) String entityType
    ) {
        int boundedLimit = Math.max(1, Math.min(limit, 500));
        List<BomAuditLogEntity> rows;
        if (entityType != null && !entityType.isBlank()) {
            rows = bomAuditLogRepository.findByEntityTypeOrderByCreatedAtDesc(
                    entityType.trim().toLowerCase(),
                    PageRequest.of(0, boundedLimit)
            );
        } else {
            rows = bomAuditLogRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, boundedLimit));
        }

        List<BomAuditDto> response = rows.stream()
                .map(row -> new BomAuditDto(
                        row.getId(),
                        row.getAction(),
                        row.getEntityType(),
                        row.getEntityId(),
                        row.getActor(),
                        row.getPayloadJson(),
                        row.getCreatedAt() != null ? row.getCreatedAt().toString() : null
                ))
                .collect(Collectors.toList());
        return ResponseEntity.ok(response);
    }

    private BomHeaderDto toHeaderDto(BomHeaderEntity entity) {
        return new BomHeaderDto(
                entity.getId(),
                entity.getParentMaterialId(),
                entity.getWarehouseId(),
                entity.getVersion(),
                entity.getStatus(),
                entity.getEffectiveFrom() != null ? entity.getEffectiveFrom().toString() : null,
                entity.getEffectiveTo() != null ? entity.getEffectiveTo().toString() : null,
                entity.getNotes(),
                entity.getCreatedAt() != null ? entity.getCreatedAt().toString() : null,
                entity.getUpdatedAt() != null ? entity.getUpdatedAt().toString() : null
        );
    }

    private BomComponentDto toComponentDto(BomComponentEntity entity) {
        return new BomComponentDto(
                entity.getId(),
                entity.getBomHeaderId(),
                entity.getComponentMaterialId(),
                entity.getComponentType(),
                entity.getQtyPerParent(),
                entity.getScrapRate(),
                entity.getLeadTimeDays(),
                entity.getUom(),
                entity.getCreatedAt() != null ? entity.getCreatedAt().toString() : null,
                entity.getUpdatedAt() != null ? entity.getUpdatedAt().toString() : null
        );
    }

    private void writeAudit(String action, String entityType, UUID entityId, String actor, Map<String, Object> payload) {
        BomAuditLogEntity row = new BomAuditLogEntity();
        row.setAction(action);
        row.setEntityType(entityType);
        row.setEntityId(entityId);
        row.setActor(actor);
        row.setPayloadJson(toJson(payload));
        bomAuditLogRepository.save(row);
    }

    private String toJson(Map<String, Object> payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            Map<String, Object> fallback = new HashMap<>();
            fallback.put("error", "payload_serialization_failed");
            return fallback.toString();
        }
    }

    private String actor(Authentication authentication) {
        return authentication != null ? authentication.getName() : "system";
    }

    private String defaultIfBlank(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return value.trim();
    }

    public record BomHeaderDto(
            UUID id,
            UUID parentMaterialId,
            UUID warehouseId,
            String version,
            String status,
            String effectiveFrom,
            String effectiveTo,
            String notes,
            String createdAt,
            String updatedAt
    ) {
    }

    public record BomComponentDto(
            UUID id,
            UUID bomHeaderId,
            UUID componentMaterialId,
            String componentType,
            BigDecimal qtyPerParent,
            BigDecimal scrapRate,
            Integer leadTimeDays,
            String uom,
            String createdAt,
            String updatedAt
    ) {
    }

    public record BomAuditDto(
            UUID id,
            String action,
            String entityType,
            UUID entityId,
            String actor,
            String payloadJson,
            String createdAt
    ) {
    }

    public record CreateBomHeaderRequest(
            UUID parentMaterialId,
            UUID warehouseId,
            String version,
            String status,
            LocalDate effectiveFrom,
            LocalDate effectiveTo,
            String notes
    ) {
    }

    public record UpdateBomHeaderRequest(
            String version,
            String status,
            LocalDate effectiveFrom,
            LocalDate effectiveTo,
            String notes
    ) {
    }

    public record CreateBomComponentRequest(
            UUID componentMaterialId,
            String componentType,
            BigDecimal qtyPerParent,
            BigDecimal scrapRate,
            Integer leadTimeDays,
            String uom
    ) {
    }

    public record UpdateBomComponentRequest(
            String componentType,
            BigDecimal qtyPerParent,
            BigDecimal scrapRate,
            Integer leadTimeDays,
            String uom
    ) {
    }
}
