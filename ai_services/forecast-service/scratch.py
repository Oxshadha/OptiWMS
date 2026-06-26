from app.services.artifact_service import infer_boosting_online

res = infer_boosting_online(
    dataset="P",
    model_name="LIGHTGBM",
    horizon=1,
    series=[{"series_id": "100005", "fg_code": "100005", "fg_category": "ETHYL ALCOHOL"}],
)
print(res["errors"])
