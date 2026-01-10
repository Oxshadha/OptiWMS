"""
Synthetic Data Generator for OptiWMS - Sri Lankan Warehouse Context
Generates realistic 24-month historical data based on actual CSV inputs
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path
import json
import sys
import os

# Import Sri Lankan seasonality patterns
from srilanka_seasonality import (
    apply_srilanka_seasonality,
    get_category_from_description,
    get_unit_type_from_description,
    get_growth_rate,
    CATEGORY_SEASONALITY
)

class SyntheticDataGenerator:
    def __init__(self, input_dir: str, output_dir: str):
        self.input_dir = Path(input_dir)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Load base data
        self.materials_df = None
        self.active_stock_df = None
        self.non_moving_df = None
        self.raw_no_pallet_df = None
        
        # Generated data
        self.demand_history = []
        self.inventory_snapshots = []
        self.stock_movements = []
        self.orders_history = []
        
    def load_data(self):
        """Load all CSV files"""
        print("📂 Loading CSV files...")
        
        # Load materials
        materials_path = self.input_dir / "Item code and descriptions.csv"
        self.materials_df = pd.read_csv(materials_path)
        # Clean up empty rows
        self.materials_df = self.materials_df[self.materials_df['Material Code'].notna()]
        self.materials_df = self.materials_df[self.materials_df['Material Code'] != '']
        print(f"  ✅ Loaded {len(self.materials_df)} materials")
        
        # Load active stock with supply plans
        active_stock_path = self.input_dir / "Active stock.csv"
        self.active_stock_df = pd.read_csv(active_stock_path)
        # The file has a header row with descriptions, use first row as column names
        self.active_stock_df.columns = self.active_stock_df.columns.str.strip()
        self.active_stock_df = self.active_stock_df[self.active_stock_df.iloc[:, 0].notna()]  # Filter by first column
        # Rename first column to Material Code
        first_col = self.active_stock_df.columns[0]
        self.active_stock_df = self.active_stock_df.rename(columns={first_col: 'Material Code'})
        print(f"  ✅ Loaded {len(self.active_stock_df)} active stock records")
        
        # Load non-moving items
        non_moving_path = self.input_dir / "Non Moving items.csv"
        self.non_moving_df = pd.read_csv(non_moving_path)
        # Rename first column to Material Code
        self.non_moving_df.columns = [col.strip() for col in self.non_moving_df.columns]
        if self.non_moving_df.columns[0] != 'Material Code':
            self.non_moving_df = self.non_moving_df.rename(columns={self.non_moving_df.columns[0]: 'Material Code'})
        print(f"  ✅ Loaded {len(self.non_moving_df)} non-moving items")
        
        # Load raw materials not on pallets
        raw_no_pallet_path = self.input_dir / "Raw matrilas not store in pallets.csv"
        self.raw_no_pallet_df = pd.read_csv(raw_no_pallet_path)
        # Rename first column to Material Code
        self.raw_no_pallet_df.columns = [col.strip() for col in self.raw_no_pallet_df.columns]
        if self.raw_no_pallet_df.columns[0] != 'Material Code':
            self.raw_no_pallet_df = self.raw_no_pallet_df.rename(columns={self.raw_no_pallet_df.columns[0]: 'Material Code'})
        print(f"  ✅ Loaded {len(self.raw_no_pallet_df)} non-pallet materials")
        
    def parse_numeric(self, value):
        """Parse numeric values with commas and spaces"""
        if pd.isna(value) or value == '-' or value == '' or value == ' -   ':
            return 0
        
        # Convert to string and clean
        value_str = str(value).strip().replace(',', '').replace(' ', '')
        
        try:
            return float(value_str)
        except:
            return 0
    
    def generate_demand_history(self, months=24):
        """Generate 24 months of demand history"""
        print(f"\n📊 Generating {months} months of demand history...")
        
        start_date = datetime(2023, 1, 1)  # Start from Jan 2023
        
        demand_records = []
        
        # Process each material
        for idx, material_row in self.materials_df.iterrows():
            material_code = material_row['Material Code']
            description = material_row['Description']
            
            # Find corresponding active stock data
            stock_data = self.active_stock_df[
                self.active_stock_df['Material Code'] == material_code
            ]
            
            if stock_data.empty:
                # No historical data, use minimal demand
                base_demand = 100  # Minimal base
                variance = 50
            else:
                stock_row = stock_data.iloc[0]
                
                # Extract supply plan data (Jul-Nov)
                supply_plan = []
                for col in ['Jul SP', 'Aug SP', 'Sep SP', 'Oct SP', 'Nov SP']:
                    if col in stock_row.index:
                        value = self.parse_numeric(stock_row[col])
                        supply_plan.append(value)
                
                # Calculate base demand and variance
                supply_plan = [v for v in supply_plan if v > 0]  # Filter zeros
                if supply_plan:
                    base_demand = np.mean(supply_plan)
                    variance = np.std(supply_plan) if len(supply_plan) > 1 else base_demand * 0.15
                else:
                    base_demand = 100
                    variance = 50
            
            # Categorize material
            category = get_category_from_description(description)
            growth_rate = get_growth_rate(category)
            
            # Check if non-moving
            is_non_moving = material_code in self.non_moving_df['Material Code'].values
            
            # Generate monthly demand
            for month_offset in range(months):
                current_date = start_date + timedelta(days=30 * month_offset)
                month = current_date.month
                year = current_date.year
                
                # Apply growth trend
                months_from_start = month_offset
                growth_factor = 1 + (growth_rate * (months_from_start / 12))
                
                # Apply seasonality
                seasonal_multiplier = apply_srilanka_seasonality(month, category, year)
                
                # Calculate demand
                if is_non_moving:
                    # Non-moving items: very low, sporadic demand
                    if np.random.random() > 0.7:  # 30% chance of demand
                        demand = int(np.random.uniform(1, base_demand * 0.1))
                    else:
                        demand = 0
                else:
                    # Normal demand calculation
                    base = base_demand * growth_factor * seasonal_multiplier
                    
                    # Add realistic noise
                    noise = np.random.normal(0, variance * 0.15)
                    demand = int(max(0, base + noise))
                
                demand_records.append({
                    'date': current_date.strftime('%Y-%m-%d'),
                    'year': year,
                    'month': month,
                    'material_code': material_code,
                    'description': description,
                    'category': category,
                    'demand': demand,
                    'seasonal_factor': seasonal_multiplier,
                    'is_non_moving': is_non_moving,
                })
            
            if (idx + 1) % 50 == 0:
                print(f"  Progress: {idx + 1}/{len(self.materials_df)} materials")
        
        self.demand_history = pd.DataFrame(demand_records)
        print(f"  ✅ Generated {len(self.demand_history)} demand records")
        
        # Save to CSV
        output_file = self.output_dir / "demand_history_2023_2024.csv"
        self.demand_history.to_csv(output_file, index=False)
        print(f"  💾 Saved to {output_file}")
        
        return self.demand_history
    
    def generate_stock_movements(self):
        """Generate stock movements based on demand"""
        print("\n📦 Generating stock movements...")
        
        movement_records = []
        
        # Group by material
        for material_code in self.demand_history['material_code'].unique():
            material_demand = self.demand_history[
                self.demand_history['material_code'] == material_code
            ].sort_values('date')
            
            # Get material details
            material_info = self.materials_df[
                self.materials_df['Material Code'] == material_code
            ]
            if material_info.empty:
                continue
            
            description = material_info.iloc[0]['Description']
            
            # Get stock parameters
            stock_data = self.active_stock_df[
                self.active_stock_df['Material Code'] == material_code
            ]
            
            if not stock_data.empty:
                stock_row = stock_data.iloc[0]
                buffer_days = self.parse_numeric(stock_row.get('Buffer days', 30))
                lead_time = self.parse_numeric(stock_row.get('lead time', 30))
                moq = self.parse_numeric(stock_row.get('MOQ', 1000))
            else:
                buffer_days = 30
                lead_time = 30
                moq = 1000
            
            # Simulate inventory management
            current_stock = moq * 2  # Start with 2x MOQ
            
            for _, demand_row in material_demand.iterrows():
                date = demand_row['date']
                demand = demand_row['demand']
                
                # Check if reorder needed (ROP logic)
                days_of_supply = current_stock / (demand + 1)  # Avoid division by zero
                
                if days_of_supply < buffer_days:
                    # Place order (receipt will arrive after lead time)
                    order_qty = max(moq, demand * (buffer_days + lead_time))
                    
                    receipt_date = (
                        pd.to_datetime(date) + timedelta(days=lead_time)
                    ).strftime('%Y-%m-%d')
                    
                    movement_records.append({
                        'date': receipt_date,
                        'material_code': material_code,
                        'description': description,
                        'movement_type': 'receipt',
                        'quantity': int(order_qty),
                        'reference_type': 'purchase_order',
                        'stock_after': int(current_stock + order_qty),
                    })
                    
                    current_stock += order_qty
                
                # Issue stock for demand
                if demand > 0:
                    issue_qty = min(demand, current_stock)
                    
                    movement_records.append({
                        'date': date,
                        'material_code': material_code,
                        'description': description,
                        'movement_type': 'issue',
                        'quantity': int(issue_qty),
                        'reference_type': 'sales_order',
                        'stock_after': int(current_stock - issue_qty),
                    })
                    
                    current_stock -= issue_qty
                
                # Random adjustments (cycle counts, corrections) - 1% chance
                if np.random.random() < 0.01:
                    adjustment = int(np.random.normal(0, current_stock * 0.02))
                    
                    movement_records.append({
                        'date': date,
                        'material_code': material_code,
                        'description': description,
                        'movement_type': 'adjustment',
                        'quantity': adjustment,
                        'reference_type': 'cycle_count',
                        'stock_after': int(current_stock + adjustment),
                    })
                    
                    current_stock += adjustment
                
                # Ensure non-negative stock
                current_stock = max(0, current_stock)
        
        self.stock_movements = pd.DataFrame(movement_records)
        print(f"  ✅ Generated {len(self.stock_movements)} stock movements")
        
        # Save to CSV
        output_file = self.output_dir / "stock_movements_2023_2024.csv"
        self.stock_movements.to_csv(output_file, index=False)
        print(f"  💾 Saved to {output_file}")
        
        return self.stock_movements
    
    def generate_inventory_snapshots(self):
        """Generate monthly inventory snapshots"""
        print("\n📸 Generating inventory snapshots...")
        
        snapshot_records = []
        
        # Group movements by date and material
        for material_code in self.stock_movements['material_code'].unique():
            material_movements = self.stock_movements[
                self.stock_movements['material_code'] == material_code
            ].sort_values('date')
            
            # Get last movement of each month
            material_movements['year_month'] = pd.to_datetime(
                material_movements['date']
            ).dt.to_period('M')
            
            monthly_last = material_movements.groupby('year_month').last()
            
            for period, row in monthly_last.iterrows():
                snapshot_records.append({
                    'date': row['date'],
                    'year_month': str(period),
                    'material_code': material_code,
                    'description': row['description'],
                    'stock_level': row['stock_after'],
                    'warehouse_id': 'WH-001',  # Default warehouse
                    'location_code': 'ST-WH001-01-001-1-A',  # Default location
                })
        
        self.inventory_snapshots = pd.DataFrame(snapshot_records)
        print(f"  ✅ Generated {len(self.inventory_snapshots)} inventory snapshots")
        
        # Save to CSV
        output_file = self.output_dir / "inventory_snapshots_2023_2024.csv"
        self.inventory_snapshots.to_csv(output_file, index=False)
        print(f"  💾 Saved to {output_file}")
        
        return self.inventory_snapshots
    
    def generate_orders_history(self):
        """Generate order history (POs and SOs)"""
        print("\n📋 Generating orders history...")
        
        order_records = []
        order_id = 1
        
        # Generate from receipts (Purchase Orders)
        receipts = self.stock_movements[
            self.stock_movements['movement_type'] == 'receipt'
        ].copy()
        
        for _, receipt in receipts.iterrows():
            order_records.append({
                'order_id': f'PO-2023-{order_id:05d}',
                'order_type': 'inbound',
                'order_date': receipt['date'],
                'material_code': receipt['material_code'],
                'description': receipt['description'],
                'quantity': receipt['quantity'],
                'status': 'completed',
                'supplier_id': f'SUP-{hash(receipt["material_code"]) % 100:03d}',
            })
            order_id += 1
        
        # Generate from issues (Sales Orders)
        issues = self.stock_movements[
            self.stock_movements['movement_type'] == 'issue'
        ].copy()
        
        # Group issues into orders (combine small issues)
        issues['date'] = pd.to_datetime(issues['date'])
        issues['week'] = issues['date'].dt.isocalendar().week
        
        for (material, week), group in issues.groupby(['material_code', 'week']):
            total_qty = group['quantity'].sum()
            if total_qty > 0:
                order_records.append({
                    'order_id': f'SO-2023-{order_id:05d}',
                    'order_type': 'outbound',
                    'order_date': group['date'].min().strftime('%Y-%m-%d'),
                    'material_code': material,
                    'description': group['description'].iloc[0],
                    'quantity': int(total_qty),
                    'status': 'completed',
                    'customer_id': f'CUST-{hash(material) % 50:03d}',
                })
                order_id += 1
        
        self.orders_history = pd.DataFrame(order_records)
        print(f"  ✅ Generated {len(self.orders_history)} orders")
        
        # Save to CSV
        output_file = self.output_dir / "orders_history_2023_2024.csv"
        self.orders_history.to_csv(output_file, index=False)
        print(f"  💾 Saved to {output_file}")
        
        return self.orders_history
    
    def generate_summary_statistics(self):
        """Generate summary statistics report"""
        print("\n📊 Generating summary statistics...")
        
        stats = {
            'generation_date': datetime.now().isoformat(),
            'period': '2023-01-01 to 2024-12-31',
            'total_materials': len(self.materials_df),
            'total_demand_records': len(self.demand_history),
            'total_stock_movements': len(self.stock_movements),
            'total_inventory_snapshots': len(self.inventory_snapshots),
            'total_orders': len(self.orders_history),
            'demand_by_category': self.demand_history.groupby('category')['demand'].sum().to_dict(),
            'movements_by_type': self.stock_movements.groupby('movement_type')['quantity'].sum().to_dict(),
            'orders_by_type': self.orders_history.groupby('order_type')['quantity'].sum().to_dict(),
        }
        
        # Save statistics
        stats_file = self.output_dir / "generation_summary.json"
        with open(stats_file, 'w') as f:
            json.dump(stats, f, indent=2)
        
        print(f"  ✅ Saved summary to {stats_file}")
        
        # Print summary
        print("\n" + "="*60)
        print("SYNTHETIC DATA GENERATION SUMMARY")
        print("="*60)
        print(f"Period: {stats['period']}")
        print(f"Total Materials: {stats['total_materials']:,}")
        print(f"Total Demand Records: {stats['total_demand_records']:,}")
        print(f"Total Stock Movements: {stats['total_stock_movements']:,}")
        print(f"Total Inventory Snapshots: {stats['total_inventory_snapshots']:,}")
        print(f"Total Orders: {stats['total_orders']:,}")
        print("\nDemand by Category:")
        for category, demand in stats['demand_by_category'].items():
            print(f"  {category}: {demand:,}")
        print("="*60)
        
        return stats

def main():
    # Configuration
    input_dir = "../../frontend/Database Documents"
    output_dir = "../synthetic_data"
    
    # Allow command line overrides
    if len(sys.argv) > 1:
        input_dir = sys.argv[1]
    if len(sys.argv) > 2:
        output_dir = sys.argv[2]
    
    print("="*60)
    print("OptiWMS Synthetic Data Generator")
    print("Sri Lankan Warehouse Context")
    print("="*60)
    print(f"Input Directory: {input_dir}")
    print(f"Output Directory: {output_dir}")
    print("="*60)
    
    # Initialize generator
    generator = SyntheticDataGenerator(input_dir, output_dir)
    
    try:
        # Load data
        generator.load_data()
        
        # Generate synthetic data
        generator.generate_demand_history(months=24)
        generator.generate_stock_movements()
        generator.generate_inventory_snapshots()
        generator.generate_orders_history()
        
        # Generate summary
        generator.generate_summary_statistics()
        
        print("\n✅ Synthetic data generation completed successfully!")
        print(f"📁 Output files saved to: {output_dir}")
        
    except Exception as e:
        print(f"\n❌ Error during generation: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
