package com.optiwms.integration;

import com.optiwms.infra.users.UserEntity;
import com.optiwms.infra.users.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Service to migrate existing plain text passwords to BCrypt hashed passwords
 */
@Service
public class PasswordMigrationService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public PasswordMigrationService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public int migrateAllPasswords() {
        List<UserEntity> users = userRepository.findAll();
        int migratedCount = 0;

        for (UserEntity user : users) {
            String passwordHash = user.getPasswordHash();
            
            // Check if password is already hashed (BCrypt hashes start with $2a$, $2b$, or $2y$)
            if (passwordHash != null && !passwordHash.startsWith("$2")) {
                // Hash the plain text password
                String hashedPassword = passwordEncoder.encode(passwordHash);
                user.setPasswordHash(hashedPassword);
                userRepository.save(user);
                migratedCount++;
            }
        }

        return migratedCount;
    }

    @Transactional
    public void migrateUserPassword(String username, String newPlainPassword) {
        UserEntity user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found: " + username));
        
        String hashedPassword = passwordEncoder.encode(newPlainPassword);
        user.setPasswordHash(hashedPassword);
        userRepository.save(user);
    }
}

