import unittest
import json
from app.main import app

class TestPathOptimizationService(unittest.TestCase):

    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    def test_optimize_route_success(self):
        payload = {
            "start_node": "A",
            "end_node": "D",
            "blocked_nodes": []
        }

        response = self.app.post('/optimize-route', 
                                  data=json.dumps(payload),
                                  content_type='application/json')

        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn("path", data)
        self.assertIn("path_length", data)
        self.assertIn("response_time", data)

    def test_optimize_route_with_blocked_nodes(self):
        payload = {
            "start_node": "A",
            "end_node": "D",
            "blocked_nodes": ["B"]
        }

        response = self.app.post('/optimize-route', 
                                  data=json.dumps(payload),
                                  content_type='application/json')

        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertIn("error", data)

    def test_optimize_route_no_path(self):
        payload = {
            "start_node": "A",
            "end_node": "D",
            "blocked_nodes": ["C"]
        }

        response = self.app.post('/optimize-route', 
                                  data=json.dumps(payload),
                                  content_type='application/json')

        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertIn("error", data)

if __name__ == '__main__':
    unittest.main()