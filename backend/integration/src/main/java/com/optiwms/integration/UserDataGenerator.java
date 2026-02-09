package com.optiwms.integration;

import com.optiwms.domain.users.User;
import com.optiwms.infra.users.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.UUID;

/**
 * Service to generate synthetic user data with proper password hashing
 */
@Service
public class UserDataGenerator {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final Random random = new Random();

    public UserDataGenerator(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public List<User> generateUsers(int adminCount, int warehouseManagerCount, int workerCount, List<UUID> warehouseIds) {
        List<User> generatedUsers = new ArrayList<>();
        
        // Generate admins
        for (int i = 0; i < adminCount; i++) {
            User admin = createUser("admin", "admin", warehouseIds, null);
            generatedUsers.add(admin);
        }

        // Generate warehouse managers
        for (int i = 0; i < warehouseManagerCount; i++) {
            UUID warehouseId = warehouseIds != null && !warehouseIds.isEmpty() 
                ? warehouseIds.get(i % warehouseIds.size()) 
                : null;
            User manager = createUser("warehouse_manager", "manager", warehouseIds, warehouseId);
            generatedUsers.add(manager);
        }

        // Generate workers (pickers, packers, etc.)
        String[] workerRoles = {"picker", "packer", "putaway", "receiver"};
        for (int i = 0; i < workerCount; i++) {
            String role = workerRoles[i % workerRoles.length];
            UUID warehouseId = warehouseIds != null && !warehouseIds.isEmpty() 
                ? warehouseIds.get(i % warehouseIds.size()) 
                : null;
            User worker = createUser(role, "worker", warehouseIds, warehouseId);
            generatedUsers.add(worker);
        }

        return generatedUsers;
    }

    private User createUser(String role, String userType, List<UUID> warehouseIds, UUID assignedWarehouseId) {
        User user = new User();
        
        // Generate unique username
        String baseUsername = role + "_" + userType;
        String username = baseUsername + "_" + System.currentTimeMillis() + "_" + random.nextInt(1000);
        
        // Check if username exists, append number if needed
        int suffix = 1;
        while (userRepository.findByUsername(username).isPresent()) {
            username = baseUsername + "_" + System.currentTimeMillis() + "_" + (random.nextInt(1000) + suffix);
            suffix++;
        }

        user.setUsername(username);
        user.setEmail(username + "@optiwms.com");
        
        // Generate password (default: "password123" for all users)
        String plainPassword = "password123";
        user.setPasswordHash(passwordEncoder.encode(plainPassword));
        
        user.setEmployeeId("EMP-" + random.nextInt(10000));
        user.setFirstName(generateFirstName());
        user.setLastName(generateLastName());
        user.setRole(role);
        user.setWarehouseId(assignedWarehouseId != null ? assignedWarehouseId : 
            (warehouseIds != null && !warehouseIds.isEmpty() ? warehouseIds.get(random.nextInt(warehouseIds.size())) : null));
        user.setPhone("+94-" + (random.nextInt(900000000) + 100000000));
        user.setStatus("active");
        user.setCreatedAt(OffsetDateTime.now());
        user.setUpdatedAt(OffsetDateTime.now());

        return user;
    }

    private String generateFirstName() {
        String[] firstNames = {"John", "Jane", "Mike", "Sarah", "David", "Emily", "Chris", "Lisa", "Robert", "Anna"};
        return firstNames[random.nextInt(firstNames.length)];
    }

    private String generateLastName() {
        String[] lastNames = {"Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez"};
        return lastNames[random.nextInt(lastNames.length)];
    }
}

