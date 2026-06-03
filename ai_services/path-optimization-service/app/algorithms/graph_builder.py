"""
Warehouse Graph Builder
Constructs graph representations of warehouse layouts from configuration
"""
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from .astar import AStarPathfinder


@dataclass
class WarehouseConfig:
    """Configuration for warehouse layout"""
    aisles: List[Dict]  # List of aisle definitions
    nodes: List[Dict]  # List of node definitions
    edges: List[Dict]  # List of edge definitions
    worker_type: str = "picker"  # picker or forklift
    

class WarehouseGraphBuilder:
    """Build warehouse graphs from configuration"""
    
    def __init__(self):
        self.pathfinder = AStarPathfinder()
        self.node_map: Dict[str, Tuple[int, int]] = {}
    
    def build_from_config(self, config: Dict) -> AStarPathfinder:
        """
        Build warehouse graph from configuration dictionary
        
        Args:
            config: Dictionary with 'nodes' and 'edges' lists
        
        Returns:
            Configured AStarPathfinder instance
        """
        self.pathfinder = AStarPathfinder()
        
        # Add all nodes
        for node in config.get('nodes', []):
            self.add_node(node)
        
        # Add all edges
        for edge in config.get('edges', []):
            self.add_edge(edge)
        
        return self.pathfinder
    
    def add_node(self, node_config: Dict):
        """Add a node from configuration"""
        node_id = node_config['id']
        row = node_config.get('row', 0)
        col = node_config.get('col', 0)
        node_type = node_config.get('type', 'aisle')
        walkable = node_config.get('walkable', True)
        
        self.pathfinder.add_node(node_id, row, col, node_type, walkable)
        self.node_map[node_id] = (row, col)
    
    def add_edge(self, edge_config: Dict):
        """Add an edge from configuration"""
        from_id = edge_config['from']
        to_id = edge_config['to']
        cost = edge_config.get('cost', 1.0)
        bidirectional = edge_config.get('bidirectional', True)
        
        self.pathfinder.add_edge(from_id, to_id, cost, bidirectional)
    
    def build_grid_warehouse(self, rows: int, cols: int,
                           blocked: Optional[List[Tuple[int, int]]] = None) -> AStarPathfinder:
        """
        Build a simple grid-based warehouse
        
        Args:
            rows: Number of rows
            cols: Number of columns
            blocked: List of (row, col) positions that are blocked
        
        Returns:
            Configured AStarPathfinder instance
        """
        self.pathfinder = AStarPathfinder()
        self.pathfinder.create_grid(rows, cols)
        
        # Block specific positions
        if blocked:
            for row, col in blocked:
                node_id = f"_{row}_{col}"
                self.pathfinder.block_node(node_id)
        
        return self.pathfinder
    
    def build_realistic_warehouse(self, num_aisles: int = 5,
                                 racks_per_aisle: int = 4,
                                 bays_per_rack: int = 3) -> AStarPathfinder:
        """
        Build a realistic warehouse with structured layout
        
        Args:
            num_aisles: Number of parallel aisles
            racks_per_aisle: Racks per aisle
            bays_per_rack: Bays per rack
        
        Returns:
            Configured AStarPathfinder instance
        """
        self.pathfinder = AStarPathfinder()
        self.node_map.clear()
        
        # Entry and exit points
        entry_id = "ENTRY"
        exit_id = "EXIT"
        
        self.pathfinder.add_node(entry_id, 0, 0, "entry")
        self.pathfinder.add_node(exit_id, num_aisles + 1, 0, "exit")
        
        # Main aisle (spine) - center of warehouse
        self.pathfinder.add_node("SPINE_START", 0, 1, "aisle")
        self.pathfinder.add_node("SPINE_END", num_aisles + 1, 1, "aisle")
        
        self.pathfinder.add_edge("ENTRY", "SPINE_START", 1.0)
        self.pathfinder.add_edge("SPINE_START", "SPINE_END", num_aisles + 1)
        self.pathfinder.add_edge("SPINE_END", "EXIT", 1.0)
        
        # Add aisles
        aisle_nodes = []
        for aisle_idx in range(num_aisles):
            aisle_id = f"AISLE_{aisle_idx}"
            row = aisle_idx + 1
            
            # Connection from spine to aisle
            aisle_entry = f"{aisle_id}_ENTRY"
            aisle_exit = f"{aisle_id}_EXIT"
            
            self.pathfinder.add_node(aisle_entry, row, 1, "aisle")
            self.pathfinder.add_node(aisle_exit, row, 1, "aisle")
            
            self.pathfinder.add_edge("SPINE_START", aisle_entry, 1.0)
            self.pathfinder.add_edge(aisle_entry, aisle_exit, racks_per_aisle + 1)
            self.pathfinder.add_edge(aisle_exit, "SPINE_END", 1.0)
            
            # Add racks within aisle
            for rack_idx in range(racks_per_aisle):
                rack_id = f"AISLE_{aisle_idx}_RACK_{rack_idx}"
                col = rack_idx + 2
                
                self.pathfinder.add_node(rack_id, row, col, "rack")
                
                # Connect to aisle
                self.pathfinder.add_edge(aisle_entry, rack_id, 1.0)
                self.pathfinder.add_edge(rack_id, aisle_exit, 1.0)
                
                # Add bins within rack
                for bay_idx in range(bays_per_rack):
                    bin_id = f"AISLE_{aisle_idx}_RACK_{rack_idx}_BAY_{bay_idx}"
                    self.pathfinder.add_node(bin_id, row, col, "bin")
                    self.pathfinder.add_edge(rack_id, bin_id, 0.5, bidirectional=True)
            
            aisle_nodes.append(aisle_id)
        
        return self.pathfinder


def _build_full_warehouse():
    """
    Build the full 7-zone (A-G) × 10-bay warehouse layout.
    Layout:
        ENTRY
        [A1][A2][A3][A4][A5][A6][A7][A8][A9][A10]   Row A
        [B1][B2][B3][B4][B5][B6][B7][B8][B9][B10]   Row B
        [C1][C2][C3][C4][C5][C6][C7][C8][C9][C10]   Row C
        [D1][D2][D3][D4][D5][D6][D7][D8][D9][D10]   Row D
        [E1][E2][E3][E4][E5][E6][E7][E8][E9][E10]   Row E
        [F1][F2][F3][F4][F5][F6][F7][F8][F9][F10]   Row F
        [G1][G2][G3][G4][G5][G6][G7][G8][G9][G10]   Row G
        EXIT (connected from G1, G3-G10; G2 not connected to EXIT)
    """
    ZONES = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
    BAYS  = list(range(1, 11))   # 1-10
    BAY_COST   = 1.5   # cost to move one bay along a row
    AISLE_COST = 3.0   # cost to cross the aisle between rows

    nodes = [
        {"id": "ENTRY", "row": 0,  "col": 0,  "type": "entry", "walkable": True},
        {"id": "EXIT",  "row": 16, "col": 10, "type": "exit",  "walkable": True},
    ]
    edges = []

    # Row positions (row 0 = ENTRY, rows 1..14 = racks (even=rack, odd=aisle), row 15 = EXIT)
    zone_row = {z: (i * 2) + 1 for i, z in enumerate(ZONES)}  # A=1, B=3, C=5...G=13

    # Add rack nodes
    for z in ZONES:
        for b in BAYS:
            nodes.append({
                "id": f"{z}{b}",
                "row": zone_row[z],
                "col": b,
                "type": "rack",
                "walkable": True
            })

    # Within-row bay-to-bay connections
    for z in ZONES:
        for b in range(1, 10):  # 1→2, 2→3 ... 9→10
            edges.append({"from": f"{z}{b}", "to": f"{z}{b+1}", "cost": BAY_COST, "bidirectional": True})

    # Cross-aisle connections (left end bay=1, right end bay=10)
    for i in range(len(ZONES) - 1):
        za, zb = ZONES[i], ZONES[i + 1]
        edges.append({"from": f"{za}1",  "to": f"{zb}1",  "cost": AISLE_COST, "bidirectional": True})
        edges.append({"from": f"{za}10", "to": f"{zb}10", "cost": AISLE_COST, "bidirectional": True})

    # ENTRY → Row A (enter from either end)
    edges.append({"from": "ENTRY", "to": "A1",  "cost": 2.0, "bidirectional": False})
    edges.append({"from": "ENTRY", "to": "A10", "cost": 2.5, "bidirectional": False})

    # EXIT connections: G1 and G3-G10 (G2 is NOT connected to EXIT per spec)
    for b in [1] + list(range(3, 11)):
        edges.append({"from": f"G{b}", "to": "EXIT", "cost": 2.0, "bidirectional": False})

    return {"name": "OptiWMS Warehouse (A-G, 10 bays)", "nodes": nodes, "edges": edges}


# Sample warehouse configurations
SAMPLE_SMALL_WAREHOUSE = _build_full_warehouse()

# Legacy alias kept for compatibility
_LEGACY_SMALL_WAREHOUSE = {
    "name": "Small Warehouse",
    "rows": 10,
    "cols": 10,
    "nodes": [
        {"id": "ENTRY", "row": 0, "col": 0, "type": "entry"},
        {"id": "EXIT", "row": 0, "col": 9, "type": "exit"},
        {"id": "A1", "row": 2, "col": 2, "type": "rack"},
        {"id": "A2", "row": 2, "col": 4, "type": "rack"},
        {"id": "A3", "row": 2, "col": 6, "type": "rack"},
        {"id": "B1", "row": 5, "col": 2, "type": "rack"},
        {"id": "B2", "row": 5, "col": 4, "type": "rack"},
        {"id": "B3", "row": 5, "col": 6, "type": "rack"},
        {"id": "C1", "row": 8, "col": 2, "type": "rack"},
        {"id": "C2", "row": 8, "col": 4, "type": "rack"},
        {"id": "C3", "row": 8, "col": 6, "type": "rack"},
    ],
    "edges": [
        {"from": "ENTRY", "to": "A1", "cost": 2.0},
        {"from": "ENTRY", "to": "A2", "cost": 2.5},
        {"from": "ENTRY", "to": "A3", "cost": 3.0},
        {"from": "A1", "to": "B1", "cost": 3.0},
        {"from": "A2", "to": "B2", "cost": 3.0},
        {"from": "A3", "to": "B3", "cost": 3.0},
        {"from": "B1", "to": "C1", "cost": 3.0},
        {"from": "B2", "to": "C2", "cost": 3.0},
        {"from": "B3", "to": "C3", "cost": 3.0},
        {"from": "C3", "to": "EXIT", "cost": 2.0},
        # Inter-aisle connections
        {"from": "A1", "to": "A2", "cost": 2.0},
        {"from": "A2", "to": "A3", "cost": 2.0},
        {"from": "B1", "to": "B2", "cost": 2.0},
        {"from": "B2", "to": "B3", "cost": 2.0},
        {"from": "C1", "to": "C2", "cost": 2.0},
        {"from": "C2", "to": "C3", "cost": 2.0},
    ]
}

SAMPLE_LARGE_WAREHOUSE = {
    "name": "Large Warehouse",
    "rows": 20,
    "cols": 20,
    "nodes": [
        {"id": "ENTRY", "row": 0, "col": 0, "type": "entry"},
        {"id": "EXIT", "row": 0, "col": 19, "type": "exit"},
        # Generate racks programmatically
    ],
    "edges": []
}
