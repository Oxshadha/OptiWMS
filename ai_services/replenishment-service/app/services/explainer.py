from typing import Dict, Any, List

class ReplenishmentExplainer:
    """
    Generates Explainable AI (XAI) outputs for the replenishment decisions.
    Creates feature importance breakdowns (waterfall chart data) and natural language reasoning.
    """

    @staticmethod
    def explain_decision(decision_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Takes the output of the ReplenishmentEngine and explains 'Why this quantity?'
        Returns SHAP-like waterfall data and a human-readable summary.
        """
        sku = decision_data.get('sku', 'Unknown')
        action = decision_data.get('action', 'HOLD')
        qty = decision_data.get('total_suggested_qty', 0)
        
        # Base state (e.g. what we would order if we just followed simple ROP)
        rop = decision_data.get('reorder_point', 0)
        current_stock = decision_data.get('current_stock', 0)
        safety_stock = decision_data.get('safety_stock', 0)
        eoq = decision_data.get('eoq', 0)
        
        # Calculate feature contributions (SHAP-like waterfall steps)
        # We start at 0.
        waterfall_steps = []
        
        if action == "HOLD":
            explanation = f"Current stock ({current_stock}) is above the reorder point ({rop}). No action needed."
            confidence = 0.95
        else:
            # Waterfall logic:
            # 1. Base Need (ROP - Current Stock)
            base_need = max(0, rop - current_stock)
            waterfall_steps.append({"feature": "Stock Deficit", "value": base_need, "impact": "+"})
            
            # 2. Safety Stock Buffer
            waterfall_steps.append({"feature": "Safety Buffer", "value": safety_stock, "impact": "+"})
            
            # 3. Economic Order Quantity Adjustment
            eoq_diff = eoq - (base_need + safety_stock)
            if eoq_diff > 0:
                waterfall_steps.append({"feature": "EOQ Economics", "value": eoq_diff, "impact": "+"})
            
            # 4. Supplier Constraints (MOQ / Bulk Discount) - inferred by the final qty diff
            current_calc = base_need + safety_stock + max(0, eoq_diff)
            constraint_diff = qty - current_calc
            
            if constraint_diff > 0:
                waterfall_steps.append({"feature": "Supplier MOQ / Discount", "value": constraint_diff, "impact": "+"})
            elif constraint_diff < 0:
                waterfall_steps.append({"feature": "Supplier Max Capacity", "value": constraint_diff, "impact": "-"})

            explanation = (
                f"Recommendation is to order {qty} units. "
                f"This covers the stock deficit of {base_need} and maintains a safety buffer of {safety_stock:.0f}. "
            )
            if eoq_diff > 0:
                explanation += f"Quantity was increased by {eoq_diff:.0f} to meet Economic Order Quantity efficiencies. "
            if constraint_diff > 0:
                explanation += "Further adjusted to hit supplier minimums or bulk discount thresholds."

            confidence = 0.88 if decision_data.get('xyz_class') == 'Z' else 0.96

        return {
            "sku": sku,
            "action": action,
            "recommended_qty": qty,
            "confidence_score": confidence,
            "natural_language_explanation": explanation,
            "waterfall_data": waterfall_steps,
            "supplier_splits": decision_data.get('supplier_splits', [])
        }
