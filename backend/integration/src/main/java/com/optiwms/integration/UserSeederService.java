package com.optiwms.integration;

import com.optiwms.infra.users.UserEntity;
import com.optiwms.infra.users.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

/**
 * Service to ensure default admin user exists
 * Can be called manually or on application startup
 */
@Service
public class UserSeederService {

    private static final Logger log = LoggerFactory.getLogger(UserSeederService.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserSeederService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public void ensureDefaultAdminExists(String username, String email, String plainPassword) {
        if (isBlank(username) || isBlank(email) || isBlank(plainPassword)) {
            log.warn("Default admin seeding skipped: credentials are not configured.");
            return;
        }

        // Check if admin user exists by username or email
        Optional<UserEntity> existingAdmin = userRepository.findByUsername(username.trim());
        if (existingAdmin.isEmpty()) {
            existingAdmin = userRepository.findByEmail(email.trim());
        }

        if (existingAdmin.isEmpty()) {
            log.warn("Creating default admin user from configured seed values.");
            
            UserEntity admin = new UserEntity();
            admin.setId(UUID.randomUUID());
            admin.setUsername(username.trim());
            admin.setEmail(email.trim());
            admin.setPasswordHash(passwordEncoder.encode(plainPassword));
            admin.setFirstName("System");
            admin.setLastName("Administrator");
            admin.setRole("admin");
            admin.setStatus("active");
            admin.setCreatedAt(OffsetDateTime.now());
            admin.setUpdatedAt(OffsetDateTime.now());
            
            userRepository.save(admin);
            log.warn("Default admin user created for email={}. Change password immediately.", email.trim());
        } else {
            // Admin user already exists - DO NOT reset password
            // User may have changed password, so we respect their choice
            log.info("Default admin user already exists (password unchanged)");
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
