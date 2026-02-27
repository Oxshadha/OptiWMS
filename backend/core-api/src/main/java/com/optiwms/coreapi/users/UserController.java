package com.optiwms.coreapi.users;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.optiwms.coreapp.users.UserService;
import com.optiwms.domain.users.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService service;
    private final ObjectMapper objectMapper;

    public UserController(UserService service, ObjectMapper objectMapper) {
        this.service = service;
        this.objectMapper = objectMapper;
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

    @GetMapping("/paged")
    public ResponseEntity<PagedUserResponse> listPaged(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String warehouseId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String q
    ) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 200);
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDir) ? Sort.Direction.ASC : Sort.Direction.DESC;
        String safeSortBy = sanitizeSortBy(sortBy);

        Page<User> userPage = service.findPaged(
                role,
                warehouseId != null && !warehouseId.isBlank() ? UUID.fromString(warehouseId) : null,
                status,
                q,
                PageRequest.of(safePage, safeSize, Sort.by(direction, safeSortBy).and(Sort.by(direction, "id")))
        );

        List<UserDto> data = userPage.getContent().stream().map(this::toDto).toList();
        return ResponseEntity.ok(new PagedUserResponse(
                data,
                userPage.getNumber(),
                userPage.getSize(),
                userPage.getTotalElements(),
                userPage.getTotalPages()
        ));
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
    public ResponseEntity<?> create(@RequestBody CreateUserRequest request) {
        try {
            // Validate required fields
            if (request.username() == null || request.username().trim().isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(Map.of("error", "Username is required"));
            }
            if (request.password() == null || request.password().trim().isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(Map.of("error", "Password is required"));
            }
            if (request.role() == null || request.role().trim().isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(Map.of("error", "Role is required"));
            }

            User user = new User();
            user.setUsername(request.username());
            user.setEmail(request.email());
            // Password will be automatically hashed by UserService
            user.setPasswordHash(request.password()); // UserService will hash this
            user.setEmployeeId(request.employeeId());
            user.setFirstName(request.firstName());
            user.setLastName(request.lastName());
            user.setRole(request.role());
            
            // Validate and parse warehouseId
            if (request.warehouseId() != null && !request.warehouseId().trim().isEmpty()) {
                try {
                    user.setWarehouseId(UUID.fromString(request.warehouseId()));
                } catch (IllegalArgumentException e) {
                    return ResponseEntity.badRequest()
                        .body(Map.of("error", "Invalid warehouse ID format: " + request.warehouseId()));
                }
            } else {
                user.setWarehouseId(null);
            }
            
            user.setPhone(request.phone());
            user.setAvatarUrl(request.avatarUrl());
            user.setStatus(request.status() != null ? request.status() : "active");
            user.setDeviceId(request.deviceId());

            User created = service.create(user);
            return ResponseEntity.status(HttpStatus.CREATED).body(toDto(created));
        } catch (RuntimeException e) {
            // Return error message in response
            return ResponseEntity.badRequest()
                .body(Map.of("error", e.getMessage() != null ? e.getMessage() : "Failed to create user"));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                .body(Map.of("error", "Unexpected error: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<UserDto> update(@PathVariable UUID id, @RequestBody UpdateUserRequest request) {
        try {
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
                user.getBlindReceivingMode() != null ? user.getBlindReceivingMode() : false,
                user.getLastLoginAt() != null ? user.getLastLoginAt().toString() : null,
                user.getDashboardSettings()
        );
    }

    public record CreateUserRequest(
            String username,
            String email,
            String password, // Plain password - will be hashed by UserService
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
            String password, // Plain password - will be hashed by UserService if provided
            String firstName,
            String lastName,
            String role,
            String warehouseId,
            String phone,
            String avatarUrl,
            String status,
            String deviceId
    ) {}

    @PutMapping("/{id}/preferences")
    public ResponseEntity<UserDto> updatePreferences(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> preferences
    ) {
        try {
            User user = service.findById(id);
            
            // Update blind receiving mode if provided
            if (preferences.containsKey("blindReceivingMode")) {
                Object value = preferences.get("blindReceivingMode");
                Boolean blindMode = value instanceof Boolean 
                    ? (Boolean) value 
                    : Boolean.parseBoolean(value.toString());
                user.setBlindReceivingMode(blindMode);
            }
            if (preferences.containsKey("dashboardSettings")) {
                Object settings = preferences.get("dashboardSettings");
                user.setDashboardSettings(objectMapper.writeValueAsString(settings));
            }
            
            User updated = service.update(user);
            return ResponseEntity.ok(toDto(updated));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Assign a user to a warehouse.
     * Useful for fixing workers who don't have warehouseId set.
     */
    @PutMapping("/{id}/assign-warehouse")
    public ResponseEntity<UserDto> assignWarehouse(
            @PathVariable UUID id,
            @RequestBody Map<String, String> request
    ) {
        try {
            User user = service.findById(id);
            String warehouseId = request.get("warehouseId");
            
            if (warehouseId == null || warehouseId.trim().isEmpty()) {
                return ResponseEntity.badRequest().build();
            }
            
            user.setWarehouseId(UUID.fromString(warehouseId));
            User updated = service.update(user);
            return ResponseEntity.ok(toDto(updated));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

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
            String lastLoginAt,
            String dashboardSettings
    ) {}

    public record PagedUserResponse(
            List<UserDto> data,
            int page,
            int size,
            long totalElements,
            int totalPages
    ) {}

    private String sanitizeSortBy(String sortBy) {
        if (sortBy == null || sortBy.isBlank()) return "createdAt";
        return switch (sortBy) {
            case "id", "username", "employeeId", "firstName", "lastName", "email", "role", "status", "createdAt", "lastLoginAt" -> sortBy;
            default -> "createdAt";
        };
    }
}
