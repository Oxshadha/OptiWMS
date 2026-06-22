from datetime import datetime
from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.db.database import Base


class ForecastRun(Base):
    __tablename__ = "forecast_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    dataset: Mapped[str] = mapped_column(String(16), index=True)
    model_name: Mapped[str] = mapped_column(String(64), index=True)
    model_version: Mapped[str] = mapped_column(String(64), default="v1")
    warehouse_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(32), default="created")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ForecastPrediction(Base):
    __tablename__ = "forecast_predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("forecast_runs.id"), index=True)
    dataset: Mapped[str] = mapped_column(String(16), index=True)
    model_name: Mapped[str] = mapped_column(String(64), index=True)
    warehouse_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    sku: Mapped[str] = mapped_column(String(64), index=True)
    category: Mapped[str | None] = mapped_column(String(64), nullable=True)
    month: Mapped[str] = mapped_column(String(16), index=True)
    horizon: Mapped[int] = mapped_column(Integer, index=True)
    p10: Mapped[float] = mapped_column(Float)
    p50: Mapped[float] = mapped_column(Float)
    p90: Mapped[float] = mapped_column(Float)
    y_true: Mapped[float | None] = mapped_column(Float, nullable=True)


class ForecastMetric(Base):
    __tablename__ = "forecast_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("forecast_runs.id"), index=True)
    dataset: Mapped[str] = mapped_column(String(16), index=True)
    model_name: Mapped[str] = mapped_column(String(64), index=True)
    warehouse_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    split: Mapped[str] = mapped_column(String(16), index=True)
    horizon: Mapped[int] = mapped_column(Integer, index=True)
    wape: Mapped[float | None] = mapped_column(Float, nullable=True)
    mase_mean: Mapped[float | None] = mapped_column(Float, nullable=True)
    rmse: Mapped[float | None] = mapped_column(Float, nullable=True)
    bias: Mapped[float | None] = mapped_column(Float, nullable=True)


class InventoryRecommendation(Base):
    __tablename__ = "inventory_recommendations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("forecast_runs.id"), index=True)
    dataset: Mapped[str] = mapped_column(String(16), index=True)
    model_name: Mapped[str] = mapped_column(String(64), index=True)
    warehouse_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    sku: Mapped[str] = mapped_column(String(64), index=True)
    category: Mapped[str | None] = mapped_column(String(64), nullable=True)
    safety_stock: Mapped[float] = mapped_column(Float)
    reorder_point: Mapped[float] = mapped_column(Float)
    target_max: Mapped[float] = mapped_column(Float)
    on_hand_inventory: Mapped[float | None] = mapped_column(Float, nullable=True)
    suggested_order_qty: Mapped[float] = mapped_column(Float)


class BomComponentMapping(Base):
    __tablename__ = "bom_component_mappings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    fg_sku: Mapped[str] = mapped_column(String(64), index=True)
    rm_sku: Mapped[str] = mapped_column(String(64), index=True)
    qty_per_fg_unit: Mapped[float] = mapped_column(Float, default=1.0)
    scrap_rate: Mapped[float] = mapped_column(Float, default=0.0)
    lead_time_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_active: Mapped[int] = mapped_column(Integer, default=1, index=True)
    source: Mapped[str] = mapped_column(String(32), default="manual")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class RawMaterialRequirement(Base):
    __tablename__ = "raw_material_requirements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("forecast_runs.id"), index=True)
    dataset: Mapped[str] = mapped_column(String(16), index=True)
    model_name: Mapped[str] = mapped_column(String(64), index=True)
    warehouse_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    rm_sku: Mapped[str] = mapped_column(String(64), index=True)
    rm_category: Mapped[str | None] = mapped_column(String(64), nullable=True)
    fg_sku_count: Mapped[int] = mapped_column(Integer, default=0)
    gross_requirement_qty: Mapped[float] = mapped_column(Float, default=0.0)
    on_hand_inventory: Mapped[float | None] = mapped_column(Float, nullable=True)
    safety_stock: Mapped[float] = mapped_column(Float, default=0.0)
    reorder_point: Mapped[float] = mapped_column(Float, default=0.0)
    net_requirement_qty: Mapped[float] = mapped_column(Float, default=0.0)
    suggested_procure_qty: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class ForecastRunSummary(Base):
    __tablename__ = "forecast_run_summaries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("forecast_runs.id"), index=True, unique=True)
    dataset: Mapped[str] = mapped_column(String(16), index=True)
    model_name: Mapped[str] = mapped_column(String(64), index=True)
    warehouse_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    forecast_rows: Mapped[int] = mapped_column(Integer, default=0)
    metric_rows: Mapped[int] = mapped_column(Integer, default=0)
    inventory_rows: Mapped[int] = mapped_column(Integer, default=0)
    sku_count: Mapped[int] = mapped_column(Integer, default=0)
    horizon_count: Mapped[int] = mapped_column(Integer, default=0)
    reorder_now_count: Mapped[int] = mapped_column(Integer, default=0)
    overstock_risk_count: Mapped[int] = mapped_column(Integer, default=0)
    total_suggested_order_qty: Mapped[float] = mapped_column(Float, default=0.0)
    avg_wape_test: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_rmse_test: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_mase_test: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_abs_bias_test: Mapped[float | None] = mapped_column(Float, nullable=True)
    rmse_vs_avg_demand_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PublishJob(Base):
    __tablename__ = "publish_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("forecast_runs.id"), index=True)
    mode: Mapped[str] = mapped_column(String(16), default="auto")
    status: Mapped[str] = mapped_column(String(24), default="queued", index=True)  # queued|processing|succeeded|failed
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class ModelRegistryEntry(Base):
    __tablename__ = "model_registry_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    dataset: Mapped[str] = mapped_column(String(32), index=True)
    warehouse_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    model_name: Mapped[str] = mapped_column(String(64), index=True)
    model_version: Mapped[str] = mapped_column(String(64), default="v1")
    artifact_stage: Mapped[str] = mapped_column(String(32), default="production")
    status: Mapped[str] = mapped_column(String(32), default="active", index=True)
    is_champion: Mapped[int] = mapped_column(Integer, default=0, index=True)
    priority: Mapped[int] = mapped_column(Integer, default=100)
    metrics_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class OperationalHealthSnapshot(Base):
    __tablename__ = "operational_health_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    status: Mapped[str] = mapped_column(String(16), index=True)  # ok|warn|critical
    drift_status: Mapped[str] = mapped_column(String(16), default="unknown")
    freshness_status: Mapped[str] = mapped_column(String(16), default="unknown")
    inference_status: Mapped[str] = mapped_column(String(16), default="unknown")
    details_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class ForecastShapExplanation(Base):
    """Persists top-N SHAP feature contributions per SKU/horizon after each forecast run."""
    __tablename__ = "forecast_shap_explanations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("forecast_runs.id"), index=True)
    dataset: Mapped[str] = mapped_column(String(16), index=True)
    model_name: Mapped[str] = mapped_column(String(64), index=True)
    sku: Mapped[str] = mapped_column(String(64), index=True)
    horizon: Mapped[int] = mapped_column(Integer, index=True)
    # JSON array: [{"feature": "lag_1", "label": "demand 1 month ago",
    #               "shap_value": 42.3, "feature_value": 450.0}, ...]
    top_features_json: Mapped[str] = mapped_column(Text)
    base_value: Mapped[float] = mapped_column(Float)   # SHAP expected value (model baseline)
    prediction: Mapped[float] = mapped_column(Float)   # model output for this SKU/horizon
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

