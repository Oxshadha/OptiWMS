from fastapi import APIRouter
from app.services.forecast_service import load_inventory

router = APIRouter(prefix="/inventory-recommendations", tags=["inventory"])


@router.get("")
def get_inventory_recommendations(sku: str | None = None, dataset: str | None = None, model: str | None = None):
    df = load_inventory()
    if df.empty:
        return {"items": [], "count": 0}

    if sku:
        df = df[df["fg_code"] == sku]
    if dataset:
        df = df[df["dataset"] == dataset]
    if model:
        df = df[df["model"] == model]

    items = df.head(500).to_dict(orient="records")
    return {"items": items, "count": int(len(df))}
