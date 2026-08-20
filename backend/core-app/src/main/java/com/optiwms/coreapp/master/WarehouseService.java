package com.optiwms.coreapp.master;

import com.optiwms.domain.master.Warehouse;
import com.optiwms.infra.master.WarehouseEntity;
import com.optiwms.infra.master.LocationRepository;
import com.optiwms.infra.master.WarehouseRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class WarehouseService {

    private static final String CURRENT_OPERATIONAL_DATASET = "PROJECT_OPERATIONAL_SIMULATION_V8";
    private static final List<String> OPERATIONAL_DATASETS = List.of(
            CURRENT_OPERATIONAL_DATASET,
            "PROJECT_OPERATIONAL_BASELINE_V3",
            "OPERATIONAL_ENTRY"
    );

    private final WarehouseRepository repository;
    private final LocationRepository locationRepository;

    public WarehouseService(WarehouseRepository repository, LocationRepository locationRepository) {
        this.repository = repository;
        this.locationRepository = locationRepository;
    }

    public List<Warehouse> listAll() {
        return repository.findAll().stream().map(this::toDomain).collect(Collectors.toList());
    }

    public List<Warehouse> listOperational() {
        return repository.findByDatasetVersionIn(OPERATIONAL_DATASETS).stream()
                .filter(entity -> "active".equalsIgnoreCase(entity.getStatus()))
                .sorted(Comparator
                        .comparingInt((WarehouseEntity entity) ->
                                CURRENT_OPERATIONAL_DATASET.equals(entity.getDatasetVersion()) ? 0 : 1)
                        .thenComparing(WarehouseEntity::getCode))
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    /**
     * Operational warehouses that can actually take a receipt.
     *
     * {@link #listOperational()} intentionally spans several dataset versions so historical
     * orders still resolve their warehouse. Order creation needs the narrower set: a legacy
     * warehouse whose racks are all archived owns no active bin, so every capacity check
     * against it fails and any order placed there is dead on arrival.
     */
    public List<Warehouse> listReceivable() {
        java.util.Set<java.util.UUID> receivable =
                new java.util.HashSet<>(locationRepository.findWarehouseIdsWithReceivableStorage());
        return listOperational().stream()
                .filter(warehouse -> receivable.contains(warehouse.getId()))
                .collect(Collectors.toList());
    }

    public Warehouse findById(java.util.UUID id) {
        return repository.findById(id)
                .map(this::toDomain)
                .orElseThrow(() -> new RuntimeException("Warehouse not found: " + id));
    }

    @Transactional
    public Warehouse create(Warehouse warehouse) {
        if (repository.existsByCode(warehouse.getCode())) {
            throw new RuntimeException("Warehouse code already exists: " + warehouse.getCode());
        }

        WarehouseEntity entity = new WarehouseEntity();
        entity.setCode(warehouse.getCode());
        entity.setName(warehouse.getName());
        entity.setAddress(warehouse.getAddress());
        entity.setCity(warehouse.getCity());
        entity.setCountry(warehouse.getCountry() != null ? warehouse.getCountry() : "Sri Lanka");
        entity.setContactPerson(warehouse.getContactPerson());
        entity.setPhone(warehouse.getPhone());
        entity.setEmail(warehouse.getEmail());
        entity.setStatus(warehouse.getStatus() != null ? warehouse.getStatus() : "active");

        WarehouseEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public Warehouse update(java.util.UUID id, Warehouse warehouse) {
        WarehouseEntity entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Warehouse not found: " + id));

        // Check if code is being changed and if it conflicts
        if (!entity.getCode().equals(warehouse.getCode())) {
            if (repository.existsByCode(warehouse.getCode())) {
                throw new RuntimeException("Warehouse code already exists: " + warehouse.getCode());
            }
        }

        entity.setCode(warehouse.getCode());
        entity.setName(warehouse.getName());
        entity.setAddress(warehouse.getAddress());
        entity.setCity(warehouse.getCity());
        entity.setCountry(warehouse.getCountry());
        entity.setContactPerson(warehouse.getContactPerson());
        entity.setPhone(warehouse.getPhone());
        entity.setEmail(warehouse.getEmail());
        entity.setStatus(warehouse.getStatus());

        WarehouseEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Transactional
    public void delete(java.util.UUID id) {
        if (!repository.existsById(id)) {
            throw new RuntimeException("Warehouse not found: " + id);
        }
        repository.deleteById(id);
    }

    private Warehouse toDomain(WarehouseEntity entity) {
        Warehouse w = new Warehouse();
        w.setId(entity.getId());
        w.setCode(entity.getCode());
        w.setName(entity.getName());
        w.setAddress(entity.getAddress());
        w.setCity(entity.getCity());
        w.setCountry(entity.getCountry());
        w.setContactPerson(entity.getContactPerson());
        w.setPhone(entity.getPhone());
        w.setEmail(entity.getEmail());
        w.setStatus(entity.getStatus());
        return w;
    }
}
