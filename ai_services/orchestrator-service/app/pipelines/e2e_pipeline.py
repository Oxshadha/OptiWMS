"""
End-to-End Integration Pipeline — Phase 4.2

Orchestrates: Data Ingestion -> Forecast -> ABC/FMS Classification -> GA Optimization

This is the enterprise-grade pipeline flow:
1. Ingest demand data (from DB or Kafka)
2. Run quantile forecasts (ETS/Croston for warehouse SKUs)
3. Compute ABC and FMS classifications
4. BOM explosion (FG -> RM requirements)
5. Trigger GA optimization with enriched parcel data
6. Emit results to Kafka topics
"""
from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Optional

import requests

logger = logging.getLogger(__name__)

FORECAST_API_BASE = os.getenv("FORECAST_API_BASE_URL", "http://localhost:8091")
SLOTTING_API_BASE = os.getenv("SLOTTING_API_BASE_URL", "http://localhost:8093")
WMS_API_BASE = os.getenv("WMS_API_BASE_URL", "http://localhost:8080")


class E2EPipeline:

    def __init__(self, warehouse_id: str):
        self.warehouse_id = warehouse_id
        self.results = {}

    def step_1_forecast(self, model_name: str = "ETS") -> dict:
        """Trigger forecast inference for all SKUs in the warehouse."""
        logger.info("Step 1: Running forecast for warehouse %s", self.warehouse_id)
        try:
            resp = requests.post(
                f"{FORECAST_API_BASE}/api/v1/gateway/infer",
                json={
                    "warehouse_id": self.warehouse_id,
                    "model_name": model_name,
                    "horizon": 6,
                },
                timeout=120,
            )
            resp.raise_for_status()
            self.results["forecast"] = resp.json()
            logger.info("Forecast completed: %s", resp.status_code)
        except Exception as exc:
            logger.error("Forecast failed: %s", exc)
            self.results["forecast"] = {"error": str(exc)}
        return self.results["forecast"]

    def step_2_classify(self) -> dict:
        """Compute ABC/FMS classification based on forecast + demand history."""
        logger.info("Step 2: Computing ABC/FMS classification")
        try:
            resp = requests.post(
                f"{WMS_API_BASE}/api/materials/classify",
                json={"warehouse_id": self.warehouse_id},
                timeout=60,
            )
            resp.raise_for_status()
            self.results["classification"] = resp.json()
            logger.info("Classification completed")
        except Exception as exc:
            logger.warning("Classification API unavailable, using defaults: %s", exc)
            self.results["classification"] = {"status": "fallback", "error": str(exc)}
        return self.results["classification"]

    def step_3_bom_explosion(self) -> dict:
        """Trigger BOM explosion for derived RM requirements."""
        logger.info("Step 3: BOM explosion")
        try:
            resp = requests.post(
                f"{FORECAST_API_BASE}/api/v1/raw-materials/explode",
                json={"warehouse_id": self.warehouse_id},
                timeout=120,
            )
            resp.raise_for_status()
            self.results["bom"] = resp.json()
            logger.info("BOM explosion completed")
        except Exception as exc:
            logger.warning("BOM explosion unavailable: %s", exc)
            self.results["bom"] = {"status": "skipped", "error": str(exc)}
        return self.results["bom"]

    def step_4_optimize(self, population_size: int = 50, generations: int = 100) -> dict:
        """Trigger GA slotting optimization with enriched data."""
        logger.info("Step 4: GA optimization for warehouse %s", self.warehouse_id)
        try:
            resp = requests.post(
                f"{SLOTTING_API_BASE}/api/slotting/optimize",
                json={
                    "warehouse_id": self.warehouse_id,
                    "population_size": population_size,
                    "generations": generations,
                },
                timeout=300,
            )
            resp.raise_for_status()
            self.results["optimization"] = resp.json()
            logger.info("GA optimization completed: fitness=%s",
                        self.results["optimization"].get("best_fitness"))
        except Exception as exc:
            logger.error("GA optimization failed: %s", exc)
            self.results["optimization"] = {"error": str(exc)}
        return self.results["optimization"]

    def step_5_emit_events(self):
        """Emit results to Kafka topics."""
        logger.info("Step 5: Emitting events to Kafka")
        try:
            import sys
            sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "shared"))
            from kafka_client import (
                emit_forecast_result,
                emit_slotting_result,
            )

            forecast = self.results.get("forecast", {})
            if "error" not in forecast:
                emit_forecast_result(
                    self.warehouse_id,
                    forecast.get("model_name", "unknown"),
                    forecast.get("n_series", 0),
                    forecast.get("wape", 0.0),
                )

            optimization = self.results.get("optimization", {})
            if "error" not in optimization:
                emit_slotting_result(
                    self.warehouse_id,
                    len(optimization.get("assignments", [])),
                    optimization.get("best_fitness", 0.0),
                )

            logger.info("Kafka events emitted")
        except ImportError:
            logger.debug("Kafka client not available, skipping event emission")

    def run_full_pipeline(self, population_size: int = 50, generations: int = 100) -> dict:
        """Execute the full E2E pipeline."""
        start = datetime.utcnow()
        logger.info("Starting E2E pipeline for warehouse %s at %s", self.warehouse_id, start)

        self.step_1_forecast()
        self.step_2_classify()
        self.step_3_bom_explosion()
        self.step_4_optimize(population_size, generations)
        self.step_5_emit_events()

        elapsed = (datetime.utcnow() - start).total_seconds()
        self.results["pipeline_meta"] = {
            "warehouse_id": self.warehouse_id,
            "elapsed_seconds": elapsed,
            "completed_at": datetime.utcnow().isoformat(),
            "steps_completed": len([k for k, v in self.results.items()
                                     if isinstance(v, dict) and "error" not in v]),
        }

        logger.info("E2E pipeline completed in %.1fs", elapsed)
        return self.results
