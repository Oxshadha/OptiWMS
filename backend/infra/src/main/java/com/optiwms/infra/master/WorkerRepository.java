package com.optiwms.infra.master;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WorkerRepository extends JpaRepository<WorkerEntity, UUID> {
    Optional<WorkerEntity> findByUsername(String username);
    Optional<WorkerEntity> findByEmail(String email);
    Optional<WorkerEntity> findByEmployeeId(String employeeId);
    List<WorkerEntity> findByWarehouseId(UUID warehouseId);
    List<WorkerEntity> findByRole(String role);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
    boolean existsByEmployeeId(String employeeId);
}

