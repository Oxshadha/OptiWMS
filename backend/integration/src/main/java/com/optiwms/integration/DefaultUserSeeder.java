package com.optiwms.integration;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Creates default admin user if no users exist in the system
 * This allows initial login when the system is first set up
 */
@Component
@ConditionalOnProperty(prefix = "optiwms.seed.default-admin", name = "enabled", havingValue = "true")
public class DefaultUserSeeder implements CommandLineRunner {

    private final UserSeederService userSeederService;
    private final String username;
    private final String email;
    private final String password;

    public DefaultUserSeeder(
            UserSeederService userSeederService,
            @Value("${optiwms.seed.default-admin.username:}") String username,
            @Value("${optiwms.seed.default-admin.email:}") String email,
            @Value("${optiwms.seed.default-admin.password:}") String password) {
        this.userSeederService = userSeederService;
        this.username = username;
        this.email = email;
        this.password = password;
    }

    @Override
    public void run(String... args) {
        userSeederService.ensureDefaultAdminExists(username, email, password);
    }
}
