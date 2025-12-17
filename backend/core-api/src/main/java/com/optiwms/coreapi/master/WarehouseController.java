package com.optiwms.coreapi.master;

import com.optiwms.coreapp.master.WarehouseService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/master/warehouses")
public class WarehouseController {

    private final WarehouseService service;

    public WarehouseController(WarehouseService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<WarehouseDto>> list() {
        var data = service.listAll().stream()
                .map(w -> new WarehouseDto(w.getId(), w.getCode(), w.getName(), w.getStatus()))
                .toList();
        return ResponseEntity.ok(data);
    }
}


