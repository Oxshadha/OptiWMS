package com.optiwms.infra.users;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<UserEntity, UUID> {
    Optional<UserEntity> findByUsername(String username);
    Optional<UserEntity> findByEmail(String email);
    Optional<UserEntity> findByEmployeeId(String employeeId);
    List<UserEntity> findByRole(String role);
    List<UserEntity> findByWarehouseId(UUID warehouseId);
    List<UserEntity> findByStatus(String status);
}

