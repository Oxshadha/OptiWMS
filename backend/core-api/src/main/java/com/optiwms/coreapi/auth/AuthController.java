package com.optiwms.coreapi.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.optiwms.infra.users.UserEntity;
import com.optiwms.infra.users.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final JwtTokenProvider tokenProvider;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final ObjectMapper objectMapper;

    public AuthController(
            JwtTokenProvider tokenProvider,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            ObjectMapper objectMapper) {
        this.tokenProvider = tokenProvider;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.objectMapper = objectMapper;
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request, HttpServletResponse response) {
        try {
            String loginIdentifier = request.username(); // Can be username, email, or employee ID

            // Try to find user by email first (for admin login), then by username, then by
            // employee ID
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
                        null, null, null, null, null, null, null));
            }

            UserEntity user = userEntity.orElseThrow(() -> new IllegalStateException("User not found"));

            // Check if user is active
            if (!"active".equalsIgnoreCase(user.getStatus())) {
                return ResponseEntity.status(401).body(new LoginResponse(
                        false,
                        "Account is inactive. Please contact administrator.",
                        null, null, null, null, null, null, null));
            }

            // Verify password
            if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
                return ResponseEntity.status(401).body(new LoginResponse(
                        false,
                        "Invalid email or password",
                        null, null, null, null, null, null, null));
            }

            // Update last login time
            user.setLastLoginAt(LocalDateTime.now());
            userRepository.save(user);

            // Generate JWT tokens
            String accessToken = tokenProvider.generateToken(
                    user.getUsername(),
                    user.getRole(),
                    user.getId().toString());
            String refreshToken = tokenProvider.generateRefreshToken(user.getUsername());

            // Set refresh token in HttpOnly cookie
            Cookie refreshCookie = new Cookie("refresh_token", refreshToken);
            refreshCookie.setHttpOnly(true);
            refreshCookie.setSecure(false); // Set to true ONLY in production with HTTPS
            refreshCookie.setPath("/api/auth");
            refreshCookie.setMaxAge(7 * 24 * 60 * 60); // 7 days
            response.addCookie(refreshCookie);

            return ResponseEntity.ok(new LoginResponse(
                    true,
                    "Login successful",
                    user.getId().toString(),
                    user.getUsername(),
                    user.getEmail(),
                    ((user.getFirstName() != null ? user.getFirstName() : "") + " "
                            + (user.getLastName() != null ? user.getLastName() : "")).trim(),
                    user.getRole(),
                    user.getWarehouseId() != null ? user.getWarehouseId().toString() : null,
                    accessToken));
        } catch (Exception e) {
            return ResponseEntity.status(401).body(new LoginResponse(
                    false,
                    "Invalid email or password",
                    null, null, null, null, null, null, null));
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<RefreshResponse> refresh(
            @CookieValue(name = "refresh_token", required = false) String refreshToken,
            HttpServletResponse response) {
        try {
            if (refreshToken == null || refreshToken.isEmpty()) {
                return ResponseEntity.status(401).body(new RefreshResponse(false, null, "No refresh token provided"));
            }

            String username = tokenProvider.getUsernameFromToken(refreshToken);

            if (tokenProvider.isTokenExpired(refreshToken)) {
                return ResponseEntity.status(401).body(new RefreshResponse(false, null, "Refresh token expired"));
            }

            // Load user to get role and ID
            Optional<UserEntity> userEntity = userRepository.findByUsername(username);
            if (userEntity.isEmpty()) {
                return ResponseEntity.status(401).body(new RefreshResponse(false, null, "User not found"));
            }

            UserEntity user = userEntity.orElseThrow(() -> new IllegalStateException("User not found"));
            String newAccessToken = tokenProvider.generateToken(
                    username,
                    user.getRole(),
                    user.getId().toString());
            String newRefreshToken = tokenProvider.generateRefreshToken(username);

            // Set new refresh token in HttpOnly cookie
            Cookie refreshCookie = new Cookie("refresh_token", newRefreshToken);
            refreshCookie.setHttpOnly(true);
            refreshCookie.setSecure(false); // Set to true ONLY in production with HTTPS
            refreshCookie.setPath("/api/auth");
            refreshCookie.setMaxAge(7 * 24 * 60 * 60); // 7 days
            response.addCookie(refreshCookie);

            return ResponseEntity.ok(new RefreshResponse(true, newAccessToken, null));
        } catch (Exception e) {
            return ResponseEntity.status(401).body(new RefreshResponse(false, null, "Invalid refresh token"));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, Object>> logout(HttpServletResponse response) {
        Cookie refreshCookie = new Cookie("refresh_token", "");
        refreshCookie.setHttpOnly(true);
        refreshCookie.setSecure(false); // Match the creation flag
        refreshCookie.setPath("/api/auth");
        refreshCookie.setMaxAge(0); // Delete cookie
        response.addCookie(refreshCookie);
        
        return ResponseEntity.ok(Map.of("success", true, "message", "Logged out successfully"));
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

        UserEntity user = userEntity.orElseThrow(() -> new IllegalStateException("User not found"));
        String role = authentication.getAuthorities().stream()
                .findFirst()
                .map(a -> a.getAuthority())
                .orElse(user.getRole());

        return ResponseEntity.ok(new UserInfo(
                user.getId().toString(),
                username,
                user.getEmail(),
                ((user.getFirstName() != null ? user.getFirstName() : "") + " "
                        + (user.getLastName() != null ? user.getLastName() : "")).trim(),
                role,
                user.getWarehouseId() != null ? user.getWarehouseId().toString() : null,
                user.getFirstName(),
                user.getLastName(),
                user.getPhone(),
                user.getAvatarUrl(),
                user.getDashboardSettings()));
    }

    @SuppressWarnings("null")
    @PutMapping("/me/preferences")
    public ResponseEntity<Map<String, Object>> updateMyPreferences(
            Authentication authentication,
            @RequestBody Map<String, Object> preferences) {
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

            UserEntity user = userEntity.orElseThrow(() -> new IllegalStateException("User not found"));

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
            userRepository.save(user);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "blindReceivingMode", Boolean.TRUE.equals(user.getBlindReceivingMode()),
                    "dashboardSettings", user.getDashboardSettings() != null ? user.getDashboardSettings() : "{}"));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    /**
     * Update current user's profile information (name, email, phone)
     * Accessible to all authenticated users
     */
    @SuppressWarnings("null")
    @PutMapping("/me/profile")
    public ResponseEntity<Map<String, Object>> updateProfile(
            Authentication authentication,
            @RequestBody UpdateProfileRequest request) {
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

            UserEntity user = userEntity.orElseThrow(() -> new IllegalStateException("User not found"));

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
                if (existingEmail.isPresent() && !existingEmail.orElseThrow().getId().equals(user.getId())) {
                    return ResponseEntity.badRequest()
                            .body(Map.of("success", false, "error", "Email is already in use"));
                }
                user.setEmail(request.email().trim());
            }
            if (request.phone() != null) {
                user.setPhone(request.phone().trim());
            }
            if (request.avatarUrl() != null) {
                String trimmedAvatar = request.avatarUrl().trim();
                user.setAvatarUrl(trimmedAvatar.isEmpty() ? null : trimmedAvatar);
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
                            "role", user.getRole())));
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
            @RequestBody ChangePasswordRequest request) {
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

            UserEntity user = userEntity.orElseThrow(() -> new IllegalStateException("User not found"));

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
                    "message", "Password changed successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    public record LoginRequest(String username, String password) {
    }

    public record LoginResponse(
            boolean success,
            String message,
            String userId,
            String username,
            String email,
            String name,
            String role,
            String warehouseId,
            String accessToken) {
    }

    public record RefreshRequest(String refreshToken) { // kept for backward compat if needed elsewhere
    }

    public record RefreshResponse(
            boolean success,
            String accessToken,
            String error) {
    }

    public record UserInfo(
            String userId,
            String username,
            String email,
            String name,
            String role,
            String warehouseId,
            String firstName,
            String lastName,
            String phone,
            String avatarUrl,
            String dashboardSettings) {
    }

    public record UpdateProfileRequest(
            String firstName,
            String lastName,
            String email,
            String phone,
            String avatarUrl) {
    }

    public record ChangePasswordRequest(
            String currentPassword,
            String newPassword) {
    }
}
