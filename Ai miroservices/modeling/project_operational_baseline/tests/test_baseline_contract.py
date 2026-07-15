import ast
import json
import unittest
from pathlib import Path

import pandas as pd

from pipeline.forecasting import FEATURES


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs"


class OperationalBaselineContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads((OUT / "manifest.json").read_text())

    def test_canonical_scale_and_integrity_checks(self):
        counts = self.manifest["row_counts"]
        self.assertEqual(counts["finished_goods"], 120)
        self.assertEqual(counts["materials"], 746)
        self.assertEqual(counts["locations"], 3000)
        self.assertGreaterEqual(counts["orders"], 25000)
        self.assertGreaterEqual(counts["order_items"], 100000)
        self.assertGreaterEqual(counts["stock_movements"] + counts["tasks"], 250000)
        self.assertTrue(all(self.manifest["validations"].values()))

    def test_hidden_generator_variables_are_not_model_features(self):
        forbidden = {"latent_demand", "random_shock", "generator_noise", "future_actual", "demand_units"}
        self.assertFalse(forbidden.intersection(FEATURES))

    def test_bom_closure_and_classification_coverage(self):
        bom = pd.read_csv(OUT / "bom_components.csv.gz")
        fg = pd.read_csv(OUT / "finished_goods.csv.gz")
        classes = pd.read_csv(OUT / "material_classifications.csv.gz")
        self.assertEqual(bom.parent_material_id.nunique(), len(fg))
        self.assertEqual(len(classes), self.manifest["row_counts"]["materials"])
        self.assertTrue(set(classes.abc_class).issubset({"A", "B", "C"}))
        self.assertTrue(set(classes.fms_class).issubset({"F", "M", "S", "N"}))

    def test_policy_is_service_and_capacity_feasible(self):
        policy = pd.read_csv(OUT / "inventory_policy.csv.gz")
        self.assertTrue(policy.capacity_feasible.all())
        self.assertTrue((policy.simulated_fill_rate >= policy.target_service_level).all())
        self.assertTrue((policy.proposed_expected_total_cost <= policy.current_expected_total_cost).all())

    def test_notebook_code_cells_parse(self):
        for path in sorted(ROOT.glob("*.ipynb")):
            notebook = json.loads(path.read_text())
            for index, cell in enumerate(notebook.get("cells", [])):
                if cell.get("cell_type") == "code":
                    with self.subTest(notebook=path.name, cell=index):
                        ast.parse("".join(cell.get("source", [])))

    def test_forecast_evidence_uses_locked_calibration(self):
        summary_path = OUT / "forecast_evidence_summary.json"
        if not summary_path.exists():
            self.skipTest("Canonical forecast evaluation is still running")
        summary = json.loads(summary_path.read_text())
        self.assertLess(summary["selection_window"][1], summary["untouched_test_window"][0])
        self.assertIn("selection window only", summary["interval_calibration_method"])
        self.assertTrue(all(summary["promotion_gate"].values()))


if __name__ == "__main__":
    unittest.main()
