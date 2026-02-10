package com.optiwms.coreapi.sops;

import com.optiwms.coreapp.sops.SopService;
import com.optiwms.domain.sops.Sop;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/sops")
public class SopController {

    private static final String CATEGORY_PATTERN = "equipment_operation|cycle_count|warehouse_operations|safety|inspection|general";
    private static final String STATUS_PATTERN = "active|draft|archived";

    private final SopService service;

    public SopController(SopService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<SopDto>> listAll(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String status
    ) {
        List<SopDto> dtos = service.listAll(category, status)
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/{id}")
    public ResponseEntity<SopDto> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(toDto(service.findById(id)));
    }

    @PostMapping
    public ResponseEntity<SopDto> create(@Valid @RequestBody CreateSopRequest request) {
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
    }

    @PutMapping("/{id}")
    public ResponseEntity<SopDto> update(@PathVariable UUID id, @Valid @RequestBody UpdateSopRequest request) {
        Sop sop = new Sop();
        sop.setTitle(request.title());
        sop.setCategory(request.category());
        sop.setContent(request.content());
        sop.setVersion(request.version());
        sop.setStatus(request.status());
        sop.setCreatedBy(request.createdBy());
        sop.setApplicableRoles(request.applicableRoles());

        Sop updated = service.update(id, sop);
        return ResponseEntity.ok(toDto(updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.deleteById(id);
        return ResponseEntity.noContent().build();
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
                sop.getCreatedAt(),
                sop.getUpdatedAt()
        );
    }

    public record CreateSopRequest(
            @NotBlank @Size(max = 200) String title,
            @NotBlank @Pattern(regexp = CATEGORY_PATTERN) String category,
            @NotBlank String content,
            @NotBlank @Size(max = 20) String version,
            @NotBlank @Pattern(regexp = STATUS_PATTERN) String status,
            @Size(max = 100) String createdBy,
            List<@NotBlank @Size(max = 50) String> applicableRoles
    ) {
    }

    public record UpdateSopRequest(
            @NotBlank @Size(max = 200) String title,
            @NotBlank @Pattern(regexp = CATEGORY_PATTERN) String category,
            @NotBlank String content,
            @NotBlank @Size(max = 20) String version,
            @NotBlank @Pattern(regexp = STATUS_PATTERN) String status,
            @Size(max = 100) String createdBy,
            List<@NotBlank @Size(max = 50) String> applicableRoles
    ) {
    }

    public record SopDto(
            String id,
            String title,
            String category,
            String content,
            String version,
            String status,
            String createdBy,
            List<String> applicableRoles,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt
    ) {
    }
}
