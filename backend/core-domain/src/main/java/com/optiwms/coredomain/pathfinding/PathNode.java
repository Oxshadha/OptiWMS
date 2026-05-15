package com.optiwms.coredomain.pathfinding;

/**
 * Represents a node in the warehouse grid for A* pathfinding
 */
public class PathNode implements Comparable<PathNode> {
    private int row;
    private int col;
    private boolean walkable;
    
    // A* algorithm costs
    private double gCost = Double.MAX_VALUE; // Cost from start
    private double hCost = 0; // Heuristic cost to end
    private double fCost = Double.MAX_VALUE; // g + h
    
    private PathNode parent;
    
    public PathNode(int row, int col, boolean walkable) {
        this.row = row;
        this.col = col;
        this.walkable = walkable;
    }
    
    // Getters
    public int getRow() {
        return row;
    }
    
    public int getCol() {
        return col;
    }
    
    public boolean isWalkable() {
        return walkable;
    }
    
    public double getGCost() {
        return gCost;
    }
    
    public double getHCost() {
        return hCost;
    }
    
    public double getFCost() {
        return fCost;
    }
    
    public PathNode getParent() {
        return parent;
    }
    
    // Setters
    public void setRow(int row) {
        this.row = row;
    }
    
    public void setCol(int col) {
        this.col = col;
    }
    
    public void setWalkable(boolean walkable) {
        this.walkable = walkable;
    }
    
    public void setGCost(double gCost) {
        this.gCost = gCost;
    }
    
    public void setHCost(double hCost) {
        this.hCost = hCost;
    }
    
    public void setFCost(double fCost) {
        this.fCost = fCost;
    }
    
    public void setParent(PathNode parent) {
        this.parent = parent;
    }
    
    public void calculateFCost() {
        this.fCost = this.gCost + this.hCost;
    }
    
    @Override
    public int compareTo(PathNode other) {
        return Double.compare(this.fCost, other.fCost);
    }
}
