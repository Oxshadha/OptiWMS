import math
import scipy.stats as stats

class ReplenishmentMath:
    
    @staticmethod
    def calculate_z_score(service_level: float) -> float:
        """
        Calculates the Z-score for a given service level using inverse CDF.
        E.g. 0.95 -> 1.645
        """
        return stats.norm.ppf(service_level)
        
    @staticmethod
    def calculate_probabilistic_safety_stock(
        service_level: float, 
        avg_lead_time: float, 
        std_dev_demand: float, 
        avg_demand: float, 
        std_dev_lead_time: float
    ) -> float:
        """
        SS = Z_score * sqrt( (AvgLT * σ^2_Demand) + (AvgDemand^2 * σ^2_LT) )
        """
        z_score = ReplenishmentMath.calculate_z_score(service_level)
        
        term1 = avg_lead_time * (std_dev_demand ** 2)
        term2 = (avg_demand ** 2) * (std_dev_lead_time ** 2)
        
        ss = z_score * math.sqrt(term1 + term2)
        return max(0.0, ss)
        
    @staticmethod
    def calculate_rop(
        avg_daily_demand: float, 
        avg_lead_time_days: float, 
        safety_stock: float
    ) -> float:
        """
        Reorder Point = (Average Daily Demand * Average Lead Time) + Safety Stock
        """
        rop = (avg_daily_demand * avg_lead_time_days) + safety_stock
        return max(0.0, rop)
        
    @staticmethod
    def calculate_eoq(
        annual_demand: float, 
        ordering_cost_per_order: float, 
        annual_holding_cost_per_unit: float
    ) -> float:
        """
        Economic Order Quantity = sqrt( 2 * D * S / H )
        """
        if annual_holding_cost_per_unit <= 0 or annual_demand <= 0:
            return 0.0
            
        eoq = math.sqrt((2 * annual_demand * ordering_cost_per_order) / annual_holding_cost_per_unit)
        return eoq
        
    @staticmethod
    def calculate_constrained_order_qty(
        eoq: float, 
        moq: float, 
        max_qty: float, 
        bulk_discount_threshold: float, 
        bulk_discount_percent: float, 
        unit_price: float,
        annual_demand: float,
        ordering_cost: float,
        holding_cost_percent: float
    ) -> float:
        """
        Adjusts the order quantity based on MOQ, Max Capacity, and Bulk Discounts.
        """
        # Base constrained qty
        suggested_qty = eoq
        
        if suggested_qty < moq:
            suggested_qty = moq
            
        if max_qty and suggested_qty > max_qty:
            suggested_qty = max_qty
            
        # Check bulk discount economics
        if bulk_discount_threshold and bulk_discount_percent > 0 and suggested_qty < bulk_discount_threshold:
            # Calculate Total Cost at suggested_qty (no discount)
            tc_current = ReplenishmentMath._total_annual_cost(
                suggested_qty, annual_demand, unit_price, ordering_cost, holding_cost_percent * unit_price
            )
            
            # Calculate Total Cost at bulk_threshold (with discount)
            discounted_price = unit_price * (1 - bulk_discount_percent / 100.0)
            tc_discount = ReplenishmentMath._total_annual_cost(
                bulk_discount_threshold, annual_demand, discounted_price, ordering_cost, holding_cost_percent * discounted_price
            )
            
            if tc_discount < tc_current:
                suggested_qty = bulk_discount_threshold
                
        # Re-apply max capacity constraint just in case discount pushed it over
        if max_qty and suggested_qty > max_qty:
            suggested_qty = max_qty
            
        return suggested_qty

    @staticmethod
    def _total_annual_cost(order_qty, annual_demand, unit_price, ordering_cost, holding_cost_per_unit):
        num_orders = annual_demand / order_qty if order_qty > 0 else 0
        annual_ordering_cost = num_orders * ordering_cost
        annual_holding_cost = (order_qty / 2.0) * holding_cost_per_unit
        annual_material_cost = annual_demand * unit_price
        return annual_ordering_cost + annual_holding_cost + annual_material_cost
