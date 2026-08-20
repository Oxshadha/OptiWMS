package com.optiwms.coreapi.service;

import com.optiwms.coredomain.pathfinding.AStarPathfinder;
import com.optiwms.coredomain.pathfinding.PathNode;
import com.optiwms.coreapi.dto.PathfindingDTO;
import org.springframework.stereotype.Service;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Service for A* pathfinding operations
 */
@Service
public class PathfindingService {
    
    /**
     * Find optimal path using A* algorithm
     */
    public PathfindingDTO.PathResponse findPath(PathfindingDTO.PathRequest request) {
        long startTime = System.currentTimeMillis();
        
        try {
            // Create pathfinder with warehouse grid
            AStarPathfinder pathfinder = new AStarPathfinder(request.getGridRows(), request.getGridCols());
            
            // Mark blocked locations
            if (request.getBlockedLocations() != null) {
                for (PathfindingDTO.BlockedLocation blocked : request.getBlockedLocations()) {
                    pathfinder.setBlocked(blocked.getRow(), blocked.getCol(), true);
                }
            }
            
            // Find path
            List<PathNode> path = pathfinder.findPath(
                request.getStartRow(), 
                request.getStartCol(),
                request.getEndRow(), 
                request.getEndCol()
            );
            
            long executionTime = System.currentTimeMillis() - startTime;
            
            // Convert to DTO
            List<PathfindingDTO.PathNode> pathDTO = path.stream()
                .map(node -> new PathfindingDTO.PathNode(
                    node.getRow(),
                    node.getCol(),
                    node.getGCost(),
                    node.getHCost(),
                    node.getFCost()
                ))
                .collect(Collectors.toList());
            
            return new PathfindingDTO.PathResponse(
                !path.isEmpty(),
                pathDTO,
                path.size(),
                executionTime,
                path.isEmpty() ? "No path found" : "Path found successfully"
            );
            
        } catch (Exception e) {
            long executionTime = System.currentTimeMillis() - startTime;
            return new PathfindingDTO.PathResponse(
                false,
                new ArrayList<>(),
                0,
                executionTime,
                "Error: " + e.getMessage()
            );
        }
    }
}
