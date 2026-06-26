from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.services.replenishment_engine import ReplenishmentEngine
from app.services.explainer import ReplenishmentExplainer
from app.db.models import ReplenishmentPlan

router = APIRouter()

@router.post("/run")
async def run_replenishment(request: Dict[str, Any], db: Session = Depends(get_db)):
    """
    Generate a full replenishment plan for a given SKU or list of SKUs.
    """
    sku = request.get("sku")
    current_stock = request.get("current_stock", 0)
    historical_demand = request.get("historical_demand", [])
    
    engine = ReplenishmentEngine(db_session=db)
    
    try:
        decision = await engine.generate_plan_for_sku(sku, current_stock, historical_demand)
        explanation = ReplenishmentExplainer.explain_decision(decision)
        
        return {
            "status": "success",
            "decision": decision,
            "xai": explanation
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/plans")
def list_plans(db: Session = Depends(get_db)):
    plans = db.query(ReplenishmentPlan).all()
    return {"plans": plans}

@router.get("/explain/{sku}")
async def explain_sku_decision(sku: str, db: Session = Depends(get_db)):
    """
    Endpoint for Chatbot/UI to request XAI for a specific SKU.
    (In a real scenario, this would load the latest draft decision from DB).
    """
    # Mock pulling decision from DB
    mock_decision = {
        "sku": sku,
        "action": "ORDER",
        "total_suggested_qty": 1500,
        "reorder_point": 500,
        "current_stock": 200,
        "safety_stock": 150,
        "eoq": 1200,
        "xyz_class": "Y",
        "supplier_splits": [{"supplier_id": "SUPP-001", "order_qty": 1500, "meets_bulk_discount": True}]
    }
    
    explanation = ReplenishmentExplainer.explain_decision(mock_decision)
    return explanation
