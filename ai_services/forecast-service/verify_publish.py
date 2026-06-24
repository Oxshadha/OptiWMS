from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.models import Base, ForecastRun, ForecastMetric, ForecastPrediction
from app.services.forecast_service import publish_online

engine = create_engine("sqlite:///:memory:")
Base.metadata.create_all(engine)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

run = ForecastRun(id=1, dataset="P", model_name="LIGHTGBM", status="running")
db.add(run)
db.commit()

try:
    res = publish_online(db, run, horizons=[1, 2])
    print("Publish Success:")
    print(res)
except Exception as e:
    print(f"Publish Failed: {e}")
    import traceback
    traceback.print_exc()
