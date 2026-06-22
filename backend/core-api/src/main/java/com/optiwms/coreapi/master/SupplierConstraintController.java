package com.optiwms.coreapi.master;

import com.optiwms.coreapp.master.SupplierConstraintService;
import com.optiwms.domain.master.SupplierConstraint;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/suppliers/constraints")
public class SupplierConstraintController {

    private final SupplierConstraintService supplierConstraintService;

    public SupplierConstraintController(SupplierConstraintService supplierConstraintService) {
        this.supplierConstraintService = supplierConstraintService;
    }

    @GetMapping("/supplier/{supplierId}")
    public ResponseEntity<List<SupplierConstraint>> getConstraintsBySupplier(@PathVariable UUID supplierId) {
        return ResponseEntity.ok(supplierConstraintService.getConstraintsBySupplier(supplierId));
    }

    @GetMapping("/material/{materialId}")
    public ResponseEntity<List<SupplierConstraint>> getConstraintsByMaterial(@PathVariable UUID materialId) {
        return ResponseEntity.ok(supplierConstraintService.getConstraintsByMaterial(materialId));
    }

    @PostMapping
    public ResponseEntity<SupplierConstraint> createConstraint(@RequestBody SupplierConstraint constraint) {
        return ResponseEntity.ok(supplierConstraintService.createOrUpdateConstraint(constraint));
    }

    @PutMapping("/{id}")
    public ResponseEntity<SupplierConstraint> updateConstraint(@PathVariable UUID id, @RequestBody SupplierConstraint constraint) {
        constraint.setId(id);
        return ResponseEntity.ok(supplierConstraintService.createOrUpdateConstraint(constraint));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteConstraint(@PathVariable UUID id) {
        supplierConstraintService.deleteConstraint(id);
        return ResponseEntity.noContent().build();
    }
}
