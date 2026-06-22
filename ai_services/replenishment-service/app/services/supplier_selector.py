from mip import Model, xsum, BINARY, CONTINUOUS, MINIMIZE
from typing import List, Dict, Any

class SupplierSelector:
    """
    Solves a Mixed Integer Linear Programming (MILP) problem to split orders 
    across multiple suppliers considering MOQs, capacities, and bulk discounts.
    """
    
    @staticmethod
    def select_suppliers(
        total_demand: float,
        suppliers: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        suppliers list of dicts:
        {
            'id': 'str',
            'min_order_qty': float,
            'max_order_qty': float,
            'unit_price': float,
            'bulk_discount_threshold': float,
            'bulk_discount_percent': float,
            'avg_shipment_delay_days': int,
            'ordering_cost': float
        }
        """
        if not suppliers or total_demand <= 0:
            return []

        model = Model("SupplierSelection")
        model.verbose = 0
        
        n = len(suppliers)
        x = [model.add_var(var_type=CONTINUOUS, lb=0) for i in range(n)]
        y = [model.add_var(var_type=BINARY) for i in range(n)]
        z = [model.add_var(var_type=BINARY) for i in range(n)]
        
        x_base = [model.add_var(var_type=CONTINUOUS, lb=0) for i in range(n)]
        x_disc = [model.add_var(var_type=CONTINUOUS, lb=0) for i in range(n)]

        # Demand satisfaction
        model += xsum(x[i] for i in range(n)) >= total_demand
        
        M = total_demand * 10
        
        for i, supp in enumerate(suppliers):
            moq = supp.get('min_order_qty', 0)
            max_qty = supp.get('max_order_qty')
            if max_qty is None or max_qty <= 0:
                max_qty = M
            
            # MOQ and Capacity constraints
            model += x[i] >= moq * y[i]
            model += x[i] <= max_qty * y[i]
            
            # Bulk discount logic
            threshold = supp.get('bulk_discount_threshold')
            if threshold and threshold > 0:
                model += x_base[i] + x_disc[i] == x[i]
                model += x_base[i] <= threshold * (1 - z[i])
                model += x_disc[i] <= max_qty * z[i]
                model += x_disc[i] >= threshold * z[i]
                model += z[i] <= y[i]
            else:
                model += x_base[i] == x[i]
                model += x_disc[i] == 0
                model += z[i] == 0

        # Objective Function
        objective_terms = []
        for i, supp in enumerate(suppliers):
            base_price = supp.get('unit_price', 0)
            disc_pct = supp.get('bulk_discount_percent', 0) / 100.0
            disc_price = base_price * (1 - disc_pct)
            
            ordering_cost = supp.get('ordering_cost', 1200.0) # SL Baseline
            # Penalty for delays to prioritize reliable suppliers
            delay_penalty = supp.get('avg_shipment_delay_days', 0) * (base_price * 0.01)
            
            objective_terms.append(
                base_price * x_base[i] + 
                disc_price * x_disc[i] + 
                ordering_cost * y[i] + 
                delay_penalty * x[i]
            )
            
        model.objective = MINIMIZE(xsum(objective_terms))
        model.optimize()
        
        results = []
        if model.num_solutions:
            for i, supp in enumerate(suppliers):
                if x[i].x > 0:
                    results.append({
                        'supplier_id': supp['id'],
                        'order_qty': round(x[i].x, 2),
                        'unit_price': supp['unit_price'] * (1 - supp['bulk_discount_percent']/100.0) if z[i].x > 0.5 else supp['unit_price'],
                        'meets_bulk_discount': bool(z[i].x > 0.5)
                    })
                    
        return results
