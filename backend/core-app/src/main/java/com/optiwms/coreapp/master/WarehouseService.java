package com.optiwms.coreapp.master;

import com.optiwms.domain.master.Warehouse;
import com.optiwms.infra.master.WarehouseEntity;
import com.optiwms.infra.master.WarehouseRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class WarehouseService {

    private final WarehouseRepository repository;

    public WarehouseService(WarehouseRepository repository) {
        this.repository = repository;
    }

    public List<Warehouse> listAll() {
        return repository.findAll().stream().map(this::toDomain).collect(Collectors.toList());
    }

    private Warehouse toDomain(WarehouseEntity entity) {
        Warehouse w = new Warehouse();
        w.setId(entity.getId());
        w.setCode(entity.getCode());
        w.setName(entity.getName());
        w.setStatus(entity.getStatus());
        return w;
    }
}


