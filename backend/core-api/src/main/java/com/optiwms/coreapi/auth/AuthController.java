package com.optiwms.coreapi.auth;

import com.optiwms.coreapp.users.UserService;
import com.optiwms.domain.users.User;
import com.optiwms.infra.users.UserEntity;
import com.optiwms.infra.users.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final JwtTokenProvider tokenProvider;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final UserService userService;

    public AuthController(
            JwtTokenProvider tokenProvider,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            UserService userService) {
        this.tokenProvider = tokenProvider;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.userService = userService;
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        try {
            String loginIdentifier = request.username(); // Can be username, email, or employee ID
            
            // Try to find user by email first (for admin login), then by username, then by employee ID
            Optional<UserEntity> userEntity = userRepository.findByEmail(loginIdentifier);
            if (userEntity.isEmpty()) {
                userEntity = userRepository.findByUsername(loginIdentifier);
            }
            if (userEntity.isEmpty()) {
                userEntity = userRepository.findByEmployeeId(loginIdentifier);
            }
            
            if (userEntity.isEmpty()) {
                return ResponseEntity.status(401).body(new LoginResponse(
                        false,
                        "Invalid email or password",
                        null, null, null, null, null, null, null, null
                ));
            }

            UserEntity user = userEntity.get();
            
            // Check if user is active
            if (!"active".equalsIgnoreCase(user.getStatus())) {
                return ResponseEntity.status(401).body(new LoginResponse(
                        false,
                        "Account is inactive. Please contact administrator.",
                        null, null, null, null, null, null, null, null
                ));
            }
            
            // Verify password
            if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
                return ResponseEntity.status(401).body(new LoginResponse(
                        false,
                        "Invalid email or password",
                        null, null, null, null, null, null, null, null
                ));
            }
            
            // Update last login time
            user.setLastLoginAt(LocalDateTime.now());
            userRepository.save(user);

            // Generate JWT tokens
            String accessToken = tokenProvider.generateToken(
                    user.getUsername(),
                    user.getRole(),
                    user.getId().toString()
            );
            String refreshToken = tokenProvider.generateRefreshToken(user.getUsername());

            return ResponseEntity.ok(new LoginResponse(
                    true,
                    "Login successful",
                    user.getId().toString(),
                    user.getUsername(),
                    user.getEmail(),
                    (user.getFirstName() != null ? user.getFirstName() : "") + " " + (user.getLastName() != null ? user.getLastName() : "").trim(),
                    user.getRole(),
                    user.getWarehouseId() != null ? user.getWarehouseId().toString() : null,
                    accessToken,
                    refreshToken
            ));
        } catch (Exception e) {
            return ResponseEntity.status(401).body(new LoginResponse(
                    false,
                    "Invalid email or password",
                    null, null, null, null, null, null, null, null
            ));
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<RefreshResponse> refresh(@Valid @RequestBody RefreshRequest request) {
        try {
            String refreshToken = request.refreshToken();
            String username = tokenProvider.getUsernameFromToken(refreshToken);
            
            if (tokenProvider.isTokenExpired(refreshToken)) {
                return ResponseEntity.status(401).body(new RefreshResponse(false, null, null, "Refresh token expired"));
            }

            // Load user to get role and ID
            Optional<UserEntity> userEntity = userRepository.findByUsername(username);
            if (userEntity.isEmpty()) {
                return ResponseEntity.status(401).body(new RefreshResponse(false, null, null, "User not found"));
            }

            UserEntity user = userEntity.get();
            String newAccessToken = tokenProvider.generateToken(
                    username,
                    user.getRole(),
                    user.getId().toString()
            );
            String newRefreshToken = tokenProvider.generateRefreshToken(username);

            return ResponseEntity.ok(new RefreshResponse(true, newAccessToken, newRefreshToken, null));
        } catch (Exception e) {
            return ResponseEntity.status(401).body(new RefreshResponse(false, null, null, "Invalid refresh token"));
        }
    }

    @GetMapping("/me")
    public ResponseEntity<UserInfo> getCurrentUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).build();
        }

        String username = authentication.getName();
        Optional<UserEntity> userEntity = userRepository.findByUsername(username);
        if (userEntity.isEmpty()) {
            userEntity = userRepository.findByEmail(username);
        }

        if (userEntity.isEmpty()) {
            return ResponseEntity.status(401).build();
        }

        UserEntity user = userEntity.get();
        String role = authentication.getAuthorities().stream()
                .findFirst()
                .map(a -> a.getAuthority())
                .orElse(user.getRole());

        return ResponseEntity.ok(new UserInfo(
                user.getId().toString(),
                username,
                user.getEmail(),
                (user.getFirstName() != null ? user.getFirstName() : "") + " " + (user.getLastName() != null ? user.getLastName() : "").trim(),
                role,
                user.getWarehouseId() != null ? user.getWarehouseId().toString() : null
        ));
    }

    @PutMapping("/me/preferences")
    public ResponseEntity<Map<String, Object>> updateMyPreferences(
            Authentication authentication,
            @RequestBody Map<String, Object> preferences
    ) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).build();
        }

        try {
            String username = authentication.getName();
            Optional<UserEntity> userEntity = userRepository.findByUsername(username);
            if (userEntity.isEmpty()) {
                userEntity = userRepository.findByEmail(username);
            }

            if (userEntity.isEmpty()) {
                return ResponseEntity.status(401).build();
            }

            UserEntity user = userEntity.get();
            
            // Update blind receiving mode if provided
            if (preferences.containsKey("blindReceivingMode")) {
                Object value = preferences.get("blindReceivingMode");
                Boolean blindMode = value instanceof Boolean 
                    ? (Boolean) value 
                    : Boolean.parseBoolean(value.toString());
                user.setBlindReceivingMode(blindMode);
                userRepository.save(user);
            }
            
            return ResponseEntity.ok(Map.of(
                "success", true,
                "blindReceivingMode", user.getBlindReceivingMode() != null ? user.getBlindReceivingMode() : false
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    /**
     * Update current user's profile information (name, email, phone)
     * Accessible to all authenticated users
     */
    @PutMapping("/me/profile")
    public ResponseEntity<Map<String, Object>> updateProfile(
            Authentication authentication,
            @Valid @RequestBody UpdateProfileRequest request
    ) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401)
                .body(Map.of("success", false, "error", "Unauthorized"));
        }

        try {
            String username = authentication.getName();
            Optional<UserEntity> userEntity = userRepository.findByUsername(username);
            if (userEntity.isEmpty()) {
                userEntity = userRepository.findByEmail(username);
            }

            if (userEntity.isEmpty()) {
                return ResponseEntity.status(401)
                    .body(Map.of("success", false, "error", "User not found"));
            }

            UserEntity user = userEntity.get();
            
            // Update only if provided
            if (request.firstName() != null && !request.firstName().trim().isEmpty()) {
                user.setFirstName(request.firstName().trim());
            }
            if (request.lastName() != null && !request.lastName().trim().isEmpty()) {
                user.setLastName(request.lastName().trim());
            }
            if (request.email() != null && !request.email().trim().isEmpty()) {
                // Check if email is already taken by another user
                Optional<UserEntity> existingEmail = userRepository.findByEmail(request.email().trim());
                if (existingEmail.isPresent() && !existingEmail.get().getId().equals(user.getId())) {
                    return ResponseEntity.badRequest()
                        .body(Map.of("success", false, "error", "Email is already in use"));
                }
                user.setEmail(request.email().trim());
            }
            if (request.phone() != null) {
                user.setPhone(request.phone().trim());
            }
            
            userRepository.save(user);
            
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Profile updated successfully",
                "user", Map.of(
                    "id", user.getId().toString(),
                    "username", user.getUsername(),
                    "email", user.getEmail() != null ? user.getEmail() : "",
                    "firstName", user.getFirstName() != null ? user.getFirstName() : "",
                    "lastName", user.getLastName() != null ? user.getLastName() : "",
                    "phone", user.getPhone() != null ? user.getPhone() : "",
                    "role", user.getRole()
                )
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    /**
     * Change current user's password
     * Requires current password verification for security
     * Accessible to all authenticated users
     */
    @PutMapping("/me/password")
    public ResponseEntity<Map<String, Object>> changePassword(
            Authentication authentication,
            @Valid @RequestBody ChangePasswordRequest request
    ) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401)
                .body(Map.of("success", false, "error", "Unauthorized"));
        }

        try {
            // Validate request
            if (request.currentPassword() == null || request.currentPassword().trim().isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(Map.of("success", false, "error", "Current password is required"));
            }
            if (request.newPassword() == null || request.newPassword().trim().isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(Map.of("success", false, "error", "New password is required"));
            }
            if (request.newPassword().length() < 6) {
                return ResponseEntity.badRequest()
                    .body(Map.of("success", false, "error", "New password must be at least 6 characters"));
            }

            String username = authentication.getName();
            Optional<UserEntity> userEntity = userRepository.findByUsername(username);
            if (userEntity.isEmpty()) {
                userEntity = userRepository.findByEmail(username);
            }

            if (userEntity.isEmpty()) {
                return ResponseEntity.status(401)
                    .body(Map.of("success", false, "error", "User not found"));
            }

            UserEntity user = userEntity.get();
            
            // Verify current password
            if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
                return ResponseEntity.status(400)
                    .body(Map.of("success", false, "error", "Current password is incorrect"));
            }
            
            // Hash and set new password
            String hashedPassword = passwordEncoder.encode(request.newPassword());
            user.setPasswordHash(hashedPassword);
            userRepository.save(user);
            
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Password changed successfully"
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    public record LoginRequest(
            @NotBlank @Size(max = 100) String username,
            @NotBlank @Size(max = 100) String password
    ) {}
    
    public record LoginResponse(
            boolean success,
            String message,
            String userId,
            String username,
            String email,
            String name,
            String role,
            String warehouseId,
            String accessToken,
            String refreshToken
    ) {}

    public record RefreshRequest(@NotBlank String refreshToken) {}

    public record RefreshResponse(
            boolean success,
            String accessToken,
            String refreshToken,
            String error
    ) {}

    public record UserInfo(
            String userId,
            String username,
            String email,
            String name,
            String role,
            String warehouseId
    ) {}

    public record UpdateProfileRequest(
            @Size(max = 100) String firstName,
            @Size(max = 100) String lastName,
            @Email @Size(max = 200) String email,
            @Size(max = 50) String phone
    ) {}

    public record ChangePasswordRequest(
            @NotBlank @Size(max = 100) String currentPassword,
            @NotBlank @Size(min = 6, max = 100) String newPassword
    ) {}
}
