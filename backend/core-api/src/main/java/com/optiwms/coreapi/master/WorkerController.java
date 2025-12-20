package com.optiwms.coreapi.master;

import com.optiwms.coreapp.master.WorkerService;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/workers")
public class WorkerController {

    private final WorkerService service;

    public WorkerController(WorkerService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<WorkerDto>> list() {
        var data = service.listAll().stream()
                .map(w -> new WorkerDto(
                        w.getId(),
                        w.getUsername(),
                        w.getEmail(),
                        w.getEmployeeId(),
                        w.getFirstName(),
                        w.getLastName(),
                        w.getRole(),
                        w.getWarehouseId(),
                        w.getPhone(),
                        w.getAvatarUrl(),
                        w.getStatus(),
                        w.getDeviceId(),
                        w.getLastLoginAt()
                ))
                .toList();
        return ResponseEntity.ok(data);
    }

    @GetMapping("/{id}")
    public ResponseEntity<WorkerDto> getById(@PathVariable @NonNull java.util.UUID id) {
        try {
            var worker = service.findById(id);
            return ResponseEntity.ok(new WorkerDto(
                    worker.getId(),
                    worker.getUsername(),
                    worker.getEmail(),
                    worker.getEmployeeId(),
                    worker.getFirstName(),
                    worker.getLastName(),
                    worker.getRole(),
                    worker.getWarehouseId(),
                    worker.getPhone(),
                    worker.getAvatarUrl(),
                    worker.getStatus(),
                    worker.getDeviceId(),
                    worker.getLastLoginAt()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<WorkerDto> create(@RequestBody CreateWorkerRequest request) {
        try {
            var worker = new com.optiwms.domain.master.Worker();
            worker.setUsername(request.username());
            worker.setEmail(request.email());
            worker.setPasswordHash(request.passwordHash());
            worker.setEmployeeId(request.employeeId());
            worker.setFirstName(request.firstName());
            worker.setLastName(request.lastName());
            worker.setRole(request.role());
            worker.setWarehouseId(request.warehouseId());
            worker.setPhone(request.phone());
            worker.setAvatarUrl(request.avatarUrl());
            worker.setStatus(request.status());
            worker.setDeviceId(request.deviceId());

            var created = service.create(worker);
            return ResponseEntity.ok(new WorkerDto(
                    created.getId(),
                    created.getUsername(),
                    created.getEmail(),
                    created.getEmployeeId(),
                    created.getFirstName(),
                    created.getLastName(),
                    created.getRole(),
                    created.getWarehouseId(),
                    created.getPhone(),
                    created.getAvatarUrl(),
                    created.getStatus(),
                    created.getDeviceId(),
                    created.getLastLoginAt()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<WorkerDto> update(@PathVariable @NonNull java.util.UUID id, @RequestBody UpdateWorkerRequest request) {
        try {
            var worker = new com.optiwms.domain.master.Worker();
            worker.setUsername(request.username());
            worker.setEmail(request.email());
            worker.setPasswordHash(request.passwordHash());
            worker.setEmployeeId(request.employeeId());
            worker.setFirstName(request.firstName());
            worker.setLastName(request.lastName());
            worker.setRole(request.role());
            worker.setWarehouseId(request.warehouseId());
            worker.setPhone(request.phone());
            worker.setAvatarUrl(request.avatarUrl());
            worker.setStatus(request.status());
            worker.setDeviceId(request.deviceId());

            var updated = service.update(id, worker);
            return ResponseEntity.ok(new WorkerDto(
                    updated.getId(),
                    updated.getUsername(),
                    updated.getEmail(),
                    updated.getEmployeeId(),
                    updated.getFirstName(),
                    updated.getLastName(),
                    updated.getRole(),
                    updated.getWarehouseId(),
                    updated.getPhone(),
                    updated.getAvatarUrl(),
                    updated.getStatus(),
                    updated.getDeviceId(),
                    updated.getLastLoginAt()
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

    public record WorkerDto(
            java.util.UUID id,
            String username,
            String email,
            String employeeId,
            String firstName,
            String lastName,
            String role,
            java.util.UUID warehouseId,
            String phone,
            String avatarUrl,
            String status,
            String deviceId,
            java.time.LocalDateTime lastLoginAt
    ) {}

    public record CreateWorkerRequest(
            String username,
            String email,
            String passwordHash,
            String employeeId,
            String firstName,
            String lastName,
            String role,
            java.util.UUID warehouseId,
            String phone,
            String avatarUrl,
            String status,
            String deviceId
    ) {}

    public record UpdateWorkerRequest(
            String username,
            String email,
            String passwordHash,
            String employeeId,
            String firstName,
            String lastName,
            String role,
            java.util.UUID warehouseId,
            String phone,
            String avatarUrl,
            String status,
            String deviceId
    ) {}
}

