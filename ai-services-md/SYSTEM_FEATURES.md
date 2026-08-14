# OptiWMS - System Features

This document provides a detailed catalog of the functional features, modules, and optimization capabilities implemented within **OptiWMS**.

---

## 📥 1. Inbound Operations (Supplier-to-Warehouse)

The inbound workflow is built to ensure strict tracking, safety compliance, and verification of incoming inventory.

### Purchase Order (PO) Management
* **ERP Sync**: Ingests Purchase Orders from upstream Enterprise Resource Planning (ERP) systems.
* **Line-Item Customization**: Allows managers to view, adjust, and prioritize specific PO quantities, delivery schedules, and material descriptions.
* **Supplier Constraints**: Restricts incoming shipments based on active supplier status and delivery priorities.

### Dock Door & Appointment Scheduling
* **Dock Management**: Allocates physical warehouse doors (`dock_doors` database table) to active inbound coordinate slots.
* **Appointment Calendar**: Schedules delivery windows to prevent yard congestion and minimize demurrage charges.
* **Yard Trailer Queue**: Tracks trailers parked in the yard area, their contents, status (e.g., waiting, unloading, checked-out), and assignment gates.

### Vehicle Inspection
* **Compliance Checks**: Forces coordinators to complete an operational checklist before a truck is allowed to unload.
* **Safety Logs**: Registers truck temperature (for perishables), trailer safety seals, container lock statuses, and general cleanliness.

### Blind Receiving (Operational Accuracy)
* **Expected Count Concealment**: Conceals expected quantities from receiving workers. Workers must count and scan items from scratch.
* **Discrepancy Flags**: Highlights variances between physical count and the original PO. Prompts automatic supervisor review.

### Quality Control (QC) & Inspection
* **Dimensions & Integrity Checks**: Prompts workers to verify physical SKU dimensions, damage counts, packaging status, and batch numbers.
* **Quarantine Flow**: Automatically locks materials with poor QC scores into designated quarantine zones to prevent fulfillment usage.

### Putaway Generation
* **Direct Putaway Rerouting**: Resolves and assigns putaway locations immediately upon receipt verification.
* **Task Assignment**: Dispatches tasks directly to the PWA queue of forklift/power truck operators based on physical layout coordinates.

---

## 📤 2. Outbound Operations (Warehouse-to-Customer)

The outbound module handles customer sales order staging, picking calculations, packing validation, and carrier dispatching.

### Sales Order (SO) Processing
* **Order Prioritization**: Sorts customer orders based on delivery deadlines, customer priority tiers, and product availability.
* **Backlog Allocations**: Reserves available stocks for priority orders, preventing inventory locking discrepancies.

### Optimized Picking Execution
* **AI Pathing Integration**: Generates picking lists mapped to A* coordinate vectors, grouping pickups to reduce warehouse travel time.
* **PWA Scanner Pick confirmation**: Forces workers to scan barcodes of the storage bin and the SKU before verifying a pick, preventing mixed-up orders.

### Packing & Verification
* **Weight & Dimension Checks**: Checks that final shipping package weights align with expected item mass.
* **Packing Slips & Document Compilation**: Employs backend libraries (Apache PDFBox) to assemble and format packing slips, commercial invoices, and bills of lading.

### Shipment Dispatching & Tracking
* **Delivery Partner Assignment**: Allocates shipments to registered third-party carriers based on priority, zip code rules, and rate cards.
* **Tracking Registries**: Saves tracking IDs and dispatch timestamps, updating order states to "shipped" or "delivered".

---

## 📦 3. Inventory & Facility Management

Features related to facility layout visualization, stock transfers, audits, and discrepancy resolutions.

### Dynamic Warehouse Layout Visualization
* **2D SVG Interactive Map**: Generates interactive layouts showing racks, columns, aisles, and levels directly in the browser.
* **Occupancy Scales**: Color codes locations based on space utilization (e.g., green for empty slots, red for full slots).
* **Bin Elevation View**: Renders the vertical layout of a rack (levels 1-5) when clicked, allowing managers to inspect slot occupancy.

### Velocity Heatmap Visualization
* **Picking Hotspots**: Colors warehouse sections based on picker foot traffic and search frequency.
* **Slotting Analysis**: Identifies fast-moving SKUs stored in hard-to-reach locations (upper racks) and slow-moving items taking up ground-level slots.

### Stock Transfers & Relocations
* **System-Initiated Moves**: Initiates stock transfers to free up zones, clear blocked aisles, or isolate items.
* **Worker Routing**: Dispatches relocation tasks to forklifts, routing them from source to destination slots via scan confirmations.

### Cycle Counting & Discrepancy Audits
* **Scheduled Counts**: Automates count schedules based on frequency settings (e.g., weekly, monthly, quarterly).
* **Multi-Round Recounts**: If a count variance exceeds thresholds (e.g., >5% difference), the system locks the location and triggers a blind recount task.
* **Manager Approvals**: Requires managers to review and approve adjustments before updates are written to the database.

### Returns Management
* **Customer Returns (RMA)**: Registers returns, inspects item condition, and moves items to quarantine, disposal, or back to stock.
* **Supplier Returns**: Coordinates return of damaged goods back to suppliers.

---

## 🤖 4. AI Optimization & Advisory Layer

OptiWMS includes pluggable Python advisory modules for data-driven warehouse optimization.

### Demand Forecasting
* **Multi-Model Pipeline**: Employs ML models (XGBoost, CatBoost, LightGBM, Scikit-Learn) alongside traditional baselines (SARIMA, Prophet).
* **Champion-Challenger Promotion**: Compares new models against active ones using quality gates (WAPE $\le$ 0.135, Bias $\le$ 0.10, P95 Latency $\le$ 2500ms).
* **SHAP Explainability**: Highlights key factors driving demand shifts (e.g., promotions, holidays, weather).

### Replenishment (Min-Max) Optimizer
* **Mixed-Integer Linear Programming (MILP)**: Runs optimization solvers (`mip` library) to suggest order triggers and quantities.
* **Safety Stock Safeguards**: Adjusts safety levels dynamically based on supply lead time volatility and demand predictions.

### Path Optimization Service
* **A* Grid Search Routing**: Computes paths on a coordinate grid modeling the warehouse layout.
* **Obstacle & Congestion Avoidance**: Avoids columns, walls, and temporarily blocked aisles.
* **Batch Request Support**: Optimizes multiple picking lists simultaneously.

### Genetic Slotting Suggestions
* **Evolutionary Algorithms**: Uses Genetic Algorithms (`deap` library) to suggest SKU placements based on picking frequency, size, weight, and shelf compatibility.

---

## 💬 5. AI Chatbot Assistant (Operations Copilot)

An interactive conversational assistant helping users analyze data and query warehouse operational guidelines.

### RAG SOP Query Engine
* **Semantic Search**: Searches standard operating procedures stored in a Chroma vector database.
* **Source Citations**: Returns answers cited back to the specific SOP title, category, and paragraph.

### DATA Query Agent (Text-to-SQL & Chart Generator)
* **Natural Language Queries**: Translates questions like "What are the top 5 picked items this week?" into SQL.
* **Visualization Charts**: Dynamically renders Plotly interactive charts in the chat window.
* **On-Demand PDF Reports**: Compiles query results into downloadable PDF reports.
