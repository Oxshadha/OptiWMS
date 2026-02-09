"""
Multi-Item Orders Generator
Generates realistic orders with 2-5 items each
For TSP/A* pathfinding algorithm testing
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path
import json

class MultiItemOrdersGenerator:
    def __init__(self, demand_data_path: str, classifications_path: str, output_dir: str):
        self.demand_data_path = Path(demand_data_path)
        self.classifications_path = Path(classifications_path)
        self.output_dir = Path(output_dir)
        
    def load_data(self):
        """Load demand history and classifications"""
        print("📂 Loading data...")
        
        # Load demand history
        self.demand_df = pd.read_csv(self.demand_data_path)
        print(f"  ✅ Loaded {len(self.demand_df)} demand records")
        
        # Load ABC/FMS classifications
        self.classifications_df = pd.read_csv(self.classifications_path)
        print(f"  ✅ Loaded classifications for {len(self.classifications_df)} materials")
        
        # Merge classifications with demand
        self.demand_df = self.demand_df.merge(
            self.classifications_df[['material_code', 'abc_category', 'fms_category']],
            on='material_code',
            how='left'
        )
    
    def generate_realistic_order_composition(self, category: str):
        """
        Generate realistic order item selection based on product category
        Items in same order typically come from same/related categories
        """
        # Get materials from this category and related categories
        if category == 'personal_care':
            related_categories = ['personal_care', 'cosmetics']
        elif category == 'baby_care':
            related_categories = ['baby_care', 'personal_care']
        elif category == 'household':
            related_categories = ['household', 'packaging']
        elif category == 'packaging':
            related_categories = ['packaging']
        elif category == 'raw_materials':
            related_categories = ['raw_materials']
        else:
            related_categories = [category]
        
        # Filter materials
        eligible_materials = self.demand_df[
            self.demand_df['category'].isin(related_categories)
        ]['material_code'].unique()
        
        return eligible_materials
    
    def generate_multi_item_orders(self, num_months=24):
        """Generate multi-item orders"""
        print(f"\n📦 Generating multi-item orders for {num_months} months...")
        
        order_records = []
        order_id = 1
        
        start_date = datetime(2023, 1, 1)
        
        # Generate orders every day
        for day_offset in range(num_months * 30):
            current_date = start_date + timedelta(days=day_offset)
            
            # Number of orders per day (varies by day of week and month)
            is_weekday = current_date.weekday() < 5
            month = current_date.month
            
            # Sri Lankan seasonality - more orders in April and December
            if month in [4, 12]:
                base_orders = 12  # Peak season
            elif month in [3, 11]:
                base_orders = 10  # Pre-peak
            elif month == 2:
                base_orders = 5   # Low season
            else:
                base_orders = 8   # Normal
            
            # Weekday vs weekend
            if is_weekday:
                num_orders = np.random.poisson(base_orders)
            else:
                num_orders = np.random.poisson(base_orders * 0.6)  # Lower on weekends
            
            num_orders = max(1, num_orders)  # At least 1 order per day
            
            # Generate orders for this day
            for _ in range(num_orders):
                # Pick a main category for this order
                category = np.random.choice(
                    ['personal_care', 'baby_care', 'household', 'packaging', 'raw_materials'],
                    p=[0.35, 0.15, 0.20, 0.15, 0.15]  # FMCG distribution
                )
                
                # Get eligible materials
                eligible_materials = self.generate_realistic_order_composition(category)
                
                if len(eligible_materials) == 0:
                    continue
                
                # Number of items in this order (2-5 items, weighted toward 2-3)
                num_items = np.random.choice([2, 3, 4, 5], p=[0.40, 0.35, 0.15, 0.10])
                num_items = min(num_items, len(eligible_materials))
                
                # Select materials
                selected_materials = np.random.choice(
                    eligible_materials,
                    size=num_items,
                    replace=False
                )
                
                # Create order lines
                for line_num, material_code in enumerate(selected_materials, 1):
                    # Get material info
                    material_info = self.demand_df[
                        (self.demand_df['material_code'] == material_code) &
                        (pd.to_datetime(self.demand_df['date']).dt.month == month)
                    ]
                    
                    if material_info.empty:
                        continue
                    
                    avg_demand = material_info['demand'].mean()
                    
                    # Order quantity (daily demand with some variation)
                    daily_demand = max(1, int(avg_demand / 30))
                    quantity = max(1, int(np.random.gamma(2, daily_demand)))  # Gamma distribution for realistic variation
                    
                    # Get ABC/FMS classification
                    material_class = self.classifications_df[
                        self.classifications_df['material_code'] == material_code
                    ]
                    
                    abc_cat = material_class.iloc[0]['abc_category'] if not material_class.empty else 'C'
                    fms_cat = material_class.iloc[0]['fms_category'] if not material_class.empty else 'slow'
                    
                    order_records.append({
                        'order_id': f'MO-2023-{order_id:06d}',
                        'order_date': current_date.strftime('%Y-%m-%d'),
                        'line_number': line_num,
                        'material_code': material_code,
                        'description': material_info.iloc[0]['description'],
                        'category': material_info.iloc[0]['category'],
                        'abc_category': abc_cat,
                        'fms_category': fms_cat,
                        'quantity': quantity,
                        'order_type': 'sales_order',
                        'status': 'completed',
                        'customer_id': f'CUST-{hash(f"{order_id}_{current_date}") % 100:03d}',
                        'priority': self.calculate_order_priority(abc_cat, current_date),
                    })
                
                order_id += 1
            
            if (day_offset + 1) % 100 == 0:
                print(f"  Progress: Day {day_offset + 1}/{num_months * 30}")
        
        self.orders_df = pd.DataFrame(order_records)
        print(f"  ✅ Generated {len(self.orders_df)} order lines across {order_id - 1} orders")
        
        return self.orders_df
    
    def calculate_order_priority(self, abc_category: str, order_date: datetime):
        """
        Calculate order priority (1-5, where 1 is highest)
        Based on ABC classification and date proximity
        """
        # Base priority from ABC
        if abc_category == 'A':
            base_priority = 1
        elif abc_category == 'B':
            base_priority = 2
        else:
            base_priority = 3
        
        # Increase priority for orders near holidays
        month = order_date.month
        if month in [4, 12]:  # April (NY), December (Christmas)
            base_priority = max(1, base_priority - 1)
        
        return base_priority
    
    def generate_order_summary(self):
        """Generate order-level summary"""
        print(f"\n📊 Generating order summary...")
        
        order_summary = self.orders_df.groupby('order_id').agg({
            'order_date': 'first',
            'line_number': 'count',  # Total lines
            'quantity': 'sum',        # Total quantity
            'abc_category': lambda x: ', '.join(sorted(set(x))),
            'category': lambda x: ', '.join(sorted(set(x))),
            'priority': 'min',        # Highest priority in order
            'customer_id': 'first',
            'status': 'first',
        }).reset_index()
        
        order_summary.columns = [
            'order_id', 'order_date', 'total_lines', 'total_quantity',
            'abc_categories', 'product_categories', 'priority', 'customer_id', 'status'
        ]
        
        self.order_summary_df = order_summary
        
        print(f"  ✅ Generated summary for {len(order_summary)} orders")
        print(f"  Average lines per order: {order_summary['total_lines'].mean():.2f}")
        print(f"  Average quantity per order: {order_summary['total_quantity'].mean():.1f}")
        
        return order_summary
    
    def assign_pickup_locations(self, locations_df_path):
        """
        Assign pickup locations to order lines
        For pathfinding algorithm testing
        """
        print(f"\n📍 Assigning pickup locations...")
        
        try:
            locations_df = pd.read_csv(locations_df_path)
            print(f"  ✅ Loaded {len(locations_df)} locations")
            
            # Assign locations based on ABC/FMS (high-priority items in accessible locations)
            def assign_location(row):
                # Filter locations by accessibility
                if row['abc_category'] == 'A' and row['fms_category'] == 'fast':
                    # High accessibility (8-10)
                    eligible = locations_df[locations_df['accessibility_rating'] >= 8]
                elif row['abc_category'] == 'A':
                    # Medium-high accessibility (6-10)
                    eligible = locations_df[locations_df['accessibility_rating'] >= 6]
                elif row['abc_category'] == 'B':
                    # Medium accessibility (4-8)
                    eligible = locations_df[
                        (locations_df['accessibility_rating'] >= 4) &
                        (locations_df['accessibility_rating'] <= 8)
                    ]
                else:
                    # Any accessibility
                    eligible = locations_df
                
                if len(eligible) > 0:
                    return eligible.sample(1).iloc[0]['location_code']
                else:
                    return locations_df.sample(1).iloc[0]['location_code']
            
            self.orders_df['pickup_location'] = self.orders_df.apply(assign_location, axis=1)
            print(f"  ✅ Assigned pickup locations to all order lines")
            
        except FileNotFoundError:
            print(f"  ⚠️  Location file not found, skipping location assignment")
            self.orders_df['pickup_location'] = 'ST-WH001-01-001-1-A'  # Default
    
    def save_results(self):
        """Save generated orders"""
        print(f"\n💾 Saving results...")
        
        # Save order lines
        orders_file = self.output_dir / "multi_item_orders_2023_2024.csv"
        self.orders_df.to_csv(orders_file, index=False)
        print(f"  ✅ Order lines saved to {orders_file}")
        
        # Save order summary
        if hasattr(self, 'order_summary_df'):
            summary_file = self.output_dir / "order_summary.csv"
            self.order_summary_df.to_csv(summary_file, index=False)
            print(f"  ✅ Order summary saved to {summary_file}")
        
        # Save statistics
        stats = {
            'generation_date': pd.Timestamp.now().isoformat(),
            'total_orders': len(self.orders_df['order_id'].unique()),
            'total_order_lines': len(self.orders_df),
            'avg_lines_per_order': float(self.orders_df.groupby('order_id').size().mean()),
            'date_range': {
                'start': self.orders_df['order_date'].min(),
                'end': self.orders_df['order_date'].max(),
            },
            'category_distribution': self.orders_df['category'].value_counts().to_dict(),
            'abc_distribution': self.orders_df['abc_category'].value_counts().to_dict(),
            'fms_distribution': self.orders_df['fms_category'].value_counts().to_dict(),
            'priority_distribution': self.orders_df['priority'].value_counts().to_dict(),
        }
        
        stats_file = self.output_dir / "orders_statistics.json"
        with open(stats_file, 'w') as f:
            json.dump(stats, f, indent=2)
        print(f"  ✅ Statistics saved to {stats_file}")

def main():
    import sys
    
    demand_data_path = "../synthetic_data/demand_history_2023_2024.csv"
    classifications_path = "../synthetic_data/abc_fms_amalgamated.csv"
    output_dir = "../synthetic_data"
    
    if len(sys.argv) > 1:
        demand_data_path = sys.argv[1]
    if len(sys.argv) > 2:
        classifications_path = sys.argv[2]
    if len(sys.argv) > 3:
        output_dir = sys.argv[3]
    
    print("="*60)
    print("Multi-Item Orders Generator")
    print("Realistic orders with 2-5 items for TSP/A* testing")
    print("="*60)
    print(f"Input (Demand): {demand_data_path}")
    print(f"Input (Classifications): {classifications_path}")
    print(f"Output: {output_dir}")
    print("="*60)
    
    generator = MultiItemOrdersGenerator(demand_data_path, classifications_path, output_dir)
    generator.load_data()
    generator.generate_multi_item_orders(num_months=24)
    generator.generate_order_summary()
    
    # Try to assign locations if coordinates file exists
    locations_path = Path(output_dir) / "location_coordinates.csv"
    if locations_path.exists():
        generator.assign_pickup_locations(str(locations_path))
    
    generator.save_results()
    
    print("\n✅ Multi-item orders generation complete!")
    print("\n📋 Generated files:")
    print("  - multi_item_orders_2023_2024.csv (Order lines with pickup locations)")
    print("  - order_summary.csv (Order-level summary)")
    print("  - orders_statistics.json (Statistics)")

if __name__ == "__main__":
    main()
