package com.optiwms.coreapp.users;

import com.optiwms.domain.users.User;
import com.optiwms.infra.users.UserEntity;
import com.optiwms.infra.users.UserRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class UserService {
    private static final Set<String> WORKER_ROLES = new HashSet<>(Arrays.asList(
            "forklift_operator", "stacker_operator", "powered_pallet_truck_operator",
            "unloading_worker", "cycle_count_worker", "picker", "packer",
            "shipment_worker", "returns_worker", "vehicle_inspector", "warehouse_safekeeping_worker"
    ));

    private final UserRepository repository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository repository, PasswordEncoder passwordEncoder) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
    }

    public List<User> listAll() {
        return repository.findAll().stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<User> findByRole(String role) {
        return repository.findByRole(role).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<User> findByWarehouseId(UUID warehouseId) {
        return repository.findByWarehouseId(warehouseId).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public List<User> findByStatus(String status) {
        return repository.findByStatus(status).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    public User findById(UUID id) {
        return repository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("User not found: " + id));
    }

    public User findByUsername(String username) {
        return repository.findByUsername(username)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("User not found: " + username));
    }

    public Page<User> findPaged(String role, UUID warehouseId, String status, String query, Pageable pageable) {
        Specification<UserEntity> spec = (root, cq, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (warehouseId != null) {
                predicates.add(cb.equal(root.get("warehouseId"), warehouseId));
            }
            if (status != null && !status.isBlank()) {
                predicates.add(cb.equal(cb.lower(root.get("status")), status.toLowerCase()));
            }
            if (role != null && !role.isBlank()) {
                if ("worker".equalsIgnoreCase(role)) {
                    predicates.add(cb.lower(root.get("role")).in(WORKER_ROLES));
                } else {
                    predicates.add(cb.equal(cb.lower(root.get("role")), role.toLowerCase()));
                }
            }
            if (query != null && !query.isBlank()) {
                String pattern = "%" + query.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("username")), pattern),
                        cb.like(cb.lower(root.get("email")), pattern),
                        cb.like(cb.lower(root.get("employeeId")), pattern),
                        cb.like(cb.lower(root.get("firstName")), pattern),
                        cb.like(cb.lower(root.get("lastName")), pattern),
                        cb.like(cb.lower(root.get("phone")), pattern),
                        cb.like(cb.lower(root.get("role")), pattern),
                        cb.like(cb.lower(root.get("status")), pattern)
                ));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return repository.findAll(spec, pageable).map(this::toDomain);
    }

    @Transactional
    public User create(User user) {
        if (repository.findByUsername(user.getUsername()).isPresent()) {
            throw new RuntimeException("Username already exists: " + user.getUsername());
        }
        if (user.getEmail() != null && repository.findByEmail(user.getEmail()).isPresent()) {
            throw new RuntimeException("Email already exists: " + user.getEmail());
        }
        if (user.getEmployeeId() != null && repository.findByEmployeeId(user.getEmployeeId()).isPresent()) {
            throw new RuntimeException("Employee ID already exists: " + user.getEmployeeId());
        }

        UserEntity entity = new UserEntity();
        entity.setUsername(user.getUsername());
        entity.setEmail(user.getEmail());
        // Hash password if it's provided and not already hashed
        if (user.getPasswordHash() != null && !user.getPasswordHash().startsWith("$2a$")) {
            entity.setPasswordHash(passwordEncoder.encode(user.getPasswordHash()));
        } else {
            entity.setPasswordHash(user.getPasswordHash());
        }
        entity.setEmployeeId(user.getEmployeeId());
        entity.setFirstName(user.getFirstName());
        entity.setLastName(user.getLastName());
        entity.setRole(user.getRole());
        entity.setWarehouseId(user.getWarehouseId());
        entity.setPhone(user.getPhone());
        entity.setAvatarUrl(user.getAvatarUrl());
        entity.setStatus(user.getStatus() != null ? user.getStatus() : "active");
        entity.setDeviceId(user.getDeviceId());
        entity.setBlindReceivingMode(user.getBlindReceivingMode() != null ? user.getBlindReceivingMode() : false);
        entity.setDashboardSettings(user.getDashboardSettings());

        UserEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public User update(User user) {
        UserEntity entity = repository.findById(user.getId())
                .orElseThrow(() -> new RuntimeException("User not found: " + user.getId()));

        if (user.getEmail() != null && !user.getEmail().equals(entity.getEmail())) {
            if (repository.findByEmail(user.getEmail()).isPresent()) {
                throw new RuntimeException("Email already exists: " + user.getEmail());
            }
            entity.setEmail(user.getEmail());
        }
        if (user.getPasswordHash() != null) {
            // Hash password if it's provided and not already hashed
            if (!user.getPasswordHash().startsWith("$2a$")) {
                entity.setPasswordHash(passwordEncoder.encode(user.getPasswordHash()));
            } else {
                entity.setPasswordHash(user.getPasswordHash());
            }
        }
        if (user.getFirstName() != null) entity.setFirstName(user.getFirstName());
        if (user.getLastName() != null) entity.setLastName(user.getLastName());
        if (user.getRole() != null) entity.setRole(user.getRole());
        if (user.getWarehouseId() != null) entity.setWarehouseId(user.getWarehouseId());
        if (user.getPhone() != null) entity.setPhone(user.getPhone());
        if (user.getAvatarUrl() != null) entity.setAvatarUrl(user.getAvatarUrl());
        if (user.getStatus() != null) entity.setStatus(user.getStatus());
        if (user.getDeviceId() != null) entity.setDeviceId(user.getDeviceId());
        if (user.getBlindReceivingMode() != null) entity.setBlindReceivingMode(user.getBlindReceivingMode());
        if (user.getDashboardSettings() != null) entity.setDashboardSettings(user.getDashboardSettings());

        UserEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public void updateLastLogin(UUID id) {
        UserEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found: " + id));
        entity.setLastLoginAt(LocalDateTime.now());
        repository.save(entity);
    }

    @Transactional
    public void deleteById(UUID id) {
        repository.deleteById(id);
    }

    private User toDomain(UserEntity entity) {
        User u = new User();
        u.setId(entity.getId());
        u.setUsername(entity.getUsername());
        u.setEmail(entity.getEmail());
        u.setPasswordHash(entity.getPasswordHash());
        u.setEmployeeId(entity.getEmployeeId());
        u.setFirstName(entity.getFirstName());
        u.setLastName(entity.getLastName());
        u.setRole(entity.getRole());
        u.setWarehouseId(entity.getWarehouseId());
        u.setPhone(entity.getPhone());
        u.setAvatarUrl(entity.getAvatarUrl());
        u.setStatus(entity.getStatus());
        u.setDeviceId(entity.getDeviceId());
        u.setBlindReceivingMode(entity.getBlindReceivingMode() != null ? entity.getBlindReceivingMode() : false);
        u.setDashboardSettings(entity.getDashboardSettings());
        u.setLastLoginAt(entity.getLastLoginAt());
        u.setCreatedAt(entity.getCreatedAt());
        u.setUpdatedAt(entity.getUpdatedAt());
        return u;
    }
}
