package com.optiwms.coreapi.integration;

import com.optiwms.integration.PasswordMigrationService;
import com.optiwms.integration.UserDataGenerator;
import com.optiwms.infra.master.WarehouseRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/integration/users")
public class UserManagementController {

    private final UserDataGenerator userDataGenerator;
    private final PasswordMigrationService passwordMigrationService;
    private final WarehouseRepository warehouseRepository;

    public UserManagementController(
            UserDataGenerator userDataGenerator,
            PasswordMigrationService passwordMigrationService,
            WarehouseRepository warehouseRepository) {
        this.userDataGenerator = userDataGenerator;
        this.passwordMigrationService = passwordMigrationService;
        this.warehouseRepository = warehouseRepository;
    }

    @PostMapping("/generate")
    public ResponseEntity<Map<String, Object>> generateUsers(@RequestBody GenerateUsersRequest request) {
        try {
            // Get warehouse IDs
            List<UUID> warehouseIds = warehouseRepository.findAll().stream()
                    .map(w -> w.getId())
                    .collect(Collectors.toList());

            int adminCount = request.getAdminCount() != null ? request.getAdminCount() : 2;
            int warehouseManagerCount = request.getWarehouseManagerCount() != null ? request.getWarehouseManagerCount() : 5;
            int workerCount = request.getWorkerCount() != null ? request.getWorkerCount() : 20;

            List<com.optiwms.domain.users.User> users = userDataGenerator.generateUsers(
                    adminCount, warehouseManagerCount, workerCount, warehouseIds);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("created", users.size());
            response.put("admins", adminCount);
            response.put("warehouseManagers", warehouseManagerCount);
            response.put("workers", workerCount);
            response.put("message", "Users generated successfully. Default password: password123");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    @PostMapping("/migrate-passwords")
    public ResponseEntity<Map<String, Object>> migratePasswords() {
        try {
            int migratedCount = passwordMigrationService.migrateAllPasswords();
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("migrated", migratedCount);
            response.put("message", "Password migration completed");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    public static class GenerateUsersRequest {
        private Integer adminCount;
        private Integer warehouseManagerCount;
        private Integer workerCount;

        public Integer getAdminCount() { return adminCount; }
        public void setAdminCount(Integer adminCount) { this.adminCount = adminCount; }
        public Integer getWarehouseManagerCount() { return warehouseManagerCount; }
        public void setWarehouseManagerCount(Integer warehouseManagerCount) { this.warehouseManagerCount = warehouseManagerCount; }
        public Integer getWorkerCount() { return workerCount; }
        public void setWorkerCount(Integer workerCount) { this.workerCount = workerCount; }
    }
}

