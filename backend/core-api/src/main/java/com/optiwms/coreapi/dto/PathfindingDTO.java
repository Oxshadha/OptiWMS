package com.optiwms.coreapi.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * DTO for A* Pathfinding
 */
public class PathfindingDTO {
    
    public static class PathRequest {
        private int startRow;
        private int startCol;
        private int endRow;
        private int endCol;
        private int gridRows;
        private int gridCols;
        private List<BlockedLocation> blockedLocations;
        
        public PathRequest() {}
        
        public PathRequest(int startRow, int startCol, int endRow, int endCol, 
                          int gridRows, int gridCols, List<BlockedLocation> blockedLocations) {
            this.startRow = startRow;
            this.startCol = startCol;
            this.endRow = endRow;
            this.endCol = endCol;
            this.gridRows = gridRows;
            this.gridCols = gridCols;
            this.blockedLocations = blockedLocations;
        }
        
        public int getStartRow() { return startRow; }
        public void setStartRow(int startRow) { this.startRow = startRow; }
        
        public int getStartCol() { return startCol; }
        public void setStartCol(int startCol) { this.startCol = startCol; }
        
        public int getEndRow() { return endRow; }
        public void setEndRow(int endRow) { this.endRow = endRow; }
        
        public int getEndCol() { return endCol; }
        public void setEndCol(int endCol) { this.endCol = endCol; }
        
        public int getGridRows() { return gridRows; }
        public void setGridRows(int gridRows) { this.gridRows = gridRows; }
        
        public int getGridCols() { return gridCols; }
        public void setGridCols(int gridCols) { this.gridCols = gridCols; }
        
        public List<BlockedLocation> getBlockedLocations() { return blockedLocations; }
        public void setBlockedLocations(List<BlockedLocation> blockedLocations) { this.blockedLocations = blockedLocations; }
    }
    
    public static class BlockedLocation {
        private int row;
        private int col;
        
        public BlockedLocation() {}
        
        public BlockedLocation(int row, int col) {
            this.row = row;
            this.col = col;
        }
        
        public int getRow() { return row; }
        public void setRow(int row) { this.row = row; }
        
        public int getCol() { return col; }
        public void setCol(int col) { this.col = col; }
    }
    
    public static class PathNode {
        private int row;
        private int col;
        private double gCost;
        private double hCost;
        private double fCost;
        
        public PathNode() {}
        
        public PathNode(int row, int col, double gCost, double hCost, double fCost) {
            this.row = row;
            this.col = col;
            this.gCost = gCost;
            this.hCost = hCost;
            this.fCost = fCost;
        }
        
        public int getRow() { return row; }
        public void setRow(int row) { this.row = row; }
        
        public int getCol() { return col; }
        public void setCol(int col) { this.col = col; }
        
        public double getGCost() { return gCost; }
        public void setGCost(double gCost) { this.gCost = gCost; }
        
        public double getHCost() { return hCost; }
        public void setHCost(double hCost) { this.hCost = hCost; }
        
        public double getFCost() { return fCost; }
        public void setFCost(double fCost) { this.fCost = fCost; }
    }
    
    public static class PathResponse {
        private boolean pathFound;
        private List<PathNode> path;
        private int pathLength;
        private long executionTimeMs;
        private String message;
        
        public PathResponse() {}
        
        public PathResponse(boolean pathFound, List<PathNode> path, int pathLength, 
                           long executionTimeMs, String message) {
            this.pathFound = pathFound;
            this.path = path;
            this.pathLength = pathLength;
            this.executionTimeMs = executionTimeMs;
            this.message = message;
        }
        
        public boolean isPathFound() { return pathFound; }
        public void setPathFound(boolean pathFound) { this.pathFound = pathFound; }
        
        public List<PathNode> getPath() { return path; }
        public void setPath(List<PathNode> path) { this.path = path; }
        
        public int getPathLength() { return pathLength; }
        public void setPathLength(int pathLength) { this.pathLength = pathLength; }
        
        public long getExecutionTimeMs() { return executionTimeMs; }
        public void setExecutionTimeMs(long executionTimeMs) { this.executionTimeMs = executionTimeMs; }
        
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
    }
}
