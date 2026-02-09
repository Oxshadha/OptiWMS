package com.optiwms.integration;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

/**
 * Creates default admin user if no users exist in the system
 * This allows initial login when the system is first set up
 */
@Component
public class DefaultUserSeeder implements CommandLineRunner {

    private final UserSeederService userSeederService;

    public DefaultUserSeeder(UserSeederService userSeederService) {
        this.userSeederService = userSeederService;
    }

    @Override
    public void run(String... args) throws Exception {
        // Ensure default admin exists and password is properly hashed
        userSeederService.ensureDefaultAdminExists();
    }
}

