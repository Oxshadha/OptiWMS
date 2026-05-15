import pytest
from main import app, graph

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_optimize_route_success(client):
    # Test a successful route optimization
    response = client.post('/optimize-route', json={
        "start_node": "A",
        "end_node": "D",
        "blocked_nodes": [],
        "worker_type": "picker"
    })
    data = response.get_json()

    assert response.status_code == 200
    assert data['path'] == ["A", "B", "C", "D"]
    assert data['path_length'] == 4
    assert "response_time" in data
    assert len(data['instructions']) == 3

def test_optimize_route_with_blocked_nodes(client):
    # Test route optimization with blocked nodes
    response = client.post('/optimize-route', json={
        "start_node": "A",
        "end_node": "D",
        "blocked_nodes": ["B"],
        "worker_type": "picker"
    })
    data = response.get_json()

    assert response.status_code == 400
    assert data['error'] == "No path found"

def test_optimize_route_invalid_worker_type(client):
    # Test route optimization with an invalid worker type
    response = client.post('/optimize-route', json={
        "start_node": "A",
        "end_node": "D",
        "blocked_nodes": [],
        "worker_type": "driver"
    })
    data = response.get_json()

    assert response.status_code == 400
    assert data['error'] == "No path found"

def test_optimize_route_no_path(client):
    # Test route optimization when no path exists
    response = client.post('/optimize-route', json={
        "start_node": "A",
        "end_node": "Z",
        "blocked_nodes": [],
        "worker_type": "picker"
    })
    data = response.get_json()

    assert response.status_code == 400
    assert data['error'] == "No path found"