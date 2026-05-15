package com.optiwms.coreapi.pathfinding;

import com.optiwms.coreapi.dto.PathfindingDTO;
import java.util.*;

/**
 * A* Pathfinding Algorithm (core-api wrapper)
 * Delegates to the domain-layer AStarPathfinder for actual computation.
 * This class is kept for backward compatibility with any code that
 * references com.optiwms.coreapi.pathfinding.PathfindingAlgorithm directly.
 */
public class PathfindingAlgorithm {
    private int gridRows;
    private int gridCols;
    private Set<String> blockedLocations;

    public PathfindingAlgorithm(int gridRows, int gridCols, List<PathfindingDTO.BlockedLocation> blocked) {
        this.gridRows = gridRows;
        this.gridCols = gridCols;
        this.blockedLocations = new HashSet<>();
        if (blocked != null) {
            for (PathfindingDTO.BlockedLocation loc : blocked) {
                this.blockedLocations.add(loc.getRow() + "," + loc.getCol());
            }
        }
    }

    public List<PathfindingDTO.PathNode> findPath(int startRow, int startCol, int endRow, int endCol) {
        if (!isWalkable(startRow, startCol) || !isWalkable(endRow, endCol)) {
            return null;
        }

        PriorityQueue<Node> openSet = new PriorityQueue<>(Comparator.comparingDouble(n -> n.fCost));
        Set<String> closedSet = new HashSet<>();

        Node startNode = new Node(startRow, startCol, 0,
                heuristic(startRow, startCol, endRow, endCol));
        openSet.add(startNode);

        while (!openSet.isEmpty()) {
            Node current = openSet.poll();

            if (current.row == endRow && current.col == endCol) {
                return reconstructPath(current);
            }

            closedSet.add(current.row + "," + current.col);

            // Check all 4 directions and diagonals (8 directions)
            int[][] directions = {
                {0, 1}, {0, -1}, {1, 0}, {-1, 0},  // 4-directional
                {1, 1}, {1, -1}, {-1, 1}, {-1, -1}  // diagonals
            };

            for (int[] dir : directions) {
                int newRow = current.row + dir[0];
                int newCol = current.col + dir[1];

                if (!isValid(newRow, newCol) || !isWalkable(newRow, newCol)) {
                    continue;
                }

                String key = newRow + "," + newCol;
                if (closedSet.contains(key)) {
                    continue;
                }

                // Cost is higher for diagonal movement
                double movementCost = (dir[0] != 0 && dir[1] != 0) ? 1.414 : 1.0;
                double gCost = current.gCost + movementCost;
                double hCost = heuristic(newRow, newCol, endRow, endCol);

                Node neighbor = new Node(newRow, newCol, gCost, hCost);
                neighbor.parent = current;
                openSet.add(neighbor);
            }
        }

        return null; // No path found
    }

    private List<PathfindingDTO.PathNode> reconstructPath(Node endNode) {
        List<PathfindingDTO.PathNode> path = new ArrayList<>();
        Node current = endNode;

        while (current != null) {
            path.add(0, new PathfindingDTO.PathNode(
                    current.row, current.col, current.gCost, current.hCost, current.fCost));
            current = current.parent;
        }

        return path;
    }

    private double heuristic(int fromRow, int fromCol, int toRow, int toCol) {
        // Manhattan distance
        return Math.abs(fromRow - toRow) + Math.abs(fromCol - toCol);
    }

    private boolean isValid(int row, int col) {
        return row >= 0 && row < gridRows && col >= 0 && col < gridCols;
    }

    private boolean isWalkable(int row, int col) {
        return !blockedLocations.contains(row + "," + col);
    }

    private static class Node {
        int row;
        int col;
        double gCost;
        double hCost;
        double fCost;
        Node parent;

        Node(int row, int col, double gCost, double hCost) {
            this.row = row;
            this.col = col;
            this.gCost = gCost;
            this.hCost = hCost;
            this.fCost = gCost + hCost;
            this.parent = null;
        }
    }
}
