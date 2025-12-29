package com.optiwms.coreapi.integration;

import com.optiwms.integration.SyntheticDataGenerator;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/integration/synthetic")
public class SyntheticDataController {

    @Autowired
    private SyntheticDataGenerator syntheticDataGenerator;

    @PostMapping("/suppliers")
    public ResponseEntity<Map<String, Object>> generateSuppliers(@RequestBody GenerateRequest request) {
        try {
            int count = request.getCount() != null ? request.getCount() : 15;
            int created = syntheticDataGenerator.generateSuppliers(count);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("created", created);
            response.put("message", "Suppliers generated successfully");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    @PostMapping("/delivery-partners")
    public ResponseEntity<Map<String, Object>> generateDeliveryPartners(@RequestBody GenerateRequest request) {
        try {
            int count = request.getCount() != null ? request.getCount() : 10;
            int created = syntheticDataGenerator.generateDeliveryPartners(count);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("created", created);
            response.put("message", "Delivery partners generated successfully");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    @PostMapping("/customers")
    public ResponseEntity<Map<String, Object>> generateCustomers(@RequestBody GenerateRequest request) {
        try {
            int count = request.getCount() != null ? request.getCount() : 30;
            int created = syntheticDataGenerator.generateCustomers(count);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("created", created);
            response.put("message", "Customers generated successfully");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    @PostMapping("/all")
    public ResponseEntity<Map<String, Object>> generateAll(@RequestBody GenerateAllRequest request) {
        try {
            int suppliersCount = request.getSuppliersCount() != null ? request.getSuppliersCount() : 15;
            int couriersCount = request.getCouriersCount() != null ? request.getCouriersCount() : 10;
            int customersCount = request.getCustomersCount() != null ? request.getCustomersCount() : 30;
            
            SyntheticDataGenerator.GenerationResult result = 
                syntheticDataGenerator.generateAll(suppliersCount, couriersCount, customersCount);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("suppliersCreated", result.getSuppliersCreated());
            response.put("couriersCreated", result.getCouriersCreated());
            response.put("customersCreated", result.getCustomersCreated());
            response.put("message", "All synthetic data generated successfully");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    public static class GenerateRequest {
        private Integer count;

        public Integer getCount() {
            return count;
        }

        public void setCount(Integer count) {
            this.count = count;
        }
    }

    public static class GenerateAllRequest {
        private Integer suppliersCount;
        private Integer couriersCount;
        private Integer customersCount;

        public Integer getSuppliersCount() { return suppliersCount; }
        public void setSuppliersCount(Integer suppliersCount) { this.suppliersCount = suppliersCount; }
        
        public Integer getCouriersCount() { return couriersCount; }
        public void setCouriersCount(Integer couriersCount) { this.couriersCount = couriersCount; }
        
        public Integer getCustomersCount() { return customersCount; }
        public void setCustomersCount(Integer customersCount) { this.customersCount = customersCount; }
    }
}

