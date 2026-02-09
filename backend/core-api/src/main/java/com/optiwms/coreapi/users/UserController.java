package com.optiwms.coreapi.users;

import com.optiwms.coreapp.users.UserService;
import com.optiwms.domain.users.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
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
        User user = service.findById(id);
        return ResponseEntity.ok(toDto(user));
    }

    @GetMapping("/username/{username}")
    public ResponseEntity<UserDto> getByUsername(@PathVariable String username) {
        User user = service.findByUsername(username);
        return ResponseEntity.ok(toDto(user));
    }

    @PostMapping
    public ResponseEntity<UserDto> create(@Valid @RequestBody CreateUserRequest request) {
        User user = new User();
        user.setUsername(request.username());
        user.setEmail(request.email());
        // Password will be automatically hashed by UserService
        user.setPasswordHash(request.password()); // UserService will hash this
        user.setEmployeeId(request.employeeId());
        user.setFirstName(request.firstName());
        user.setLastName(request.lastName());
        user.setRole(request.role());

        if (request.warehouseId() != null && !request.warehouseId().trim().isEmpty()) {
            user.setWarehouseId(UUID.fromString(request.warehouseId()));
        } else {
            user.setWarehouseId(null);
        }

        user.setPhone(request.phone());
        user.setAvatarUrl(request.avatarUrl());
        user.setStatus(request.status() != null ? request.status() : "active");
        user.setDeviceId(request.deviceId());

        User created = service.create(user);
        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(created));
    }

    @PutMapping("/{id}")
    public ResponseEntity<UserDto> update(@PathVariable UUID id, @Valid @RequestBody UpdateUserRequest request) {
        User user = service.findById(id);
        if (request.email() != null) user.setEmail(request.email());
        if (request.password() != null) user.setPasswordHash(request.password()); // Will be hashed by UserService
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
    }

    @PutMapping("/{id}/last-login")
    public ResponseEntity<Void> updateLastLogin(@PathVariable UUID id) {
        service.updateLastLogin(id);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.deleteById(id);
        return ResponseEntity.noContent().build();
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
                user.getBlindReceivingMode() != null ? user.getBlindReceivingMode() : false,
                user.getLastLoginAt() != null ? user.getLastLoginAt().toString() : null
        );
    }

    public record CreateUserRequest(
            @NotBlank @Size(max = 100) String username,
            @Email @Size(max = 200) String email,
            @NotBlank @Size(min = 6, max = 100) String password, // Plain password - will be hashed by UserService
            String employeeId,
            String firstName,
            String lastName,
            @NotBlank @Size(max = 50) String role,
            @Pattern(regexp = "^[0-9a-fA-F-]{36}$") String warehouseId,
            String phone,
            String avatarUrl,
            @Pattern(regexp = "(?i)active|inactive") String status,
            String deviceId
    ) {}

    public record UpdateUserRequest(
            @Email @Size(max = 200) String email,
            @Size(min = 6, max = 100) String password, // Plain password - will be hashed by UserService if provided
            String firstName,
            String lastName,
            @Size(max = 50) String role,
            @Pattern(regexp = "^[0-9a-fA-F-]{36}$") String warehouseId,
            String phone,
            String avatarUrl,
            @Pattern(regexp = "(?i)active|inactive") String status,
            String deviceId
    ) {}

    @PutMapping("/{id}/preferences")
    public ResponseEntity<UserDto> updatePreferences(
            @PathVariable UUID id,
            @RequestBody UserPreferencesRequest preferences
    ) {
        User user = service.findById(id);

        // Update blind receiving mode if provided
        if (preferences.blindReceivingMode() != null) {
            user.setBlindReceivingMode(preferences.blindReceivingMode());
        }

        User updated = service.update(user);
        return ResponseEntity.ok(toDto(updated));
    }

    /**
     * Assign a user to a warehouse.
     * Useful for fixing workers who don't have warehouseId set.
     */
    @PutMapping("/{id}/assign-warehouse")
    public ResponseEntity<UserDto> assignWarehouse(
            @PathVariable UUID id,
            @Valid @RequestBody AssignWarehouseRequest request
    ) {
        User user = service.findById(id);
        user.setWarehouseId(UUID.fromString(request.warehouseId()));
        User updated = service.update(user);
        return ResponseEntity.ok(toDto(updated));
    }

    public record UserPreferencesRequest(Boolean blindReceivingMode) {}

    public record AssignWarehouseRequest(
            @NotBlank @Pattern(regexp = "^[0-9a-fA-F-]{36}$") String warehouseId
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
            Boolean blindReceivingMode,
            String lastLoginAt
    ) {}
}
