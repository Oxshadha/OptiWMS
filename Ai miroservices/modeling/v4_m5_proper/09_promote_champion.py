#!/usr/bin/env python3
"""Promotes the trained M5 champion model to production in the forecast service's artifacts folder."""
import os
import shutil
import json

SOURCE_MODEL_PATH = "champion_model/model.pkl"
SOURCE_META_PATH = "champion_model/metadata.json"

def main():
    print("🚀 Promoting champion model to production...")
    
    if not os.path.exists(SOURCE_MODEL_PATH):
        print(f"❌ Error: Source model {SOURCE_MODEL_PATH} not found.")
        return
    
    if not os.path.exists(SOURCE_META_PATH):
        print(f"❌ Error: Source metadata {SOURCE_META_PATH} not found.")
        return
        
    # Load source metadata
    with open(SOURCE_META_PATH, "r") as f:
        src_meta = json.load(f)
        
    model_name_raw = src_meta.get("deployed", src_meta.get("champion", "LIGHTGBM"))
    
    if "Random Forest" in model_name_raw:
        model_name = "RANDOM_FOREST"
        dir_name = "random_forest_h1"
    elif "XGBoost" in model_name_raw:
        model_name = "XGBOOST"
        dir_name = "xgboost_h1"
    else:
        model_name = "LIGHTGBM"
        dir_name = "lightgbm_h1"
        
    TARGET_DIR = os.path.join("..", "..", "outputs", "artifacts", "P", dir_name, "production")
    os.makedirs(TARGET_DIR, exist_ok=True)
    
    # Map to target metadata format
    target_meta = {
        "model_name": model_name,
        "dataset": "P",
        "horizon": 1,
        "model_cols": src_meta["features"],
        "feature_columns": src_meta["features"],
        "training_source": "M5_Forecasting_Accuracy",
        "aggregation_level": "dept_store",
        "training_metrics": {
            "WAPE": src_meta["val_metrics"]["WAPE"],
            "RMSE": src_meta["val_metrics"]["RMSE"],
            "MAE": src_meta["val_metrics"]["MAE"],
            "MAPE": src_meta["val_metrics"]["MAPE"],
            "Bias": src_meta["val_metrics"]["Bias"],
            "MASE": src_meta["val_metrics"]["MASE"]
        },
        "test_metrics": src_meta.get("test_metrics", {})
    }
    
    # Copy model file
    shutil.copy(SOURCE_MODEL_PATH, os.path.join(TARGET_DIR, "model.pkl"))
    print(f"✅ Copied model.pkl to {TARGET_DIR}")
    
    # Write metadata.json
    with open(os.path.join(TARGET_DIR, "metadata.json"), "w") as f:
        json.dump(target_meta, f, indent=2)
    print(f"✅ Created metadata.json in {TARGET_DIR} for model {model_name}")
    
    print("\n🎉 Model promotion complete!")

if __name__ == "__main__":
    main()
