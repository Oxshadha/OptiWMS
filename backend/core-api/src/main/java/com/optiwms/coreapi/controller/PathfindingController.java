package com.optiwms.coreapi.controller;

import com.optiwms.coreapi.dto.PathfindingDTO;
import com.optiwms.coreapi.service.PathfindingService;
import com.optiwms.coreapp.master.LocationService;
import com.optiwms.domain.master.Location;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import java.util.stream.Collectors;

/**
 * REST API for A* Pathfinding
 */
@RestController
@RequestMapping("/api/pathfinding")
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class PathfindingController {
    
    @Autowired
    private PathfindingService pathfindingService;
    
    @Autowired
    private LocationService locationService;
    
    /**
     * Find optimal path using A* algorithm
     * POST /api/pathfinding/find-path
     */
    @PostMapping("/find-path")
    public ResponseEntity<PathfindingDTO.PathResponse> findPath(
            @RequestBody PathfindingDTO.PathRequest request) {
        try {
            PathfindingDTO.PathResponse response = pathfindingService.findPath(request);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }
    
    /**
     * Health check for pathfinding service
     */
    @GetMapping("/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("Pathfinding service is running");
    }
    
    /**
     * Get warehouse graph with ALL real racks for pathfinding visualization
     * GET /api/pathfinding/warehouse/graph?warehouseId={id}
     * Returns nodes (all racks) and edges (connections) from database
     */
    @GetMapping("/warehouse/graph")
    public ResponseEntity<Map<String, Object>> getWarehouseGraph(
            @RequestParam(required = false) String warehouseId) {
        try {
            // Get all storage locations from database (all 72 real racks!)
            List<Location> locations;
            if (warehouseId != null && !warehouseId.isEmpty()) {
                locations = locationService.findStorageLocationsByWarehouse(UUID.fromString(warehouseId));
            } else {
                // Get ALL storage locations (including all warehouses)
                locations = locationService.listAll().stream()
                        .collect(Collectors.toList());
            }
            
            // Filter to storage type locations only (racks, not staging/receiving areas)
            locations = locations.stream()
                    .filter(loc -> "storage".equalsIgnoreCase(loc.getLocationType()) || 
                                   "RACK".equalsIgnoreCase(loc.getLocationType()) ||
                                   "STORAGE".equalsIgnoreCase(loc.getZoneType()))
                    .collect(Collectors.toList());
            
            // Deduplicate to get UNIQUE RACKS only (don't include individual bin locations)
            // Group by (area, row, bay) to get one rack per unique combination
            Map<String, Location> uniqueRacks = new LinkedHashMap<>();
            for (Location loc : locations) {
                String rackKey = loc.getArea() + "-" + loc.getRowNumber() + "-" + loc.getBayNumber();
                // Keep first (lowest level) for each rack
                if (!uniqueRacks.containsKey(rackKey)) {
                    uniqueRacks.put(rackKey, loc);
                }
            }
            
            List<Location> racksList = new ArrayList<>(uniqueRacks.values());
            
            // Sort by area, row, bay
            racksList.sort((a, b) -> {
                int areaCompare = a.getArea().compareTo(b.getArea());
                if (areaCompare != 0) return areaCompare;
                int rowCompare = a.getRowNumber().compareTo(b.getRowNumber());
                if (rowCompare != 0) return rowCompare;
                return a.getBayNumber().compareTo(b.getBayNumber());
            });
            
            // Convert locations to nodes
            List<Map<String, Object>> nodes = new ArrayList<>();
            nodes.add(Map.of(
                    "id", "ENTRY",
                    "type", "entry",
                    "walkable", true,
                    "locationType", "entry"
            ));
            
            // Add unique racks as nodes
            for (int i = 0; i < racksList.size(); i++) {
                Location loc = racksList.get(i);
                nodes.add(Map.of(
                        "id", loc.getArea() + "-" + loc.getRowNumber() + "-" + loc.getBayNumber(),
                        "area", loc.getArea(),
                        "row", loc.getRowNumber(),
                        "bay", loc.getBayNumber(),
                        "type", "rack",
                        "walkable", true,
                        "locationCode", loc.getLocationCode(),
                        "index", i,
                        "zoneType", loc.getZoneType() != null ? loc.getZoneType() : "STORAGE"
                ));
            }
            
            nodes.add(Map.of(
                    "id", "EXIT",
                    "type", "exit",
                    "walkable", true,
                    "locationType", "exit"
            ));
            
            // Create edges connecting nearby racks
            List<Map<String, Object>> edges = new ArrayList<>();
            
            // Connect entry to first few racks
            if (racksList.size() > 0) {
                for (int i = 0; i < Math.min(5, racksList.size()); i++) {
                    Location loc = racksList.get(i);
                    edges.add(Map.of(
                            "from", "ENTRY",
                            "to", loc.getArea() + "-" + loc.getRowNumber() + "-" + loc.getBayNumber(),
                            "cost", 5.0
                    ));
                }
            }
            
            // Connect sequential racks in same row/column
            for (int i = 0; i < racksList.size() - 1; i++) {
                Location current = racksList.get(i);
                Location next = racksList.get(i + 1);
                
                if (current.getArea().equals(next.getArea()) && 
                    current.getRowNumber().equals(next.getRowNumber())) {
                    // Adjacent bays in same row - connection
                    edges.add(Map.of(
                            "from", current.getArea() + "-" + current.getRowNumber() + "-" + current.getBayNumber(),
                            "to", next.getArea() + "-" + next.getRowNumber() + "-" + next.getBayNumber(),
                            "cost", 1.5,
                            "bidirectional", true
                    ));
                }
            }
            
            // Connect to last few racks from exit
            if (racksList.size() > 0) {
                for (int i = Math.max(0, racksList.size() - 5); i < racksList.size(); i++) {
                    Location loc = racksList.get(i);
                    edges.add(Map.of(
                            "from", loc.getArea() + "-" + loc.getRowNumber() + "-" + loc.getBayNumber(),
                            "to", "EXIT",
                            "cost", 4.0
                    ));
                }
            }
            
            // Build response
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("name", "Warehouse Layout");
            response.put("nodes", nodes);
            response.put("edges", edges);
            response.put("totalRacks", racksList.size());
            response.put("totalBins", locations.size());
            response.put("timestamp", System.currentTimeMillis());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("error", "Failed to load warehouse graph: " + e.getMessage()));
        }
    }
}
