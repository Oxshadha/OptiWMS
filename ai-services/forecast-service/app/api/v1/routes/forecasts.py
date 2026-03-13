from fastapi import APIRouter, Query
from app.services.forecast_service import load_forecast

router = APIRouter(prefix="/forecasts", tags=["forecasts"])


@router.get("")
def get_forecasts(
    sku: str | None = None,
    horizon: int | None = Query(default=None, ge=1, le=12),
    dataset: str | None = None,
    model: str | None = None,
):
    df = load_forecast()
    if df.empty:
        return {"items": [], "count": 0}

    if sku:
        df = df[df["fg_code"] == sku]
    if horizon is not None:
        df = df[df["horizon"] == horizon]
    if dataset:
        df = df[df["dataset"] == dataset]
    if model:
        df = df[df["model"] == model]

    items = df.head(500).to_dict(orient="records")
    return {"items": items, "count": int(len(df))}
