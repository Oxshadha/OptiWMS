# 🚀 OptiWMS AI Features & Capabilities Guide

This document outlines the core AI features implemented across the OptiWMS AI microservices stack. It describes what each feature does operationally, its underlying technical purpose, and points to the relevant codebase components.

---

## 📌 Table of Contents
1. [Demand Forecasting & ML Model Governance](#1-demand-forecasting--ml-model-governance)
2. [Warehouse Slotting & Storage Optimization](#2-warehouse-slotting--storage-optimization)
3. [Pathfinding & Picker Route Planning](#3-pathfinding--picker-route-planning)
4. [Replenishment & Procurement Optimization](#4-replenishment--procurement-optimization)
5. [Conversational Copilot & Natural Language Reporting](#5-conversational-copilot--natural-language-reporting)
6. [Central Sync Hub & Job Orchestration](#6-central-sync-hub--job-orchestration)

---

## 1. Demand Forecasting & ML Model Governance

### 📈 Online Demand Forecasting & ML Inference
*   **What It Does**: Uses tree-based boosting model artifacts (XGBoost, CatBoost, LightGBM, and RandomForest) to compute short and long-term product sales forecasts. Features such as past sales momentum (`lag_1`), rolling averages (`roll_mean_6`), and indicators (seasonality, supplier delays) are dynamically constructed during inference.
*   **What is the Purpose**: Helps demand planners anticipate upcoming order volumes. This prevents inventory stockouts (lost revenue) and reduces storage overstocking (capital tied up in stagnant inventory).
*   **Relevant Code**: [`forecast-service/app/api/v1/routes/artifacts.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/forecast-service/app/api/v1/routes/artifacts.py)

### 🛡️ Production Readiness & Acceptance Gates
*   **What It Does**: Programmatically validates newly generated models against strict quality rules (e.g. WAPE error must be $\le$ 13.5%, Normalized Bias $\le$ 10%, early-warning serving latency $\le$ 1000ms) before permitting promotion to production status.
*   **What is the Purpose**: Acts as an automated firewall to prevent corrupt, underperforming, or delayed machine learning models from making inaccurate replenishment orders.
*   **Relevant Code**: [`forecast-service/app/services/governance_service.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/forecast-service/app/services/governance_service.py)

### 🔄 Automatic Statistical Baseline Fallback
*   **What It Does**: Detects if an ML model fails to load, encounters shape mismatches, or fails validation during live inference. When this happens, it automatically falls back to generating statistical baselines (Seasonal Naive or Last Value) and flags the response (`fallback_used=true`).
*   **What is the Purpose**: Ensures continuous, uninterrupted operations (high availability) for frontend dashboards and buying agents, even during complete ML engine errors.
*   **Relevant Code**: [`forecast-service/tests/test_artifact_service_fallback.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/forecast-service/tests/test_artifact_service_fallback.py)

### 📊 Explainable AI: SHAP Feature Attribution
*   **What It Does**: Combines pre-computed machine learning model feature attributions (calculated using `shap.TreeExplainer` on models like XGBoost/CatBoost) with natural language summarization via Google Gemini (`gemini-2.5-flash`). It parses raw mathematical weights (e.g. `lag_1`, `stockout_days_lag1`) and translates them into plain-English reasons explaining the direction of forecast adjustments.
*   **What is the Purpose**: Removes the "black box" nature of machine learning forecasting. It provides warehouse managers and demand planners with readable, intuitive, and trustworthy insights explaining *why* demand for a specific product is predicted to increase or decrease.
*   **Relevant Code**: 
    - [`forecast-service/app/services/shap_service.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/forecast-service/app/services/shap_service.py) (SHAP precomputation & DB persistence)
    - [`forecast-service/app/api/v1/routes/shap.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/forecast-service/app/api/v1/routes/shap.py) (Attribution REST API)
    - [`ai-agent/explain_router.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/ai-agent/explain_router.py) (Gemini prompt builder & streaming route)

---

## 2. Warehouse Slotting & Storage Optimization

### 🧬 Genetic Algorithm Location Placement
*   **What It Does**: Employs a Genetic Algorithm (via the DEAP library) to find the best storage layout in the warehouse. It scores combinations of product characteristics (dimensions, weight, hazard levels, sales velocity) against rack capabilities.
*   **What is the Purpose**: Maximizes space utilization while enforcing physical warehouse safety (e.g., keeping heavy items near the floor, toxic/hazardous products isolated, and fast-moving items close to dispatch docks).
*   **Relevant Code**: [`slotting-service/app/services/slotting.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/slotting-service/app/services/slotting.py) and [`slotting-service/app/api/fitness.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/slotting-service/app/api/fitness.py)

### 📅 Deterministic & MILP Quarterly Planner
*   **What It Does**: Provides quarterly warehouse layout restructuring options within a predefined maximum number of physical moves (move budget). Evaluates high-velocity items using a Mixed-Integer Linear Programming (MILP) solver.
*   **What is the Purpose**: Enables periodic layout updates to adjust for changing sales seasons, without causing excessive operational disruptions or labor-cost spikes due to product moving tasks.
*   **Relevant Code**: [`slotting-service/app/services/plan_optimizer.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/slotting-service/app/services/plan_optimizer.py)

---

## 3. Pathfinding & Picker Route Planning

### 🧭 A* Walkway Pathfinding
*   **What It Does**: Implements A\* pathfinding search on grid-based warehouse layouts, calculating routes that support diagonal paths, obstacle clearance, and compass navigation directions (North, South, East, West, Diagonal).
*   **What is the Purpose**: Guides operators along the shortest path through aisles, reducing walking times, operator fatigue, and congestion points.
*   **Relevant Code**: [`path-optimization-service/app/algorithms/astar.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/path-optimization-service/app/algorithms/astar.py)

### 🗺️ Nearest-Neighbor TSP Route Optimizer
*   **What It Does**: Resolves a Traveling Salesperson Problem (TSP) for order pickers collecting multiple items from various locations. Re-sequences stops to compute the shortest complete path.
*   **What is the Purpose**: Eliminates backtracking within aisles, optimizing picking efficiency and maximizing completed order throughput.
*   **Relevant Code**: [`path-optimization-service/app/algorithms/route_optimizer.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/path-optimization-service/app/algorithms/route_optimizer.py)

### 📥 Putaway Suggestion Engine
*   **What It Does**: Ranks candidate storage racks by travel cost (using A\*) starting from the entry dock or current picker position, suggesting the top-3 placements.
*   **What is the Purpose**: Accelerates the unloading process by placing incoming inventory in locations that are physically closer and easier to access.
*   **Relevant Code**: [`path-optimization-service/app/api/pathfinding_routes.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/path-optimization-service/app/api/pathfinding_routes.py)

---

## 4. Replenishment & Procurement Optimization

### 📊 ABC-XYZ Demand Classifier
*   **What It Does**: Dynamically analyzes past sales trends to categorize materials based on total value/volume (ABC) and demand variability (XYZ).
*   **What is the Purpose**: Assigns stricter service level targets (e.g. 99% for AX, 90% for CZ) automatically, focusing procurement resources where they prevent stockouts of critical goods.
*   **Relevant Code**: [`replenishment-service/app/services/classifier.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/replenishment-service/app/services/classifier.py)

### 📐 Probabilistic Safety Stock & EOQ Calculator
*   **What It Does**: Computes safety stock buffers, reorder thresholds (ROP), and Economic Order Quantities (EOQ) using mathematical demand standard deviations and supplier lead time variances.
*   **What is the Purpose**: Mitigates risk from delayed supplier deliveries and optimizes purchase order frequency to balance ordering costs against holding costs.
*   **Relevant Code**: [`replenishment-service/app/services/replenishment_math.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/replenishment-service/app/services/replenishment_math.py)

### 📈 Mixed-Integer Linear Programming (MILP) Order Splitter
*   **What It Does**: Models procurement as a MILP problem, evaluating multiple suppliers offering varying prices, shipment delays, minimum order quantities (MOQ), and volume discounts while respecting warehouse storage limits.
*   **What is the Purpose**: Finds the lowest-cost purchasing distribution, capitalizing on quantity discounts without exceeding the physical space or weight limits of warehouse racks.
*   **Relevant Code**: [`replenishment-service/app/services/supplier_selector.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/replenishment-service/app/services/supplier_selector.py)

### 💬 Explainable AI: Procurement Explainer
*   **What It Does**: Compiles mathematical optimization results (such as supplier selections and quantity recommendations) into plain English summaries.
*   **What is the Purpose**: Provides procurement officers with clear explanations (e.g., *"MOQ discount met"* or *"ROP limit breached"*), streamlining the PO approval workflow.
*   **Relevant Code**: [`replenishment-service/app/services/explainer.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/replenishment-service/app/services/explainer.py)

---

## 5. Conversational Copilot & Natural Language Reporting

### 📂 Standard Operating Procedure RAG Chatbot
*   **What It Does**: Employs LangChain and ChromaDB to extract SOP documents, split and vectorize their text, and query them with Google Gemini embeddings to return conversational instructions with exact source references.
*   **What is the Purpose**: Gives operations workers immediate access to safety guidelines, machine manuals, and compliance protocols, minimizing training times.
*   **Relevant Code**: [`ai-agent/ingest.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/ai-agent/ingest.py) and [`ai-agent/agent.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/ai-agent/agent.py)

### 💬 Natural Language-to-SQL Reporting
*   **What It Does**: Translates plain-text database questions into PostgreSQL queries, runs them against the warehouse database, renders Plotly analytics charts, and exports summaries or PDFs.
*   **What is the Purpose**: Enables managers to request ad-hoc stock summaries and charts without writing complex database queries.
*   **Relevant Code**: [`ai-agent/agent.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/ai-agent/agent.py) (SQL generation methods)

---

## 6. Central Sync Hub & Job Orchestration

### 🔄 Central Service Client Routing
*   **What It Does**: Exposes unified endpoints (`/api/orders/process`, `/api/sync/warehouse-to-all`) that request, gather, and pass layout, path, forecast, and slotting data across microservices.
*   **What is the Purpose**: Decouples the individual optimization engines. Simplifies connections, meaning a single API call can trigger multi-service coordinates.
*   **Relevant Code**: [`logistic-agent/app/services/service_client.py`](file:///c:/Users/User/Documents/GitHub/OptiWMS/ai_services/logistic-agent/app/services/service_client.py)
