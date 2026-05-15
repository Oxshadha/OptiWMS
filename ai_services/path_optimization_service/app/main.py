import time
import networkx as nx
import pandas as pd
from flask import Flask, request, jsonify
import heapq

app = Flask(__name__)

# Initialize the graph for routing
graph = nx.DiGraph()

# Add nodes and edges with valid constraints
graph.add_edge("A", "B", weight=1, constraints={"worker": "picker"})
graph.add_edge("B", "C", weight=2, constraints={"worker": "picker"})
graph.add_edge("C", "D", weight=1, constraints={"worker": "picker"})

def heuristic(node, goal):
    # Manhattan distance heuristic
    return abs(ord(node) - ord(goal))

def a_star_search(graph, start, goal, blocked_nodes, worker_type):
    open_set = []
    heapq.heappush(open_set, (0, start))
    came_from = {}
    g_score = {node: float('inf') for node in graph.nodes}
    g_score[start] = 0
    f_score = {node: float('inf') for node in graph.nodes}
    f_score[start] = heuristic(start, goal)

    while open_set:
        _, current = heapq.heappop(open_set)

        if current == goal:
            # Reconstruct path
            path = []
            while current in came_from:
                path.append(current)
                current = came_from[current]
            path.append(start)
            return path[::-1]

        for neighbor in graph.neighbors(current):
            if neighbor in blocked_nodes:
                continue

            # Check worker/equipment constraints
            edge_data = graph[current][neighbor]
            if "constraints" in edge_data and edge_data["constraints"].get("worker") != worker_type:
                continue

            tentative_g_score = g_score[current] + graph[current][neighbor]['weight']
            if tentative_g_score < g_score[neighbor]:
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g_score
                f_score[neighbor] = g_score[neighbor] + heuristic(neighbor, goal)
                heapq.heappush(open_set, (f_score[neighbor], neighbor))

    raise nx.NetworkXNoPath("No path found")

@app.route('/optimize-route', methods=['POST'])
def optimize_route():
    start_time = time.time()
    data = request.json
    start_node = data.get("start_node")
    end_node = data.get("end_node")
    blocked_nodes = data.get("blocked_nodes", [])
    worker_type = data.get("worker_type", "picker")

    try:
        path = a_star_search(graph, start_node, end_node, blocked_nodes, worker_type)
        path_length = sum(graph[path[i]][path[i+1]]['weight'] for i in range(len(path) - 1))
        response_time = time.time() - start_time

        return jsonify({
            "path": path,
            "path_length": path_length,
            "response_time": response_time,
            "instructions": [f"Move from {path[i]} to {path[i+1]}" for i in range(len(path) - 1)]
        })
    except nx.NetworkXNoPath:
        return jsonify({"error": "No path found"}), 400

@app.route('/')
def home():
    return jsonify({"message": "Welcome to the Path Optimization Service!"})

if __name__ == '__main__':
    app.run(debug=True)