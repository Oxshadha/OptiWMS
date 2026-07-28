import ast
import json
import unittest
from pathlib import Path

import pandas as pd

from pipeline.forecasting import FEATURES
from pipeline.catalogs import PM_CATALOG


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs"


class OperationalBaselineContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads((OUT / "manifest.json").read_text())

    def test_canonical_scale_and_integrity_checks(self):
        counts = self.manifest["row_counts"]
        self.assertEqual(counts["finished_goods"], 16)
        self.assertEqual(counts["materials"], 80)
        self.assertEqual(counts["locations"], 606)
        self.assertEqual(counts["warehouse_graph_nodes"], 52)
        self.assertEqual(counts["warehouse_graph_edges"], 55)
        self.assertGreaterEqual(counts["orders"], 5000)
        self.assertGreaterEqual(counts["order_items"], 15000)
        self.assertGreaterEqual(counts["stock_movements"] + counts["tasks"], 60000)
        self.assertTrue(all(self.manifest["validations"].values()))

    def test_material_mix_and_handling_unit_contract(self):
        materials = pd.read_csv(OUT / "materials.csv.gz")
        finished_goods = pd.read_csv(OUT / "finished_goods.csv.gz")
        self.assertEqual(int(materials.material_type.eq("raw_material").sum()), 48)
        self.assertEqual(int(materials.material_type.eq("packaging_material").sum()), 32)
        self.assertGreater(48, 32)
        self.assertGreater(32, len(finished_goods))
        combined = pd.concat([materials, finished_goods], ignore_index=True)
        expected_units_per_pallet = (
            combined.units_per_handling_unit * combined.handling_units_per_pallet
        )
        self.assertTrue((expected_units_per_pallet.round() == combined.units_per_pallet).all())
        self.assertTrue(combined.max_stack_height.gt(0).all())
        self.assertFalse(materials.description.str.contains(r"\b(?:RM|PM)\s+\d{4}\b", regex=True).any())
        self.assertTrue(materials.source_item_code.notna().all())

    def test_metric_warehouse_graph_and_location_classes(self):
        locations = pd.read_csv(OUT / "locations.csv.gz")
        nodes = pd.read_csv(OUT / "warehouse_graph_nodes.csv.gz")
        edges = pd.read_csv(OUT / "warehouse_graph_edges.csv.gz")
        storage = locations[locations.zone_type.isin(["PICK_FACE", "RESERVE"])]
        self.assertEqual(set(storage.physical_class), {"AF", "AM", "AS", "BF", "BM", "BS", "CF", "CM", "CS"})
        self.assertEqual(set(storage.area), {"A", "B", "C", "D", "E"})
        self.assertTrue(storage.groupby(["area", "row_number", "bay_number"]).physical_class.nunique().eq(1).all())
        self.assertTrue(storage.travel_distance_m.gt(0).all())
        self.assertTrue({"DOCK-RECEIVING", "DOCK-DISPATCH"}.issubset(set(nodes.node_code)))
        self.assertTrue(edges.distance_m.gt(0).all())

    def test_inventory_stack_and_multibin_contract(self):
        inventory = pd.read_csv(OUT / "inventory.csv.gz")
        self.assertTrue(inventory.stacking_quantity.gt(0).all())
        self.assertFalse(inventory.location_code.duplicated().any())
        self.assertGreater(int(inventory.groupby("material_id").size().max()), 1)

    def test_hidden_generator_variables_are_not_model_features(self):
        forbidden = {"latent_demand", "random_shock", "generator_noise", "future_actual", "demand_units"}
        self.assertFalse(forbidden.intersection(FEATURES))

    def test_bom_closure_and_classification_coverage(self):
        bom = pd.read_csv(OUT / "bom_components.csv.gz")
        fg = pd.read_csv(OUT / "finished_goods.csv.gz")
        classes = pd.read_csv(OUT / "material_classifications.csv.gz")
        self.assertEqual(bom.parent_material_id.nunique(), len(fg))
        self.assertEqual(bom.component_material_id.nunique(), self.manifest["row_counts"]["materials"])
        self.assertEqual(len(classes), self.manifest["row_counts"]["materials"])
        self.assertTrue(set(classes.abc_class).issubset({"A", "B", "C"}))
        self.assertTrue(set(classes.fms_class).issubset({"F", "M", "S", "N"}))

    def test_bom_pack_profiles_match_finished_goods(self):
        materials = pd.concat([
            pd.read_csv(OUT / "materials.csv.gz"),
            pd.read_csv(OUT / "finished_goods.csv.gz"),
        ], ignore_index=True).set_index("material_id")
        bom = pd.read_csv(OUT / "bom_components.csv.gz")
        valid_targets = {source: set(targets) for source, _, _, _, targets in PM_CATALOG}
        for row in bom.itertuples(index=False):
            component = materials.loc[row.component_material_id]
            if component.material_type != "packaging_material":
                continue
            parent = materials.loc[row.parent_material_id]
            fg_index = int(parent.material_code.split("-")[-1])
            with self.subTest(parent=parent.material_code, component=component.material_code):
                self.assertIn(fg_index, valid_targets[component.source_item_code])

        hair_oil_id = materials[materials.material_code.eq("FG-0009")].index[0]
        hair_oil_components = materials.loc[
            bom[bom.parent_material_id.eq(hair_oil_id)].component_material_id
        ]
        self.assertFalse(hair_oil_components.formula_role.isin({"SURFACTANT", "THICKENER"}).any())

    def test_policy_is_service_and_capacity_feasible(self):
        policy = pd.read_csv(OUT / "inventory_policy.csv.gz")
        self.assertTrue(policy.capacity_feasible.all())
        self.assertTrue((policy.simulated_fill_rate >= policy.target_service_level).all())
        self.assertTrue((policy.proposed_expected_total_cost <= policy.current_expected_total_cost).all())

    def test_pallet_physics_fit_generated_storage_contract(self):
        materials = pd.concat([
            pd.read_csv(OUT / "materials.csv.gz"),
            pd.read_csv(OUT / "finished_goods.csv.gz"),
        ], ignore_index=True)
        self.assertTrue((materials.max_pallet_weight_kg <= 1200).all())
        self.assertTrue(((materials.volume_cm3 * materials.units_per_pallet) <= 1_800_000).all())

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

    def test_evaluator_upgrade_artifact_contract(self):
        evaluator = OUT / "evaluator"
        summary_path = evaluator / "evaluator_run_summary.json"
        if not summary_path.exists():
            self.skipTest("Evaluator pipeline has not been run in this checkout")
        required = [
            "model_leaderboard.csv",
            "neural_seed_stability.csv",
            "feature_group_ablations.csv",
            "spectral_evidence.csv",
            "assumption_registry.csv",
            "model_hypothesis_tests.csv",
            "residual_diagnostics.csv",
            "interval_calibration.csv",
            "decision_cost_sensitivity.csv",
            "claim_evidence_matrix.csv",
            "neural_training_history.csv",
            "attention_weights.csv",
            "lag_occlusion_sensitivity.csv",
            "heldout_group_permutation.csv",
            "slice_metrics.csv",
        ]
        for filename in required:
            with self.subTest(filename=filename):
                path = evaluator / filename
                self.assertTrue(path.exists())
                self.assertGreater(len(pd.read_csv(path)), 0)
        summary = json.loads(summary_path.read_text())
        self.assertEqual(summary["untouched_test_window"], ["2025-01-01", "2025-12-01"])
        self.assertFalse(summary["production_decision_eligible"])
        self.assertEqual(summary["external_population_validity"], "UNVERIFIED")
        assumptions = pd.read_csv(evaluator / "assumption_registry.csv")
        external = assumptions[assumptions.assumption.str.contains("operational population")]
        self.assertEqual(external.iloc[0].status, "UNVERIFIED")
        leaderboard = pd.read_csv(evaluator / "model_leaderboard.csv")
        self.assertEqual(
            set(leaderboard.population),
            {"RM_PM_PRIMARY", "FG_SECONDARY", "ALL_GLOBAL_SERIES"},
        )
        self.assertTrue(leaderboard.rows.gt(0).all())
        primary = leaderboard[leaderboard.population.eq("RM_PM_PRIMARY")]
        self.assertEqual(primary.groupby("split").model_name.nunique().to_dict(), {
            "selection": 9,
            "untouched_test": 9,
        })
        calibration = pd.read_csv(evaluator / "interval_calibration.csv")
        champion_calibration = calibration[
            calibration.model_name.eq(summary["locked_champion"])
        ].iloc[0]
        self.assertLessEqual(champion_calibration.coverage_ci_low, 0.80)
        self.assertGreaterEqual(champion_calibration.coverage_ci_high, 0.80)

    def test_evaluator_models_share_identical_origins(self):
        path = OUT / "evaluator" / "selection_backtest_rows.csv.gz"
        if not path.exists():
            self.skipTest("Evaluator pipeline has not been run in this checkout")
        rows = pd.read_csv(path, low_memory=False)
        origins = rows.groupby("model_name").origin_month.apply(lambda values: tuple(sorted(values.unique())))
        self.assertEqual(origins.nunique(), 1)

    def test_evaluator_untouched_test_follows_all_selection_targets(self):
        evaluator = OUT / "evaluator"
        selection_path = evaluator / "selection_backtest_rows.csv.gz"
        test_path = evaluator / "test_backtest_rows.csv.gz"
        if not selection_path.exists() or not test_path.exists():
            self.skipTest("Evaluator pipeline has not been run in this checkout")
        selection = pd.read_csv(selection_path, usecols=["forecast_month"], parse_dates=["forecast_month"])
        test = pd.read_csv(test_path, usecols=["forecast_month"], parse_dates=["forecast_month"])
        self.assertLess(selection.forecast_month.max(), test.forecast_month.min())
        self.assertEqual(test.forecast_month.min(), pd.Timestamp("2025-01-01"))
        self.assertEqual(test.forecast_month.max(), pd.Timestamp("2025-12-01"))


if __name__ == "__main__":
    unittest.main()
