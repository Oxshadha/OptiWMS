import pytest
from app.main import app

@pytest.fixture
def client():
    with app.test_client() as client:
        yield client

def test_compute_path(client):
    response = client.post("/compute-path", json={
        "start": "A",
        "goal": "D",
        "constraints": {}
    })
    
    assert response.status_code == 200
    data = response.get_json()
    assert "path" in data
    assert "cost" in data
    assert "instructions" in data