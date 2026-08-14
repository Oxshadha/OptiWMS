# 📈 Replenishment Service

The **Replenishment Service** is a FastAPI microservice that optimizes purchasing and stock levels. By integrating demand forecasts, warehouse shelf spaces, and supplier constraints, it employs a **Mixed-Integer Linear Programming (MILP)** solver to generate purchase recommendations, calculate safety stocks, and allocate orders across suppliers. It includes an **Explainable AI (XAI)** engine that translates complex mathematical selections into plain English.

---

## 📂 Code Location & Structure

- **Code Path**: [`ai_services/replenishment-service`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/replenishment-service)
- **Key Modules**:
  - [`app/main.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/replenishment-service/app/main.py): Service boot loader and router mapping.
  - [`app/services/replenishment_engine.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/replenishment-service/app/services/replenishment_engine.py): Coordinates ABC-XYZ classification, forecast gathering, safety math, and MILP optimization calls.
  - [`app/services/replenishment_math.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/replenishment-service/app/services/replenishment_math.py): Implements probabilistic equations for Safety Stock, Reorder Point (ROP), and Economic Order Quantity (EOQ).
  - [`app/services/supplier_selector.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/replenishment-service/app/services/supplier_selector.py): Sets up and runs the MILP optimizer using `mip` libraries.
  - [`app/services/explainer.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/replenishment-service/app/services/explainer.py): The XAI explanation compiler.

---

## ⚡ Main API Endpoints

The service runs on **Port `8083`** by default when run in Python standalone mode (often sharing port domains or routed through coordinate agents). Interactive documentation is available at `http://localhost:8083/docs`.

### 1. Optimization Runs
- **`POST /api/v1/replenishment/run`**: Generates a replenishment plan.
  - **Payload**: Receives SKU codes, current stock, and historical demand arrays.
  - **Execution**: Computes classification targets, fetches live forecasts and supplier constraints, runs safety stock math, optimizes PO allocations, and generates natural-language XAI reports.
- **`GET /api/v1/replenishment/plans`**: Queries all historical replenishment plan suggestions from the local database.

### 2. Explainable AI (XAI)
- **`GET /api/v1/replenishment/explain/{sku}`**: Explains stock decisions for a specific SKU.
  - Evaluates ordering cost ratios, MOQ limitations, safety buffer values, and bulk discounts.
  - **Output Example**: *"Reorder of 1500 units suggested from SUPP-001. Current stock (200) is below Reorder Point (500). Order size reaches the MOQ bulk discount threshold (1000) saving 10% on price."*

---

## 📐 Optimization Logic & Math

The engine operates in five structured phases:

### Phase 1: Inventory Classification (ABC-XYZ)
The service classifies SKUs based on demand value (ABC analysis) and demand predictability/volatility (XYZ analysis, measured using the Coefficient of Variation). High-priority items (e.g., A-X class) are assigned tighter service levels (e.g., 99%), while low-impact, erratic items (C-Z class) get lower targets (e.g., 90%) to prevent holding capital.

### Phase 2: Safety Stock & ROP
- **Probabilistic Safety Stock**: Evaluates standard demand standard deviations ($\sigma_D$) and supplier lead-time standard deviations ($\sigma_L$) using the formula:
  $$\text{Safety Stock} = z \times \sqrt{\bar{L}\sigma_D^2 + \bar{D}^2\sigma_L^2}$$
  *(where $z$ is the service level factor, $\bar{L}$ is lead time, and $\bar{D}$ is daily demand).*
- **Reorder Point (ROP)**:
  $$\text{ROP} = (\bar{D} \times \bar{L}) + \text{Safety Stock}$$

### Phase 3: Economic Order Quantity (EOQ)
Calculates optimal purchasing sizes to balance storage holding costs against order processing fees:
$$\text{EOQ} = \sqrt{\frac{2 \times D \times S}{H}}$$
*(where $D$ is annual demand, $S$ is ordering fee, and $H$ is unit holding cost).*

### Phase 4: MILP Supplier Optimization
If stock falls below ROP, the MILP engine evaluates supplier splits. It selects orders to minimize total price, handles MOQs, splits demands when supplier capacity is capped, and claims bulk discounts while verifying warehouse volume limits.
