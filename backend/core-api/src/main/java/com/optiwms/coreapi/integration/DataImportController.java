package com.optiwms.coreapi.integration;

import com.optiwms.integration.CsvDataImporter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/integration/import")
public class DataImportController {

    @Autowired
    private CsvDataImporter csvDataImporter;

    @PostMapping("/materials")
    public ResponseEntity<Map<String, Object>> importMaterials(@RequestBody ImportRequest request) {
        try {
            int imported = csvDataImporter.importMaterials(request.getCsvPath());
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("imported", imported);
            response.put("message", "Materials imported successfully");
            return ResponseEntity.ok(response);
        } catch (IOException e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    @PostMapping("/inventory")
    public ResponseEntity<Map<String, Object>> importInventory(@RequestBody InventoryImportRequest request) {
        try {
            UUID warehouseId = UUID.fromString(request.getWarehouseId());
            CsvDataImporter.ImportResult result = csvDataImporter.importInventoryAndSupplyPlans(
                    request.getCsvPath(), warehouseId);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("materialsProcessed", result.getMaterialsProcessed());
            response.put("inventoryCreated", result.getInventoryCreated());
            response.put("supplyPlansCreated", result.getSupplyPlansCreated());
            response.put("errors", result.getErrors());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    @PostMapping("/non-pallet-materials")
    public ResponseEntity<Map<String, Object>> updateNonPalletMaterials(@RequestBody ImportRequest request) {
        try {
            int updated = csvDataImporter.updateNonPalletMaterials(request.getCsvPath());
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("updated", updated);
            response.put("message", "Non-pallet materials updated successfully");
            return ResponseEntity.ok(response);
        } catch (IOException e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    public static class ImportRequest {
        private String csvPath;

        public String getCsvPath() {
            return csvPath;
        }

        public void setCsvPath(String csvPath) {
            this.csvPath = csvPath;
        }
    }

    public static class InventoryImportRequest {
        private String csvPath;
        private String warehouseId;

        public String getCsvPath() {
            return csvPath;
        }

        public void setCsvPath(String csvPath) {
            this.csvPath = csvPath;
        }

        public String getWarehouseId() {
            return warehouseId;
        }

        public void setWarehouseId(String warehouseId) {
            this.warehouseId = warehouseId;
        }
    }
}

