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
