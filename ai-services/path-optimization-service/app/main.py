import time
import networkx as nx
from flask import Flask, request, jsonify
import heapq

app = Flask(__name__)

# Global graph instance representing the warehouse layout
warehouse_graph = nx.DiGraph()

# Store coordinate metadata for each node
node_data = {}

def build_mock_warehouse(rows=5, cols=5):
    """
    Builds a grid warehouse layout where rows are aisles and columns are bins/cross-aisles.
    Allows testing the A* routing visually and geometrically.
    """
    global warehouse_graph, node_data
    warehouse_graph.clear()
    node_data.clear()

    # Create nodes with (x,y) coordinates
    # Assume 2.0 meters between nodes
    for r in range(rows):
        for c in range(cols):
            node_id = f"R{r}-C{c}"
            node_data[node_id] = {'x': c * 2.0, 'y': r * 2.0}
            warehouse_graph.add_node(node_id)
            
            # Connect to adjacent lateral nodes (columns)
            if c > 0:
                left_neighbor = f"R{r}-C{c-1}"
                warehouse_graph.add_edge(node_id, left_neighbor, weight=2.0)
                warehouse_graph.add_edge(left_neighbor, node_id, weight=2.0)
            
            # Connect to vertical nodes (rows)
            if r > 0:
                top_neighbor = f"R{r-1}-C{c}"
                warehouse_graph.add_edge(node_id, top_neighbor, weight=2.0)
                warehouse_graph.add_edge(top_neighbor, node_id, weight=2.0)

    return len(warehouse_graph.nodes), len(warehouse_graph.edges)

def manhattan_heuristic(node, goal):
    """ Manhattan distance heuristic h(n) = |x1 - x2| + |y1 - y2| """
    n1 = node_data.get(node)
    n2 = node_data.get(goal)
    if not n1 or not n2:
        return 0
    return abs(n1['x'] - n2['x']) + abs(n1['y'] - n2['y'])

def a_star_search(graph, start, goal, blocked_nodes):
    open_set = []
    # heapq format: (f_score, tie_breaker, node_id)
    heapq.heappush(open_set, (0, 0, start))
    came_from = {}
    
    g_score = {node: float('inf') for node in graph.nodes}
    g_score[start] = 0
    
    f_score = {node: float('inf') for node in graph.nodes}
    f_score[start] = manhattan_heuristic(start, goal)

    tie_breaker = 1

    while open_set:
        _, _, current = heapq.heappop(open_set)

        if current == goal:
            path = []
            while current in came_from:
                path.append(current)
                current = came_from[current]
            path.append(start)
            return path[::-1]

        for neighbor in graph.neighbors(current):
            if neighbor in blocked_nodes:
                continue

            edge_weight = graph[current][neighbor].get('weight', 1.0)
            tentative_g_score = g_score[current] + edge_weight
            
            if tentative_g_score < g_score[neighbor]:
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g_score
                f_score[neighbor] = g_score[neighbor] + manhattan_heuristic(neighbor, goal)
                heapq.heappush(open_set, (f_score[neighbor], tie_breaker, neighbor))
                tie_breaker += 1

    raise nx.NetworkXNoPath("No valid routing path connecting the nodes without passing blocked aisles.")

def generate_turn_by_turn(path):
    instructions = []
    if not path or len(path) < 2:
        return ["You are already at the destination location."]

    instructions.append(f"Start from {path[0]}")
    for i in range(len(path) - 1):
        curr_node = path[i]
        next_node = path[i+1]
        
        c_meta = node_data.get(curr_node, {'x':0, 'y':0})
        n_meta = node_data.get(next_node, {'x':0, 'y':0})
        
        # Calculate directions
        dx = n_meta['x'] - c_meta['x']
        dy = n_meta['y'] - c_meta['y']
        
        if dx > 0: direction = "East"
        elif dx < 0: direction = "West"
        elif dy > 0: direction = "South"
        elif dy < 0: direction = "North"
        else: direction = "straight"
        
        instructions.append(f"Move {direction} to {next_node}")
        
    instructions.append("You have arrived at your destination.")
    return instructions

@app.route('/graph/init', methods=['POST'])
def init_graph():
    """ 
    Initializes the path graph. If `rows` and `cols` in JSON body, 
    builds a grid layout of that size. Otherwise builds a 5x5 default.
    """
    data = request.json or {}
    rows = data.get("rows", 5)
    cols = data.get("cols", 5)
    
    nodes, edges = build_mock_warehouse(rows, cols)
    return jsonify({
        "message": f"Warehouse logic layout constructed ({rows}x{cols}).",
        "total_nodes": nodes,
        "total_edges": edges
    })

@app.route('/optimize-route', methods=['POST'])
def optimize_route():
    start_time = time.time()
    data = request.json or {}
    
    start_node = data.get("start_node")
    end_node = data.get("end_node")
    blocked_nodes = data.get("blocked_nodes", [])
    
    if start_node not in warehouse_graph or end_node not in warehouse_graph:
        return jsonify({"error": f"Start node '{start_node}' or end node '{end_node}' not found. Did you initialize the graph?"}), 400

    try:
        # 1. Path optimization logic using A* Search (Sec 6.3 AI microservices spec)
        path = a_star_search(warehouse_graph, start_node, end_node, blocked_nodes)
        
        # 2. Gather routing data metrics
        path_distance_meters = sum(warehouse_graph[path[i]][path[i+1]].get('weight', 1.0) for i in range(len(path) - 1))
        
        # 3. Simulate equipment constraints (assume cart travels 1.5 m/s)
        estimated_time_seconds = path_distance_meters / 1.5 
        
        # 4. Turn-by-Turn path breakdown
        instructions = generate_turn_by_turn(path)
        
        response_time_ms = (time.time() - start_time) * 1000

        return jsonify({
            "path": path,
            "path_distance_meters": path_distance_meters,
            "estimated_travel_time_seconds": round(estimated_time_seconds, 1),
            "turn_by_turn_instructions": instructions,
            "response_time_ms": round(response_time_ms, 2)
        })
    except nx.NetworkXNoPath as e:
        return jsonify({"error": str(e)}), 400

if __name__ == '__main__':
    # Guarantee at least a minimal default grid is available upon app boot
    build_mock_warehouse(5, 5)
    app.run(host='0.0.0.0', port=5000, debug=True)