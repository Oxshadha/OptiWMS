package com.optiwms.coreapp.master;

import com.optiwms.domain.master.Worker;
import com.optiwms.infra.master.WorkerEntity;
import com.optiwms.infra.master.WorkerRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class WorkerService {

    private final WorkerRepository repository;

    public WorkerService(WorkerRepository repository) {
        this.repository = repository;
    }

    public List<Worker> listAll() {
        return repository.findAll().stream().map(this::toDomain).collect(Collectors.toList());
    }

    public Worker findById(UUID id) {
        return repository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Worker not found: " + id));
    }

    public List<Worker> findByWarehouseId(UUID warehouseId) {
        return repository.findByWarehouseId(warehouseId).stream().map(this::toDomain).collect(Collectors.toList());
    }

    @Transactional
    public Worker create(Worker worker) {
        if (repository.existsByUsername(worker.getUsername())) {
            throw new RuntimeException("Username already exists: " + worker.getUsername());
        }
        if (worker.getEmail() != null && repository.existsByEmail(worker.getEmail())) {
            throw new RuntimeException("Email already exists: " + worker.getEmail());
        }
        if (worker.getEmployeeId() != null && repository.existsByEmployeeId(worker.getEmployeeId())) {
            throw new RuntimeException("Employee ID already exists: " + worker.getEmployeeId());
        }

        WorkerEntity entity = new WorkerEntity();
        entity.setUsername(worker.getUsername());
        entity.setEmail(worker.getEmail());
        entity.setPasswordHash(worker.getPasswordHash());
        entity.setEmployeeId(worker.getEmployeeId());
        entity.setFirstName(worker.getFirstName());
        entity.setLastName(worker.getLastName());
        entity.setRole(worker.getRole() != null ? worker.getRole() : "worker");
        entity.setWarehouseId(worker.getWarehouseId());
        entity.setPhone(worker.getPhone());
        entity.setAvatarUrl(worker.getAvatarUrl());
        entity.setStatus(worker.getStatus() != null ? worker.getStatus() : "active");
        entity.setDeviceId(worker.getDeviceId());

        WorkerEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public Worker update(UUID id, Worker worker) {
        WorkerEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Worker not found: " + id));

        if (!entity.getUsername().equals(worker.getUsername()) && repository.existsByUsername(worker.getUsername())) {
            throw new RuntimeException("Username already exists: " + worker.getUsername());
        }
        if (worker.getEmail() != null && !entity.getEmail().equals(worker.getEmail()) && repository.existsByEmail(worker.getEmail())) {
            throw new RuntimeException("Email already exists: " + worker.getEmail());
        }

        entity.setUsername(worker.getUsername());
        entity.setEmail(worker.getEmail());
        if (worker.getPasswordHash() != null) {
            entity.setPasswordHash(worker.getPasswordHash());
        }
        entity.setEmployeeId(worker.getEmployeeId());
        entity.setFirstName(worker.getFirstName());
        entity.setLastName(worker.getLastName());
        entity.setRole(worker.getRole());
        entity.setWarehouseId(worker.getWarehouseId());
        entity.setPhone(worker.getPhone());
        entity.setAvatarUrl(worker.getAvatarUrl());
        entity.setStatus(worker.getStatus());
        entity.setDeviceId(worker.getDeviceId());

        WorkerEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public void delete(UUID id) {
        if (!repository.existsById(id)) {
            throw new RuntimeException("Worker not found: " + id);
        }
        repository.deleteById(id);
    }

    private Worker toDomain(WorkerEntity entity) {
        Worker worker = new Worker();
        worker.setId(entity.getId());
        worker.setUsername(entity.getUsername());
        worker.setEmail(entity.getEmail());
        worker.setPasswordHash(entity.getPasswordHash());
        worker.setEmployeeId(entity.getEmployeeId());
        worker.setFirstName(entity.getFirstName());
        worker.setLastName(entity.getLastName());
        worker.setRole(entity.getRole());
        worker.setWarehouseId(entity.getWarehouseId());
        worker.setPhone(entity.getPhone());
        worker.setAvatarUrl(entity.getAvatarUrl());
        worker.setStatus(entity.getStatus());
        worker.setDeviceId(entity.getDeviceId());
        worker.setLastLoginAt(entity.getLastLoginAt());
        return worker;
    }
}

