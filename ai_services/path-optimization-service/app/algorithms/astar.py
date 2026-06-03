"""
A* Pathfinding Algorithm Implementation
Supports both grid-based and graph-based warehouse navigation
"""
import heapq
from typing import List, Tuple, Optional, Dict, Set
from dataclasses import dataclass, field
import math

@dataclass
class Node:
    """Represents a node in the warehouse graph/grid"""
    id: str  # Unique identifier (e.g., 'A1', 'B2')
    row: int
    col: int
    type: str = "aisle"  # aisle, rack, bin, entry, exit
    g_cost: float = float('inf')  # Cost from start
    h_cost: float = 0.0  # Heuristic cost to goal
    f_cost: float = float('inf')  # g_cost + h_cost
    parent: Optional['Node'] = None
    walkable: bool = True
    
    def __eq__(self, other):
        if not isinstance(other, Node):
            return False
        return self.id == other.id
    
    def __hash__(self):
        return hash(self.id)
    
    def __lt__(self, other):
        """For priority queue comparison"""
        return self.f_cost < other.f_cost
    
    def calculate_f_cost(self):
        """Update f cost"""
        self.f_cost = self.g_cost + self.h_cost

@dataclass
class Edge:
    """Represents a connection between two nodes"""
    from_node: str
    to_node: str
    cost: float = 1.0  # Distance or time cost
    is_bidirectional: bool = True
    available: bool = True  # Can be blocked dynamically

class AStarPathfinder:
    """
    A* Pathfinding Algorithm - Graph-based implementation
    Supports both grid-based and custom graph navigation
    """
    
    def __init__(self):
        """Initialize graph-based pathfinder"""
        self.nodes: Dict[str, Node] = {}
        self.edges: Dict[str, List[Edge]] = {}
        self.blocked_nodes: Set[str] = set()
        self.blocked_edges: Set[Tuple[str, str]] = set()
    
    # Grid-based pathfinding support
    DIRECTIONS = [
        (0, 1), (1, 0), (0, -1), (-1, 0),  # Cardinal
        (1, 1), (1, -1), (-1, 1), (-1, -1)  # Diagonal
    ]
    CARDINAL_COST = 1.0
    DIAGONAL_COST = math.sqrt(2)
    
    # ============ Graph Management ============
    
    def add_node(self, node_id: str, row: int, col: int, 
                 node_type: str = "aisle", walkable: bool = True):
        """Add a node to the graph"""
        self.nodes[node_id] = Node(
            id=node_id,
            row=row,
            col=col,
            type=node_type,
            walkable=walkable
        )
        if node_id not in self.edges:
            self.edges[node_id] = []
    
    def add_edge(self, from_id: str, to_id: str, cost: float = 1.0,
                 bidirectional: bool = True):
        """Add a connection between two nodes"""
        if from_id not in self.edges:
            self.edges[from_id] = []
        
        self.edges[from_id].append(Edge(from_id, to_id, cost, bidirectional))
        
        if bidirectional and to_id not in self.edges:
            self.edges[to_id] = []
        if bidirectional:
            self.edges[to_id].append(Edge(to_id, from_id, cost, bidirectional))
    
    def block_node(self, node_id: str):
        """Dynamically block a node"""
        if node_id in self.nodes:
            self.nodes[node_id].walkable = False
            self.blocked_nodes.add(node_id)
    
    def unblock_node(self, node_id: str):
        """Unblock a previously blocked node"""
        if node_id in self.nodes:
            self.nodes[node_id].walkable = True
            self.blocked_nodes.discard(node_id)
    
    def block_edge(self, from_id: str, to_id: str):
        """Block a specific edge"""
        self.blocked_edges.add((from_id, to_id))
        self.blocked_edges.add((to_id, from_id))
    
    def unblock_edge(self, from_id: str, to_id: str):
        """Unblock a previously blocked edge"""
        self.blocked_edges.discard((from_id, to_id))
        self.blocked_edges.discard((to_id, from_id))
    
    # ============ Pathfinding ============
    
    def _euclidean_distance(self, node1: Node, node2: Node) -> float:
        """Calculate Euclidean distance (better for graphs)"""
        return math.sqrt((node1.row - node2.row)**2 + (node1.col - node2.col)**2)
    
    def _get_neighbors(self, node_id: str) -> List[Tuple[str, float]]:
        """Get available neighbors with costs"""
        neighbors = []
        if node_id not in self.edges:
            return neighbors
        
        for edge in self.edges[node_id]:
            # Check if edge is blocked or destination is blocked
            if (edge.from_node, edge.to_node) in self.blocked_edges:
                continue
            if edge.to_node in self.blocked_nodes:
                continue
            if not self.nodes[edge.to_node].walkable:
                continue
            if not edge.available:
                continue
            
            neighbors.append((edge.to_node, edge.cost))
        
        return neighbors
    
    def find_path(self, start_id: str, end_id: str) -> Tuple[List[str], float]:
        """
        Find optimal path from start to end using A*
        
        Args:
            start_id: Starting node ID
            end_id: Destination node ID
        
        Returns:
            Tuple of (path list, total cost)
        """
        # Validate nodes
        if start_id not in self.nodes or end_id not in self.nodes:
            return [], 0.0
        
        if not self.nodes[start_id].walkable or not self.nodes[end_id].walkable:
            return [], 0.0
        
        # Reset costs
        for node in self.nodes.values():
            node.g_cost = float('inf')
            node.h_cost = 0.0
            node.f_cost = float('inf')
            node.parent = None
        
        # Initialize
        start = self.nodes[start_id]
        goal = self.nodes[end_id]
        
        open_set = [start]
        closed_set: Set[str] = set()
        open_set_ids: Set[str] = {start_id}
        
        start.g_cost = 0.0
        start.h_cost = self._euclidean_distance(start, goal)
        start.calculate_f_cost()
        
        # Main A* loop
        while open_set:
            current = heapq.heappop(open_set)
            open_set_ids.discard(current.id)
            
            if current.id == end_id:
                return self._reconstruct_path(goal), goal.g_cost
            
            closed_set.add(current.id)
            
            # Explore neighbors
            for neighbor_id, edge_cost in self._get_neighbors(current.id):
                if neighbor_id in closed_set:
                    continue
                
                neighbor = self.nodes[neighbor_id]
                new_g_cost = current.g_cost + edge_cost
                
                if new_g_cost < neighbor.g_cost:
                    neighbor.parent = current
                    neighbor.g_cost = new_g_cost
                    neighbor.h_cost = self._euclidean_distance(neighbor, goal)
                    neighbor.calculate_f_cost()
                    
                    if neighbor_id not in open_set_ids:
                        heapq.heappush(open_set, neighbor)
                        open_set_ids.add(neighbor_id)
        
        return [], 0.0
    
    def _reconstruct_path(self, node: Node) -> List[str]:
        """Reconstruct path from goal node to start"""
        path = []
        current = node
        
        while current is not None:
            path.append(current.id)
            current = current.parent
        
        path.reverse()
        return path
    
    # ============ Grid-based helper (for backward compatibility) ============
    
    def create_grid(self, rows: int, cols: int, 
                   node_id_prefix: str = ""):
        """Create a grid graph (for simple warehouse layouts)"""
        self.nodes.clear()
        self.edges.clear()
        
        # Add all grid nodes
        for r in range(rows):
            for c in range(cols):
                node_id = f"{node_id_prefix}_{r}_{c}"
                self.add_node(node_id, r, c)
        
        # Connect adjacent nodes
        for r in range(rows):
            for c in range(cols):
                node_id = f"{node_id_prefix}_{r}_{c}"
                
                for dr, dc in self.DIRECTIONS:
                    nr, nc = r + dr, c + dc
                    if 0 <= nr < rows and 0 <= nc < cols:
                        neighbor_id = f"{node_id_prefix}_{nr}_{nc}"
                        cost = self.CARDINAL_COST if (dr == 0 or dc == 0) else self.DIAGONAL_COST
                        self.add_edge(node_id, neighbor_id, cost)
