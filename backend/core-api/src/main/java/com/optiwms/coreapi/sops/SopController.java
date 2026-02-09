package com.optiwms.coreapi.sops;

import com.optiwms.coreapp.sops.SopService;
import com.optiwms.domain.sops.Sop;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/sops")
public class SopController {

    private final SopService service;

    public SopController(SopService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<SopDto>> getAll(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String status
    ) {
        List<SopDto> dtos = service.listAll(category, status).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/{id}")
    public ResponseEntity<SopDto> getById(@PathVariable UUID id) {
        try {
            return ResponseEntity.ok(toDto(service.findById(id)));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<SopDto> create(@RequestBody CreateSopRequest request) {
        try {
            Sop sop = new Sop();
            sop.setTitle(request.title());
            sop.setCategory(request.category());
            sop.setContent(request.content());
            sop.setVersion(request.version());
            sop.setStatus(request.status());
            sop.setCreatedBy(request.createdBy());
            sop.setApplicableRoles(request.applicableRoles());

            Sop created = service.create(sop);
            return ResponseEntity.status(HttpStatus.CREATED).body(toDto(created));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<SopDto> update(@PathVariable UUID id, @RequestBody UpdateSopRequest request) {
        try {
            Sop patch = new Sop();
            patch.setTitle(request.title());
            patch.setCategory(request.category());
            patch.setContent(request.content());
            patch.setVersion(request.version());
            patch.setStatus(request.status());
            patch.setCreatedBy(request.createdBy());
            patch.setApplicableRoles(request.applicableRoles());

            Sop updated = service.update(id, patch);
            return ResponseEntity.ok(toDto(updated));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        try {
            service.delete(id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    private SopDto toDto(Sop sop) {
        return new SopDto(
                sop.getId().toString(),
                sop.getTitle(),
                sop.getCategory(),
                sop.getContent(),
                sop.getVersion(),
                sop.getStatus(),
                sop.getCreatedBy(),
                sop.getApplicableRoles(),
                sop.getCreatedAt() != null ? sop.getCreatedAt().toString() : null,
                sop.getUpdatedAt() != null ? sop.getUpdatedAt().toString() : null
        );
    }

    public record CreateSopRequest(
            String title,
            String category,
            String content,
            String version,
            String status,
            String createdBy,
            List<String> applicableRoles
    ) {}

    public record UpdateSopRequest(
            String title,
            String category,
            String content,
            String version,
            String status,
            String createdBy,
            List<String> applicableRoles
    ) {}

    public record SopDto(
            String id,
            String title,
            String category,
            String content,
            String version,
            String status,
            String createdBy,
            List<String> applicableRoles,
            String createdAt,
            String updatedAt
    ) {}
}
