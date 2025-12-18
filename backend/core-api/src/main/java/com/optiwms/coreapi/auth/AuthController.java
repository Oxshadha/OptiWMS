package com.optiwms.coreapi.auth;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @GetMapping("/me")
    public ResponseEntity<UserInfo> getCurrentUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).build();
        }

        // Extract user info from authentication
        String username = authentication.getName();
        String role = authentication.getAuthorities().stream()
                .findFirst()
                .map(a -> a.getAuthority())
                .orElse("USER");

        return ResponseEntity.ok(new UserInfo(username, role));
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request) {
        // Basic authentication is handled by Spring Security
        // This endpoint just validates and returns user info
        // In production, you'd use JWT tokens here
        return ResponseEntity.ok(new LoginResponse(
                true,
                "Login successful. Use Basic Auth for API calls.",
                request.username(),
                "USER"
        ));
    }

    public record LoginRequest(String username, String password) {}
    
    public record LoginResponse(
            boolean success,
            String message,
            String username,
            String role
    ) {}

    public record UserInfo(String username, String role) {}
}

