# OptiWMS Replenishment MILP Optimization Engine

## 1. System Overview
The **OptiWMS Replenishment Service** relies on a massive **Mixed-Integer Linear Programming (MILP)** mathematical model to calculate the exact PO quantities and space reallocations required for cyclical procurement (3 to 6 months).

Unlike traditional Warehouse Management Systems that use simple "Min/Max" thresholds, our system views the entire warehouse capacity, supplier master data, and forecast velocity as one interconnected mathematical equation. 

This engine acts as the "Brain" bridging the `forecast-service` (predicting demand) and the `slotting-service` GA (managing physical layout).

---

## 2. Core Constraints Evaluated

To ensure 100% realistic real-world application, the MILP Engine mathematically enforces the following strict constraints before recommending *any* action to a warehouse manager:

1. **Supplier Master Constraints**: Minimum Order Quantities (MOQ), Max Order Quantities, Average Lead Times (Days), and Bulk Discount Thresholds.
2. **Material Physical Constraints**: Item Length, Width, Height, Weight, and Volume per unit.
3. **Rack/Zone Capacity Constraints**: Maximum Weight limit (`maxWeightKg`) and Maximum Volume limit (`maxVolumeCm3`) per physical location.
4. **Demand Fulfillment Objective**: A mathematical drive to reach a 100% fill rate for the next 6 months, weighted by the revenue-at-risk.

---

## 3. Real-World Conflict Scenarios Solved by MILP

The true power of the MILP algorithm is its ability to organically resolve edge-case conflicts that would confuse a standard Genetic Algorithm or a human manager.

### Scenario A: The "Heavy vs Bulky" Conflict (3D Knapsack)
*   **The Conflict**: The warehouse orders pallets of Industrial Steel (tiny volume, massive weight) and Packaging Foam (massive volume, tiny weight). A naive algorithm would fill the steel rack until the volume is full, causing the physical rack to break under the weight constraint.
*   **How MILP Tackles It**: The engine enforces a simultaneous 3D Knapsack check. It will automatically suggest pairing heavy/small items with light/bulky items in the same warehouse zones to perfectly maximize **both** the weight and volume limits without ever exceeding physical rack safety limits.

### Scenario B: The "Bulk Discount Trap"
*   **The Conflict**: A supplier offers a massive 25% discount if the warehouse orders 10,000 units. The 6-month forecast only requires 2,000 units. The warehouse currently has empty space. Human managers often get greedy and take the discount.
*   **How MILP Tackles It**: The engine calculates total lifecycle cost. The objective function calculates `(Savings from Bulk Discount) MINUS (Holding Cost per month * Time to sell)`. If holding 8,000 excess units for 2 years ties up capital and wipes out the discount margin, the MILP rejects the bulk discount and enforces the smaller 2,000 unit order.

### Scenario C: Space Cannibalization & Opportunity Cost
*   **The Conflict**: A medium-velocity item has a massive MOQ requirement. To fit the MOQ in the warehouse, the system has to steal space ("Compress") from the absolute best-selling, highest-revenue item in the warehouse.
*   **How MILP Tackles It**: The math calculates "Opportunity Cost" (Shadow Prices). It realizes that compressing the fast-mover puts 5 Million LKR of revenue at risk due to potential stockouts, while the penalty for not ordering the medium item is only 100k LKR. The AI outputs an alert to the manager: *"Reject the medium item PO. Let it stock out. Keep the space for the fast-mover."*

### Scenario D: The Supplier Lead-Time Prioritization
*   **The Conflict**: The warehouse only has 10m³ of space remaining. Item 1 and Item 2 both need the space. Item 1's supplier takes 3 months to deliver. Item 2's supplier takes 1 week to deliver.
*   **How MILP Tackles It**: The objective function mathematically penalizes choices that utilize slow suppliers. The engine forces Item 1 to take the 10m³ of space immediately because its supply chain is risky. It tells the manager to order Item 2 later, knowing the fast supplier can rescue the inventory quickly.

---

## 4. Technical Implementation Details

### Stack & Dependencies
*   **Language**: Python 3.10+
*   **Framework**: FastAPI (Microservice integration)
*   **Solver Library**: `mip` (Python-MIP: Mixed-Integer Linear Programming)
*   **Location**: `ai_services/replenishment-service/app/services/replenishment_optimizer.py`

### Interaction with Java Backend
The engine relies on three major entities synchronized from the Java `core-domain`:
1. `SupplierConstraintEntity.java` (Provides MOQs and Lead Times)
2. `MaterialEntity.java` (Provides Dimensions, Weights, and Shelf-Life)
3. `LocationEntity.java` (Provides Rack `max_weight_kg` and `max_volume_cm3`)

### Execution Flow
1. The **React UI** requests a Cyclical Review (e.g., 6 Months).
2. The `replenishment-service` fetches the Forecast from the `forecast-service`.
3. The `replenishment_optimizer.py` executes the `mip.Model(sense=mip.MAXIMIZE)`.
4. The solver runs for 60 seconds (Time Limit) to find the optimal assignment matrix.
5. The output is mapped into the `OptimizationResult` schema, generating the "Expand/Compress" JSON blocks displayed in the UI's Head-to-Head review panels.
