package com.optiwms.integration;

import com.optiwms.infra.users.UserEntity;
import com.optiwms.infra.users.UserRepository;
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

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserSeederService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public void ensureDefaultAdminExists() {
        // Check if admin user exists by username or email
        Optional<UserEntity> existingAdmin = userRepository.findByUsername("admin");
        if (existingAdmin.isEmpty()) {
            existingAdmin = userRepository.findByEmail("admin@optiwms.com");
        }

        if (existingAdmin.isEmpty()) {
            System.out.println("Creating default admin user...");
            
            UserEntity admin = new UserEntity();
            admin.setId(UUID.randomUUID());
            admin.setUsername("admin");
            admin.setEmail("admin@optiwms.com");
            admin.setPasswordHash(passwordEncoder.encode("admin123"));
            admin.setFirstName("System");
            admin.setLastName("Administrator");
            admin.setRole("admin");
            admin.setStatus("active");
            admin.setCreatedAt(OffsetDateTime.now());
            admin.setUpdatedAt(OffsetDateTime.now());
            
            userRepository.save(admin);
            System.out.println("Default admin user created:");
            System.out.println("   Email: admin@optiwms.com");
            System.out.println("   Password: admin123");
        } else {
            // Admin user already exists - DO NOT reset password
            // User may have changed password, so we respect their choice
            System.out.println("Default admin user already exists (password unchanged)");
        }
    }
}

