#!/usr/bin/env python3
import pickle
import json
import pandas as pd
import numpy as np

MODEL_DIR = "/Users/k.e.oshada/Documents/OptiWMS/Ai miroservices/modeling/outputs/artifacts/P/lightgbm_h1/production"

def main():
    print("Loading model and metadata...")
    with open(f"{MODEL_DIR}/model.pkl", "rb") as f:
        reg = pickle.load(f)
        
    with open(f"{MODEL_DIR}/metadata.json", "r") as f:
        meta = json.load(f)
        
    print("Type of reg:", type(reg))
    
    # Create dummy frame with model_cols
    cols = meta["model_cols"]
    print("Model columns:", cols)
    
    dummy_data = {c: [1.0] for c in cols}
    frame = pd.DataFrame(dummy_data)
    
    print("\nRunning alignment...")
    # Simulate _predict_boosting_from_frame
    feature_columns = meta.get("feature_columns") or []
    x = pd.get_dummies(frame, columns=[c for c in ["fg_code", "fg_category"] if c in frame.columns], drop_first=False)
    x = x.reindex(columns=feature_columns, fill_value=0)
    
    print("Shape of x:", x.shape)
    print("Columns of x:", list(x.columns))
    
    try:
        preds = reg.predict(x)
        print("Prediction successful:", preds)
    except Exception as e:
        print("\n❌ Prediction failed with error:")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
