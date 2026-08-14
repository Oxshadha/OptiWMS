# OptiWMS Forecast SHAP Explanations & Model Artifacts Reference

This reference document compiles details about how forecast explanations, model artifacts, and probabilistic target values are generated and structured in OptiWMS.

---

## 🚀 1. How SHAP Values are Generated

SHAP (SHapley Additive exPlanations) values are computed pre-computationally during a forecast publish run inside [forecast_service.py](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/forecast-service/app/services/forecast_service.py) via the `compute_and_persist_shap` function in [shap_service.py](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/forecast-service/app/services/shap_service.py):

* **Load Artifacts:** It retrieves the active, trained production model (e.g., XGBoost, CatBoost, LightGBM, or RandomForest) for the specific dataset, model type, and horizon.
* **Initialize Explainer:** It initializes a `shap.TreeExplainer` on the loaded machine learning model.
* **Run SHAP:** It computes the feature attribution values by calling:
  ```python
  shap_matrix = explainer.shap_values(feature_frame)
  ```
  where `feature_frame` contains the exact feature columns built at prediction time.
* **Post-Process & Filter:** It filters out identity one-hot encoded variables (like `fg_code_` and `fg_category_` dummies since they identify the SKU rather than explain operational drivers). It then saves the top-$N$ contributing features (sorted by absolute value).

---

## 👥 2. SKU and Dataset Specifications

* **For which SKUs:** They are generated for the active SKUs forecasted during the current online publish run.
* **Database Storage:** They are persisted directly in the `forecast_shap_explanations` table of the SQLite database (`forecast_service.db`).
* **Difference from Training Dataset:** Yes, they explain the predictions on the **inference/live dataset** (using the new feature rows constructed at prediction/forecast execution time). They do not represent the static training dataset's explanations, but rather the live operational indicators driving the current forecast.

---

## 📋 3. Generation Process & Feature Columns Required

SHAP requires the exact feature columns that the model uses to generate a prediction. For each SKU, the feature row contains:

* **Lags:** `lag_1`, `lag_2`, `lag_3`, `lag_6`, `lag_12` (demand in previous months).
* **Rolling Demand Averages/Volatility:** `roll_mean_3`, `roll_mean_6`, `roll_std_3`, etc.
* **Seasonality Indicators:** `month_num`, `quarter`, `month_sin`, `month_cos`.
* **Supply Chain & Operational Metrics (from the prior month):** `on_hand_inventory_lag1`, `stockout_days_lag1`, `promotion_flag_lag1`, `price_or_discount_lag1`, `lead_time_days_lag1`, `supplier_otif_lag1`, etc.

The explainer compares the target SKU's feature values to the average baseline prediction (`expected_value`) of the training population, measuring how much each column shifts the outcome.

---

## 📈 4. SHAP Value Direction & Priority

Each feature receives a calculated SHAP value:

* **Direction/Effect:** A positive SHAP value (e.g., `+87.2` units) pushed the forecast up from the baseline, while a negative SHAP value (e.g., `-34.5` units) pulled the prediction down.
* **Magnitude/Priority:** The absolute size of the value indicates how strong its effect was. The system sorts them by `abs(shap_value)` descending and keeps the top-$N$ most significant columns (representing the highest-priority drivers).

---

## 📦 5. Model Artifacts vs. SHAP Explanations

The **model artifacts** are not the feature contributions themselves. Instead, they are the trained machine learning models and their training configurations.

Specifically, as shown in [artifact_service.py](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/forecast-service/app/services/artifact_service.py), a boosting model's artifact directory contains the following files:

* **The Serialized Model Files:**
  * **XGBoost:** `model.json`
  * **CatBoost:** `model.cbm`
  * **LightGBM / RandomForest:** `model.pkl` (pickle binary) or `model.txt`
  * **Quantile Models:** (Optional) `model_q10.pkl` and `model_q90.pkl` used to compute confidence intervals (p10/p90).
* **A Metadata File (`metadata.json`):** Contains details about the training configuration, such as:
  * `model_cols` / `feature_columns`: The exact list and order of columns that the model expects as inputs.
  * `use_log_target`: A boolean indicating if the target demand variable was log-transformed (e.g., `log(y + 1)`) during training, signaling the system to transform predictions back (e.g., `expm1(preds)`) during inference.

---

## 📊 6. Probabilistic Forecast Parameters

These represent the confidence intervals (percentiles) and the target month of the forecast in SQLite (`forecast_service.db`) in the `forecast_predictions` table:

1. **The Percentiles (`p10`, `p50`, `p90`)**
   * **`p50` (Median Forecast / Main Estimate):** This is the 50th percentile forecast. There is a 50% chance actual demand will be higher than this, and a 50% chance it will be lower. This is used as the primary point forecast.
   * **`p10` (Lower Bound / Pessimistic Estimate):** This is the 10th percentile forecast. There is only a 10% chance that actual demand will fall below this number.
   * **`p90` (Upper Bound / Optimistic Estimate):** This is the 90th percentile forecast. There is a 90% chance that actual demand will be at or below this number. It is typically used to calculate safety stock.
2. **The Period / Month Column**
   * Represents the target month/period for the prediction (e.g., `2026-07`), stored as the `month` column in [models.py](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/forecast-service/app/db/models.py).

---

## 🔍 7. Where to View the SHAP Values

* **Table Location:** 
  * Table name: `forecast_shap_explanations`
  * Database file: [forecast_service.db](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/forecast_service.db)
  * Mapped in code: Mapped as the `ForecastShapExplanation` model in [models.py](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/forecast-service/app/db/models.py#L176-L192).
* **Directly in SQLite:**
  ```sql
  SELECT sku, horizon, prediction, base_value, top_features_json 
  FROM forecast_shap_explanations 
  WHERE sku = 'SKU-300001';
  ```
* **REST API Endpoint:** Exposed in [shap.py](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/forecast-service/app/api/v1/routes/shap.py):
  `GET /api/v1/shap/explanation?sku=SKU-300001&horizon=3`
* **Frontend Dashboard Chat Drawer:** When you click "Explain Forecast" on the UI, it sends a payload to [explain_router.py](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/ai-agent/explain_router.py) in the AI Agent, which fetches SHAP values and feeds them to Gemini.

---

## 💡 8. Example SHAP Value Breakdown

Here is a practical example of how the SHAP value breakdown looks for a single prediction.

### 1. Mathematical Breakdown
For a specific SKU prediction (e.g., predicted demand of **$495.0$ units**):

$$\text{Final Prediction } (495.0) = \text{Base Value } (320.4) + \sum \text{SHAP Values } (+ 174.6)$$

| Feature Column | Raw Feature Value | SHAP Value (Effect) | Meaning / Interpretation |
| :--- | :--- | :--- | :--- |
| **`lag_1`** | `490.0` units | **`+87.2`** | Last month's strong demand of $490$ units pushed this month's forecast up by **$87.2$ units**. |
| **`roll_mean_6`** | `410.5` units | **`+52.1`** | A high 6-month average demand of $410.5$ units pushed the forecast up by **$52.1$ units**. |
| **`stockout_days_lag1`** | `5` days | **`+45.3`** | Having $5$ stockout days last month caused pent-up demand, pulling this forecast up by **$45.3$ units**. |
| **`price_or_discount_lag1`** | `0.15` (15% discount) | **`-10.0`** | A 15% discount last month pulled this month's forecast down by **$10.0$ units** (e.g., discount ended). |

### 2. JSON Structure stored in Database (`top_features_json`)
In the `forecast_shap_explanations` table, the `top_features_json` column stores this payload:

```json
[
  {
    "feature": "lag_1",
    "label": "demand 1 month ago",
    "shap_value": 87.2,
    "feature_value": 490.0
  },
  {
    "feature": "roll_mean_6",
    "label": "6-month average demand",
    "shap_value": 52.1,
    "feature_value": 410.5
  },
  {
    "feature": "stockout_days_lag1",
    "label": "stockout days (prior month)",
    "shap_value": 45.3,
    "feature_value": 5.0
  },
  {
    "feature": "price_or_discount_lag1",
    "label": "price / discount (prior month)",
    "shap_value": -10.0,
    "feature_value": 0.15
  }
]
```

### 3. API Response Payload
When queried via `GET /api/v1/shap/explanation?sku=SKU-300001&horizon=3`, the endpoint returns:

```json
{
  "sku": "SKU-300001",
  "horizon": 3,
  "dataset": "B",
  "model_name": "XGBOOST",
  "prediction": 495.0,
  "base_value": 320.4,
  "top_features": [
    { "feature": "lag_1", "label": "demand 1 month ago", "shap_value": 87.2, "feature_value": 490.0 },
    { "feature": "roll_mean_6", "label": "6-month average demand", "shap_value": 52.1, "feature_value": 410.5 },
    { "feature": "stockout_days_lag1", "label": "stockout days (prior month)", "shap_value": 45.3, "feature_value": 5.0 },
    { "feature": "price_or_discount_lag1", "label": "price / discount (prior month)", "shap_value": -10.0, "feature_value": 0.15 }
  ],
  "computed_at": "2026-06-21T14:30:00"
}
```

---

## 📂 Code Reference Links

* [**`shap_service.py`**](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/forecast-service/app/services/shap_service.py) — Computes and queries SHAP values.
* [**`artifact_service.py`**](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/forecast-service/app/services/artifact_service.py) — Handles model loading and inference feature alignment.
* [**`forecast_service.py`**](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/forecast-service/app/services/forecast_service.py) — Triggers prediction and SHAP pre-computation at publish time.
* [**`models.py`**](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/forecast-service/app/db/models.py) — Database models (`ForecastPrediction` & `ForecastShapExplanation`).
* [**`shap.py`**](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/forecast-service/app/api/v1/routes/shap.py) — REST API endpoint serving the computed SHAP values.
* [**`explain_router.py`**](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/ai-agent/explain_router.py) — UI explanation router that packages SHAP values into Gemini prompts.

