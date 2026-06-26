from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.database import Base

class ReplenishmentPlan(Base):
    __tablename__ = "replenishment_plans"

    id = Column(Integer, primary_key=True, index=True)
    plan_date = Column(DateTime, default=datetime.utcnow)
    warehouse_id = Column(String, index=True)
    status = Column(String, default='draft') # draft/approved/rejected
    approved_by = Column(String, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    total_order_value = Column(Float, default=0.0)
    total_skus = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    lines = relationship("ReplenishmentLine", back_populates="plan", cascade="all, delete-orphan")

class ReplenishmentLine(Base):
    __tablename__ = "replenishment_lines"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("replenishment_plans.id"))
    sku = Column(String, index=True)
    category = Column(String)
    abc_class = Column(String)
    xyz_class = Column(String)
    current_stock = Column(Float)
    forecasted_demand_3m = Column(Float)
    forecasted_demand_6m = Column(Float)
    safety_stock = Column(Float)
    reorder_point = Column(Float)
    eoq = Column(Float)
    suggested_qty = Column(Float)
    approved_qty = Column(Float, nullable=True)
    supplier_id = Column(String)
    unit_price = Column(Float)
    total_cost = Column(Float)
    expected_delivery = Column(DateTime, nullable=True)
    status = Column(String, default='pending')
    
    plan = relationship("ReplenishmentPlan", back_populates="lines")

class SkuClassification(Base):
    __tablename__ = "sku_classifications"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String, unique=True, index=True)
    abc_class = Column(String)
    xyz_class = Column(String)
    combined_class = Column(String)
    service_level_target = Column(Float)
    classified_at = Column(DateTime, default=datetime.utcnow)
