package com.optiwms.coredomain.pathfinding;

import java.util.*;

/**
 * A* Pathfinding Algorithm for warehouse navigation
 */
public class AStarPathfinder {
    
    private PathNode[][] grid;
    private int rows;
    private int cols;
    private PriorityQueue<PathNode> openSet;
    private Set<PathNode> closedSet;
    
    public AStarPathfinder(int rows, int cols) {
        this.rows = rows;
        this.cols = cols;
        this.grid = new PathNode[rows][cols];
        this.openSet = new PriorityQueue<>();
        this.closedSet = new HashSet<>();
        
        // Initialize grid with walkable nodes
        for (int i = 0; i < rows; i++) {
            for (int j = 0; j < cols; j++) {
                grid[i][j] = new PathNode(i, j, true);
            }
        }
    }
    
    /**
     * Mark a location as blocked/non-walkable
     */
    public void setBlocked(int row, int col, boolean blocked) {
        if (isValidPosition(row, col)) {
            grid[row][col].setWalkable(!blocked);
        }
    }
    
    /**
     * Find path from start to end using A* algorithm
     * @return List of nodes representing the path
     */
    public List<PathNode> findPath(int startRow, int startCol, int endRow, int endCol) {
        // Reset grid
        resetGrid();
        
        PathNode startNode = grid[startRow][startCol];
        PathNode endNode = grid[endRow][endCol];
        
        if (!startNode.isWalkable() || !endNode.isWalkable()) {
            return new ArrayList<>();
        }
        
        // Initialize start node
        startNode.setGCost(0);
        startNode.setHCost(calculateHeuristic(startNode, endNode));
        startNode.calculateFCost();
        
        openSet.add(startNode);
        
        while (!openSet.isEmpty()) {
            PathNode current = openSet.poll();
            closedSet.add(current);
            
            // Found the goal
            if (current.equals(endNode)) {
                return reconstructPath(current);
            }
            
            // Check all neighbors
            List<PathNode> neighbors = getWalkableNeighbors(current);
            
            for (PathNode neighbor : neighbors) {
                if (closedSet.contains(neighbor)) {
                    continue;
                }
                
                double newGCost = current.getGCost() + getDistance(current, neighbor);
                
                if (!openSet.contains(neighbor)) {
                    neighbor.setGCost(newGCost);
                    neighbor.setHCost(calculateHeuristic(neighbor, endNode));
                    neighbor.calculateFCost();
                    neighbor.setParent(current);
                    openSet.add(neighbor);
                } else if (newGCost < neighbor.getGCost()) {
                    neighbor.setGCost(newGCost);
                    neighbor.calculateFCost();
                    neighbor.setParent(current);
                }
            }
        }
        
        // No path found
        return new ArrayList<>();
    }
    
    /**
     * Manhattan distance heuristic
     */
    private double calculateHeuristic(PathNode from, PathNode to) {
        return Math.abs(from.getRow() - to.getRow()) + Math.abs(from.getCol() - to.getCol());
    }
    
    /**
     * Euclidean distance
     */
    private double getDistance(PathNode from, PathNode to) {
        int dx = from.getRow() - to.getRow();
        int dy = from.getCol() - to.getCol();
        
        // Diagonal movement costs sqrt(2), straight costs 1
        if (dx != 0 && dy != 0) {
            return Math.sqrt(2);
        }
        return 1.0;
    }
    
    /**
     * Get all walkable neighbors (8-directional)
     */
    private List<PathNode> getWalkableNeighbors(PathNode node) {
        List<PathNode> neighbors = new ArrayList<>();
        int row = node.getRow();
        int col = node.getCol();
        
        // 8 directions: up, down, left, right, and diagonals
        int[][] directions = {
            {-1, 0}, {1, 0}, {0, -1}, {0, 1}, // Cardinal
            {-1, -1}, {-1, 1}, {1, -1}, {1, 1} // Diagonal
        };
        
        for (int[] dir : directions) {
            int newRow = row + dir[0];
            int newCol = col + dir[1];
            
            if (isValidPosition(newRow, newCol) && grid[newRow][newCol].isWalkable()) {
                neighbors.add(grid[newRow][newCol]);
            }
        }
        
        return neighbors;
    }
    
    /**
     * Reconstruct path from end node back to start
     */
    private List<PathNode> reconstructPath(PathNode current) {
        List<PathNode> path = new ArrayList<>();
        while (current != null) {
            path.add(0, current);
            current = current.getParent();
        }
        return path;
    }
    
    /**
     * Reset grid costs for next search
     */
    private void resetGrid() {
        openSet.clear();
        closedSet.clear();
        
        for (int i = 0; i < rows; i++) {
            for (int j = 0; j < cols; j++) {
                PathNode node = grid[i][j];
                node.setGCost(Double.MAX_VALUE);
                node.setHCost(0);
                node.setFCost(Double.MAX_VALUE);
                node.setParent(null);
            }
        }
    }
    
    /**
     * Validate grid position
     */
    private boolean isValidPosition(int row, int col) {
        return row >= 0 && row < rows && col >= 0 && col < cols;
    }
}
