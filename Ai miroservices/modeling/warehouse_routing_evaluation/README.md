# Warehouse routing evaluator

This evaluator uses the same v8 controlled physical population and floor-level
aisle abstraction as the operational Spring routing service. It compares
Dijkstra, static A*, and prioritized time-reservation A* under deterministic
single-worker and 1/5/10/25/50-worker scenarios.

Run:

```bash
.venv/bin/python "Ai miroservices/modeling/warehouse_routing_evaluation/routing_benchmark.py"
.venv/bin/python -m pytest "Ai miroservices/modeling/warehouse_routing_evaluation/tests" -q
```

The generated CSV/JSON evidence and the executed notebook are method-validation
artifacts. They do not claim real-site safety certification. Physical aisle
width, vehicle envelope, traffic rules, positioning accuracy, and shadow-mode
acceptance must be measured before live forklift enforcement.
