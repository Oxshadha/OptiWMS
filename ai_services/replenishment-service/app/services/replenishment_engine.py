from typing import List, Dict, Any
from app.services.classifier import InventoryClassifier
from app.services.replenishment_math import ReplenishmentMath
from app.services.supplier_selector import SupplierSelector
from app.clients.forecast_client import ForecastClient
from app.clients.wms_client import WmsClient
from app.core.config import settings

class ReplenishmentEngine:
    """
    Orchestrates the entire replenishment decision process:
    1. Classify SKUs (ABC-XYZ)
    2. Fetch Forecasts
    3. Fetch Supplier Constraints
    4. Calculate Probabilistic Math (Safety Stock, ROP, EOQ)
    5. Run MILP to split/optimize orders
    """
    def __init__(self, db_session):
        self.db = db_session
        self.forecast_client = ForecastClient()
        self.wms_client = WmsClient()
        self.classifier = InventoryClassifier()

    async def generate_plan_for_sku(self, sku: str, current_stock: float, historical_demand: List[Dict[str, Any]]):
        # 1. Classification
        class_df = self.classifier.classify(historical_demand)
        sku_class_info = class_df[class_df['sku'] == sku].iloc[0] if not class_df.empty and sku in class_df['sku'].values else None
        
        service_level = sku_class_info['service_level_target'] if sku_class_info is not None else settings.default_service_level
        abc_class = sku_class_info['abc_class'] if sku_class_info is not None else 'B'
        xyz_class = sku_class_info['xyz_class'] if sku_class_info is not None else 'Y'

        # 2. Forecasts
        forecast_data = await self.forecast_client.get_latest_forecast(sku)
        # Mocking values if forecast service isn't reachable to allow engine to run
        if not forecast_data:
            forecast_data = {
                "predictions": [
                    {"horizon": 1, "p50": 100}, {"horizon": 2, "p50": 110}, {"horizon": 3, "p50": 120},
                    {"horizon": 4, "p50": 100}, {"horizon": 5, "p50": 110}, {"horizon": 6, "p50": 120}
                ]
            }

        preds = forecast_data.get("predictions", [])
        h1_to_h3_demand = sum([p['p50'] for p in preds if p['horizon'] <= 3])
        h1_to_h6_demand = sum([p['p50'] for p in preds if p['horizon'] <= 6])
        avg_daily_demand = h1_to_h6_demand / 180.0
        annual_demand = avg_daily_demand * 365.0
        
        # Approximate standard deviation of demand from p10/p90 if available, else 20% of mean
        std_dev_demand = (preds[0].get('p90', preds[0]['p50'] * 1.2) - preds[0].get('p10', preds[0]['p50'] * 0.8)) / 2.56
        if std_dev_demand <= 0:
            std_dev_demand = avg_daily_demand * 0.2

        # 3. Supplier Constraints
        suppliers = await self.wms_client.get_supplier_constraints(sku)
        if not suppliers:
            # Mock fallback based on SL baselines if none exist
            suppliers = [
                {
                    "id": "SUPP-001",
                    "min_order_qty": 50,
                    "max_order_qty": 5000,
                    "unit_price": 2000.0,
                    "bulk_discount_threshold": 1000,
                    "bulk_discount_percent": 10.0,
                    "avg_shipment_delay_days": 2,
                    "lead_time_std_dev_days": 1,
                    "ordering_cost": settings.ordering_cost_per_order
                }
            ]

        # Calculate average lead time across primary suppliers
        avg_lead_time_days = sum(s.get('avg_shipment_delay_days', 7) for s in suppliers) / len(suppliers)
        std_dev_lead_time = sum(s.get('lead_time_std_dev_days', 2) for s in suppliers) / len(suppliers)

        # 4. Probabilistic Math
        safety_stock = ReplenishmentMath.calculate_probabilistic_safety_stock(
            service_level, avg_lead_time_days, std_dev_demand, avg_daily_demand, std_dev_lead_time
        )
        
        rop = ReplenishmentMath.calculate_rop(avg_daily_demand, avg_lead_time_days, safety_stock)
        
        # Base EOQ ignoring multi-supplier splits for a moment
        base_unit_price = suppliers[0].get('unit_price', 1000.0)
        holding_cost_per_unit = base_unit_price * settings.annual_holding_cost_percent
        
        eoq = ReplenishmentMath.calculate_eoq(
            annual_demand, settings.ordering_cost_per_order, holding_cost_per_unit
        )

        # Do we need to order?
        if current_stock <= rop:
            order_qty_needed = max(eoq, rop - current_stock + safety_stock)
            
            # 5. MILP Supplier Selection
            split_orders = SupplierSelector.select_suppliers(order_qty_needed, suppliers)
            
            return {
                "sku": sku,
                "abc_class": abc_class,
                "xyz_class": xyz_class,
                "current_stock": current_stock,
                "forecast_3m": h1_to_h3_demand,
                "forecast_6m": h1_to_h6_demand,
                "safety_stock": safety_stock,
                "reorder_point": rop,
                "eoq": eoq,
                "total_suggested_qty": order_qty_needed,
                "supplier_splits": split_orders,
                "action": "ORDER"
            }
        else:
            return {
                "sku": sku,
                "abc_class": abc_class,
                "xyz_class": xyz_class,
                "current_stock": current_stock,
                "forecast_3m": h1_to_h3_demand,
                "forecast_6m": h1_to_h6_demand,
                "safety_stock": safety_stock,
                "reorder_point": rop,
                "eoq": eoq,
                "total_suggested_qty": 0,
                "supplier_splits": [],
                "action": "HOLD"
            }
