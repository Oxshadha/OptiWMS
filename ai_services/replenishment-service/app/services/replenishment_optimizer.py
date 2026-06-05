import mip
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

class SupplierConstraint(BaseModel):
    supplier_id: str
    min_order_qty: float
    max_order_qty: float
    avg_shipment_delay_days: int
    unit_price: float

class MaterialSpec(BaseModel):
    sku: str
    weight_kg: float
    volume_cm3: float
    forecast_6mo: float
    holding_cost: float

class RackConstraint(BaseModel):
    rack_id: str
    max_weight_kg: float
    max_volume_cm3: float
    current_used_volume: float
    current_used_weight: float

class OptimizationResult(BaseModel):
    status: str
    orders: List[Dict[str, Any]]
    shifts: List[Dict[str, Any]]
    alerts: List[str]

class MultiEchelonOptimizer:
    """
    Mixed-Integer Linear Programming (MILP) Solver that balances 
    Supplier MOQs, Physical Rack Space constraints, and Lead Times.
    """
    
    def __init__(self):
        # Initialize the MILP Model to maximize overall fulfillment value
        self.model = mip.Model("MultiEchelonReplenishment", sense=mip.MAXIMIZE)
        
    def optimize(
        self, 
        materials: List[MaterialSpec], 
        suppliers: Dict[str, List[SupplierConstraint]], 
        racks: List[RackConstraint]
    ) -> OptimizationResult:
        
        # Decision Variables
        # x[m, s]: Quantity of material `m` to order from supplier `s`
        x = {}
        # b[m, s]: Binary variable, 1 if we order from supplier `s` for material `m`, 0 otherwise
        b = {}
        # r_assign[m, r]: Binary variable, 1 if material `m` space is assigned to rack `r`
        r_assign = {}

        for mat in materials:
            for r in racks:
                r_assign[(mat.sku, r.rack_id)] = self.model.add_var(var_type=mip.BINARY, name=f"assign_{mat.sku}_{r.rack_id}")
                
            if mat.sku in suppliers:
                for sup in suppliers[mat.sku]:
                    x[(mat.sku, sup.supplier_id)] = self.model.add_var(var_type=mip.INTEGER, lb=0, name=f"qty_{mat.sku}_{sup.supplier_id}")
                    b[(mat.sku, sup.supplier_id)] = self.model.add_var(var_type=mip.BINARY, name=f"use_{mat.sku}_{sup.supplier_id}")
        
        # Constraints
        
        # 1. Supplier MOQ Constraints
        for mat in materials:
            if mat.sku in suppliers:
                for sup in suppliers[mat.sku]:
                    # If we choose this supplier (b=1), qty must be >= MOQ and <= Max_Qty
                    # Also if b=0, qty must be 0.
                    # x >= MOQ * b
                    self.model += x[(mat.sku, sup.supplier_id)] >= sup.min_order_qty * b[(mat.sku, sup.supplier_id)]
                    # x <= Max * b
                    self.model += x[(mat.sku, sup.supplier_id)] <= sup.max_order_qty * b[(mat.sku, sup.supplier_id)]
        
        # 2. Demand Satisfaction (Try to meet 6 month forecast)
        for mat in materials:
            if mat.sku in suppliers:
                total_ordered = mip.xsum(x[(mat.sku, sup.supplier_id)] for sup in suppliers[mat.sku])
                # We do not strictly enforce total_ordered == forecast_6mo because space might not permit it.
                # It will be driven by the objective function.
                self.model += total_ordered <= mat.forecast_6mo * 1.5 # Cap over-ordering
        
        # 3. Physical Space Constraints (The 3D Knapsack aspect)
        for r in racks:
            available_vol = r.max_volume_cm3 - r.current_used_volume
            available_weight = r.max_weight_kg - r.current_used_weight
            
            # Sum of volumes of ordered items assigned to this rack must be <= available volume
            # Volume = Qty * vol_per_unit
            # Since qty is continuous and assignment is binary, this requires linearizing (x * r_assign).
            # For a pure MILP without quadratic terms, we approximate by allocating rack capacities globally
            # or linking assignment to the total quantity.
            # Simplified global warehouse capacity constraint for the sake of the engine:
            pass 
            
        # Global Capacity Constraints
        total_available_vol = sum((r.max_volume_cm3 - r.current_used_volume) for r in racks)
        total_available_weight = sum((r.max_weight_kg - r.current_used_weight) for r in racks)
        
        total_vol_ordered = mip.xsum(
            x[(mat.sku, sup.supplier_id)] * mat.volume_cm3 
            for mat in materials if mat.sku in suppliers for sup in suppliers[mat.sku]
        )
        total_weight_ordered = mip.xsum(
            x[(mat.sku, sup.supplier_id)] * mat.weight_kg 
            for mat in materials if mat.sku in suppliers for sup in suppliers[mat.sku]
        )
        
        self.model += total_vol_ordered <= total_available_vol, "GlobalVolume"
        self.model += total_weight_ordered <= total_available_weight, "GlobalWeight"
        
        # Objective Function: Maximize fulfillment value, penalizing slow lead times
        # Reward meeting forecast, penalize holding cost and lead times.
        obj = mip.xsum(
            x[(mat.sku, sup.supplier_id)] * (100.0 - sup.avg_shipment_delay_days) - (mat.holding_cost * x[(mat.sku, sup.supplier_id)])
            for mat in materials if mat.sku in suppliers for sup in suppliers[mat.sku]
        )
        self.model.objective = mip.maximize(obj)
        
        # Solve
        status = self.model.optimize(max_seconds=60)
        
        result = OptimizationResult(
            status=status.name,
            orders=[],
            shifts=[],
            alerts=[]
        )
        
        if status == mip.OptimizationStatus.OPTIMAL or status == mip.OptimizationStatus.FEASIBLE:
            for mat in materials:
                if mat.sku in suppliers:
                    for sup in suppliers[mat.sku]:
                        qty = x[(mat.sku, sup.supplier_id)].x
                        if qty is not None and qty > 0:
                            result.orders.append({
                                "sku": mat.sku,
                                "supplier": sup.supplier_id,
                                "qty": qty
                            })
                            
            # Logic to derive shifts based on capacity shortage vs demand
            # (In a full implementation, the dual values of the constraints or a multi-pass approach 
            # determines which exact bins to shift. For now, we return the global order decisions).
        else:
            result.alerts.append("MILP Solver could not find a feasible solution. Physical constraints may be too tight for Supplier MOQs.")
            
        return result
