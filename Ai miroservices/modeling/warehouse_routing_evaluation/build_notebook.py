from pathlib import Path

import nbformat as nbf


HERE = Path(__file__).resolve().parent
NOTEBOOK = HERE / "01_Warehouse_Routing_Algorithm_Evaluation.ipynb"


def code(source: str):
    return nbf.v4.new_code_cell(source.strip())


def markdown(source: str):
    return nbf.v4.new_markdown_cell(source.strip())


notebook = nbf.v4.new_notebook()
notebook["metadata"]["kernelspec"] = {
    "display_name": "OptiWMS evaluator",
    "language": "python",
    "name": "python3",
}
notebook["metadata"]["language_info"] = {"name": "python", "version": "3"}
notebook["cells"] = [
    markdown(
        """
# Warehouse Routing Algorithm Evaluation

This notebook is the visible evaluator evidence for the OptiWMS worker-routing
control plane. It uses the controlled v8 physical population, compares
Dijkstra and A*, and stress-tests independent versus time-reservation A* for
1, 5, 10, 25 and 50 concurrent forklifts.

**Decision boundary:** this validates the implemented method on synthetic
geometry. It does not certify real-site safety. A physical survey, positioning
telemetry, vehicle envelopes, right-of-way rules and shadow-mode acceptance
remain mandatory.
"""
    ),
    code(
        """
from pathlib import Path
import json
import matplotlib.pyplot as plt
import pandas as pd
from IPython.display import display

HERE = Path.cwd()
if HERE.name != "warehouse_routing_evaluation":
    HERE = Path("Ai miroservices/modeling/warehouse_routing_evaluation").resolve()
OUT = HERE / "outputs"
leaderboard = pd.read_csv(OUT / "algorithm_leaderboard.csv")
cases = pd.read_csv(OUT / "static_route_cases.csv")
concurrency = pd.read_csv(OUT / "concurrency_results.csv")
tests = pd.read_csv(OUT / "statistical_tests.csv")
assumptions = pd.read_csv(OUT / "assumption_registry.csv")
claims = pd.read_csv(OUT / "claim_evidence_matrix.csv")
decision = json.loads((OUT / "routing_algorithm_decision.json").read_text())
decision
"""
    ),
    markdown("## 1. Versioned graph and population contract"),
    code(
        """
graph_summary = pd.DataFrame([decision["graph"]])
graph_summary["layout_source"] = "v8 controlled physical population"
graph_summary["external_population_validity"] = decision["acceptance"]["external_population_validity"]
display(graph_summary)
"""
    ),
    markdown(
        """
The 4,200 storage-bin records are not drawn as 4,200 floor obstacles. They
collapse to 280 rack-bay footprints with two valid rack-face approaches. The
route graph contains aisle and cross-aisle centerlines, station links and
parking nodes, so generated polylines cannot cross a rack footprint.
"""
    ),
    markdown("## 2. Static shortest-path comparison"),
    code("display(leaderboard.round(4))"),
    code(
        """
fig, axes = plt.subplots(1, 2, figsize=(12, 4))
cases.boxplot(column="runtime_ms", by="algorithm", ax=axes[0], grid=False)
axes[0].set_title("Runtime across paired routes")
axes[0].set_ylabel("milliseconds")
cases.boxplot(column="expanded_nodes", by="algorithm", ax=axes[1], grid=False)
axes[1].set_title("Search expansions")
axes[1].set_ylabel("nodes")
plt.suptitle("")
plt.tight_layout()
plt.show()
"""
    ),
    code("display(tests)"),
    markdown(
        """
A* is selected for single-agent route geometry because its Manhattan heuristic
is admissible on this orthogonal, nonnegative graph. Dijkstra remains the
optimality reference. Distance equivalence is required; runtime alone is not
enough.
"""
    ),
    markdown("## 3. Multi-worker temporal conflict evidence"),
    code(
        """
concurrency_summary = (
    concurrency.groupby(["workers", "algorithm"])
    .agg(
        max_temporal_conflicts=("temporal_conflicts", "max"),
        mean_total_wait_seconds=("total_wait_seconds", "mean"),
        mean_p95_runtime_ms=("p95_runtime_ms", "mean"),
        mean_makespan_seconds=("makespan_seconds", "mean"),
    )
    .reset_index()
)
display(concurrency_summary.round(3))
"""
    ),
    code(
        """
fig, axes = plt.subplots(1, 3, figsize=(15, 4))
for algorithm, frame in concurrency_summary.groupby("algorithm"):
    axes[0].plot(frame.workers, frame.max_temporal_conflicts, marker="o", label=algorithm)
    axes[1].plot(frame.workers, frame.mean_total_wait_seconds, marker="o", label=algorithm)
    axes[2].plot(frame.workers, frame.mean_p95_runtime_ms, marker="o", label=algorithm)
axes[0].set_title("Worst temporal conflicts")
axes[1].set_title("Planned wait")
axes[2].set_title("P95 planning runtime")
for axis in axes:
    axis.set_xlabel("simultaneous workers")
    axis.grid(alpha=.25)
axes[0].set_ylabel("conflict pairs")
axes[1].set_ylabel("seconds")
axes[2].set_ylabel("milliseconds")
axes[0].legend()
plt.tight_layout()
plt.show()
"""
    ),
    markdown(
        """
Independent A* is rejected for multi-forklift control: geometrically shortest
routes overlap in time. The production design therefore uses server-side
prioritized reservation A*, canonical undirected edge resources (which also
block opposite-direction swaps), destination-node windows, safety headway,
leases and replanning after completed stops.
"""
    ),
    markdown("## 4. Assumption registry"),
    code("display(assumptions)"),
    markdown("## 5. Claim–evidence matrix"),
    code("display(claims)"),
    markdown("## 6. Locked conclusion"),
    code(
        """
assert decision["acceptance"]["all_static_distances_match"]
assert decision["acceptance"]["zero_reserved_conflicts"]
assert decision["acceptance"]["tested_max_workers"] == 50
assert decision["acceptance"]["external_population_validity"] == "UNVERIFIED"
pd.DataFrame([
    {"use": "Single worker geometry", "selected": "A*"},
    {"use": "Concurrent operational control", "selected": "time-reservation A*"},
    {"use": "Real-site safety certification", "selected": "NOT ESTABLISHED"},
])
"""
    ),
]

nbf.write(notebook, NOTEBOOK)
print(NOTEBOOK)
