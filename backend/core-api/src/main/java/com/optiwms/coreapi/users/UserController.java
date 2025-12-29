package com.optiwms.coreapi.users;

import com.optiwms.coreapp.users.UserService;
import com.optiwms.domain.users.User;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService service;

    public UserController(UserService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<UserDto>> listAll(
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String warehouseId,
            @RequestParam(required = false) String status
    ) {
        List<User> users;
        if (role != null) {
            users = service.findByRole(role);
        } else if (warehouseId != null) {
            users = service.findByWarehouseId(UUID.fromString(warehouseId));
        } else if (status != null) {
            users = service.findByStatus(status);
        } else {
            users = service.listAll();
        }

        List<UserDto> userDtos = users.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(userDtos);
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserDto> getById(@PathVariable UUID id) {
        try {
            User user = service.findById(id);
            return ResponseEntity.ok(toDto(user));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/username/{username}")
    public ResponseEntity<UserDto> getByUsername(@PathVariable String username) {
        try {
            User user = service.findByUsername(username);
            return ResponseEntity.ok(toDto(user));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<UserDto> create(@RequestBody CreateUserRequest request) {
        try {
            User user = new User();
            user.setUsername(request.username());
            user.setEmail(request.email());
            user.setPasswordHash(request.passwordHash()); // In production, hash this
            user.setEmployeeId(request.employeeId());
            user.setFirstName(request.firstName());
            user.setLastName(request.lastName());
            user.setRole(request.role());
            user.setWarehouseId(request.warehouseId() != null ? UUID.fromString(request.warehouseId()) : null);
            user.setPhone(request.phone());
            user.setAvatarUrl(request.avatarUrl());
            user.setStatus(request.status() != null ? request.status() : "active");
            user.setDeviceId(request.deviceId());

            User created = service.create(user);
            return ResponseEntity.status(HttpStatus.CREATED).body(toDto(created));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<UserDto> update(@PathVariable UUID id, @RequestBody UpdateUserRequest request) {
        try {
            User user = service.findById(id);
            if (request.email() != null) user.setEmail(request.email());
            if (request.passwordHash() != null) user.setPasswordHash(request.passwordHash());
            if (request.firstName() != null) user.setFirstName(request.firstName());
            if (request.lastName() != null) user.setLastName(request.lastName());
            if (request.role() != null) user.setRole(request.role());
            if (request.warehouseId() != null) user.setWarehouseId(UUID.fromString(request.warehouseId()));
            if (request.phone() != null) user.setPhone(request.phone());
            if (request.avatarUrl() != null) user.setAvatarUrl(request.avatarUrl());
            if (request.status() != null) user.setStatus(request.status());
            if (request.deviceId() != null) user.setDeviceId(request.deviceId());

            User updated = service.update(user);
            return ResponseEntity.ok(toDto(updated));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}/last-login")
    public ResponseEntity<Void> updateLastLogin(@PathVariable UUID id) {
        try {
            service.updateLastLogin(id);
            return ResponseEntity.ok().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        try {
            service.deleteById(id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    private UserDto toDto(User user) {
        return new UserDto(
                user.getId().toString(),
                user.getUsername(),
                user.getEmail(),
                user.getEmployeeId(),
                user.getFirstName(),
                user.getLastName(),
                user.getRole(),
                user.getWarehouseId() != null ? user.getWarehouseId().toString() : null,
                user.getPhone(),
                user.getAvatarUrl(),
                user.getStatus(),
                user.getDeviceId(),
                user.getLastLoginAt() != null ? user.getLastLoginAt().toString() : null
        );
    }

    public record CreateUserRequest(
            String username,
            String email,
            String passwordHash,
            String employeeId,
            String firstName,
            String lastName,
            String role,
            String warehouseId,
            String phone,
            String avatarUrl,
            String status,
            String deviceId
    ) {}

    public record UpdateUserRequest(
            String email,
            String passwordHash,
            String firstName,
            String lastName,
            String role,
            String warehouseId,
            String phone,
            String avatarUrl,
            String status,
            String deviceId
    ) {}

    public record UserDto(
            String id,
            String username,
            String email,
            String employeeId,
            String firstName,
            String lastName,
            String role,
            String warehouseId,
            String phone,
            String avatarUrl,
            String status,
            String deviceId,
            String lastLoginAt
    ) {}
}

