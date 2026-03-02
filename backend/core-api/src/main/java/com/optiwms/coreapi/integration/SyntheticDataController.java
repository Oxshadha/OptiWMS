package com.optiwms.coreapi.integration;

import com.optiwms.integration.SyntheticDataGenerator;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/integration/synthetic")
@ConditionalOnProperty(name = "optiwms.synthetic-data.enabled", havingValue = "true")
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

    @PostMapping("/orders")
    public ResponseEntity<Map<String, Object>> generateOrders(@RequestBody GenerateOrdersRequest request) {
        try {
            int inboundCount = request.getInboundCount() != null ? request.getInboundCount() : 10;
            int outboundCount = request.getOutboundCount() != null ? request.getOutboundCount() : 15;
            int created = syntheticDataGenerator.generateOrders(inboundCount, outboundCount);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("created", created);
            response.put("message", "Orders generated successfully");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    @PostMapping("/tasks")
    public ResponseEntity<Map<String, Object>> generateTasks(@RequestBody GenerateTasksRequest request) {
        try {
            int pickingCount = request.getPickingCount() != null ? request.getPickingCount() : 20;
            int putawayCount = request.getPutawayCount() != null ? request.getPutawayCount() : 15;
            int packingCount = request.getPackingCount() != null ? request.getPackingCount() : 10;
            int created = syntheticDataGenerator.generateTasks(pickingCount, putawayCount, packingCount);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("created", created);
            response.put("message", "Tasks generated successfully");
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

    @PostMapping("/all-with-operations")
    public ResponseEntity<Map<String, Object>> generateAllWithOperations(@RequestBody GenerateAllWithOperationsRequest request) {
        try {
            int suppliersCount = request.getSuppliersCount() != null ? request.getSuppliersCount() : 15;
            int couriersCount = request.getCouriersCount() != null ? request.getCouriersCount() : 10;
            int customersCount = request.getCustomersCount() != null ? request.getCustomersCount() : 30;
            int inboundOrders = request.getInboundOrders() != null ? request.getInboundOrders() : 10;
            int outboundOrders = request.getOutboundOrders() != null ? request.getOutboundOrders() : 15;
            int pickingTasks = request.getPickingTasks() != null ? request.getPickingTasks() : 20;
            int putawayTasks = request.getPutawayTasks() != null ? request.getPutawayTasks() : 15;
            int packingTasks = request.getPackingTasks() != null ? request.getPackingTasks() : 10;
            
            SyntheticDataGenerator.GenerationResult result = 
                syntheticDataGenerator.generateAllWithOperations(
                    suppliersCount, couriersCount, customersCount,
                    inboundOrders, outboundOrders,
                    pickingTasks, putawayTasks, packingTasks);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("suppliersCreated", result.getSuppliersCreated());
            response.put("couriersCreated", result.getCouriersCreated());
            response.put("customersCreated", result.getCustomersCreated());
            response.put("ordersCreated", result.getOrdersCreated());
            response.put("tasksCreated", result.getTasksCreated());
            response.put("message", "All synthetic data with operations generated successfully");
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

    public static class GenerateOrdersRequest {
        private Integer inboundCount;
        private Integer outboundCount;

        public Integer getInboundCount() { return inboundCount; }
        public void setInboundCount(Integer inboundCount) { this.inboundCount = inboundCount; }
        
        public Integer getOutboundCount() { return outboundCount; }
        public void setOutboundCount(Integer outboundCount) { this.outboundCount = outboundCount; }
    }

    public static class GenerateTasksRequest {
        private Integer pickingCount;
        private Integer putawayCount;
        private Integer packingCount;

        public Integer getPickingCount() { return pickingCount; }
        public void setPickingCount(Integer pickingCount) { this.pickingCount = pickingCount; }
        
        public Integer getPutawayCount() { return putawayCount; }
        public void setPutawayCount(Integer putawayCount) { this.putawayCount = putawayCount; }
        
        public Integer getPackingCount() { return packingCount; }
        public void setPackingCount(Integer packingCount) { this.packingCount = packingCount; }
    }

    public static class GenerateAllWithOperationsRequest {
        private Integer suppliersCount;
        private Integer couriersCount;
        private Integer customersCount;
        private Integer inboundOrders;
        private Integer outboundOrders;
        private Integer pickingTasks;
        private Integer putawayTasks;
        private Integer packingTasks;

        public Integer getSuppliersCount() { return suppliersCount; }
        public void setSuppliersCount(Integer suppliersCount) { this.suppliersCount = suppliersCount; }
        
        public Integer getCouriersCount() { return couriersCount; }
        public void setCouriersCount(Integer couriersCount) { this.couriersCount = couriersCount; }
        
        public Integer getCustomersCount() { return customersCount; }
        public void setCustomersCount(Integer customersCount) { this.customersCount = customersCount; }
        
        public Integer getInboundOrders() { return inboundOrders; }
        public void setInboundOrders(Integer inboundOrders) { this.inboundOrders = inboundOrders; }
        
        public Integer getOutboundOrders() { return outboundOrders; }
        public void setOutboundOrders(Integer outboundOrders) { this.outboundOrders = outboundOrders; }
        
        public Integer getPickingTasks() { return pickingTasks; }
        public void setPickingTasks(Integer pickingTasks) { this.pickingTasks = pickingTasks; }
        
        public Integer getPutawayTasks() { return putawayTasks; }
        public void setPutawayTasks(Integer putawayTasks) { this.putawayTasks = putawayTasks; }
        
        public Integer getPackingTasks() { return packingTasks; }
        public void setPackingTasks(Integer packingTasks) { this.packingTasks = packingTasks; }
    }
}
