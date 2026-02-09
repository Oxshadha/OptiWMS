"""
Data Validator for Synthetic Data
Ensures generated data meets quality standards
"""

import pandas as pd
import numpy as np
from pathlib import Path
import json
from datetime import datetime

class DataValidator:
    def __init__(self, data_dir: str):
        self.data_dir = Path(data_dir)
        self.validation_results = {
            'timestamp': datetime.now().isoformat(),
            'checks': {},
            'warnings': [],
            'errors': [],
            'passed': True
        }
    
    def validate_demand_history(self, df: pd.DataFrame):
        """Validate demand history data"""
        print("\n🔍 Validating demand history...")
        checks = {}
        
        # Check 1: No negative demand
        negative_count = (df['demand'] < 0).sum()
        checks['no_negative_demand'] = negative_count == 0
        if negative_count > 0:
            self.validation_results['errors'].append(
                f"Found {negative_count} negative demand values"
            )
        
        # Check 2: Reasonable demand values (not too high)
        max_demand = df['demand'].max()
        checks['reasonable_max_demand'] = max_demand < 10_000_000
        if max_demand >= 10_000_000:
            self.validation_results['warnings'].append(
                f"Very high demand value detected: {max_demand}"
            )
        
        # Check 3: Seasonality present
        monthly_avg = df.groupby('month')['demand'].mean()
        checks['has_seasonality'] = monthly_avg.std() > 0
        
        # Check 4: Date range correct
        min_date = pd.to_datetime(df['date']).min()
        max_date = pd.to_datetime(df['date']).max()
        date_range_days = (max_date - min_date).days
        checks['correct_date_range'] = 600 <= date_range_days <= 800  # ~24 months
        
        # Check 5: No missing materials
        unique_materials = df['material_code'].nunique()
        checks['all_materials_present'] = unique_materials > 200
        
        # Check 6: Categories assigned
        checks['categories_assigned'] = df['category'].notna().all()
        
        print(f"  ✅ No negative demand: {checks['no_negative_demand']}")
        print(f"  ✅ Reasonable max demand: {checks['reasonable_max_demand']}")
        print(f"  ✅ Has seasonality: {checks['has_seasonality']}")
        print(f"  ✅ Correct date range: {checks['correct_date_range']}")
        print(f"  ✅ All materials present: {checks['all_materials_present']}")
        print(f"  ✅ Categories assigned: {checks['categories_assigned']}")
        
        self.validation_results['checks']['demand_history'] = checks
        
        return all(checks.values())
    
    def validate_stock_movements(self, df: pd.DataFrame):
        """Validate stock movements data"""
        print("\n🔍 Validating stock movements...")
        checks = {}
        
        # Check 1: All movement types valid
        valid_types = ['receipt', 'issue', 'adjustment', 'transfer']
        checks['valid_movement_types'] = df['movement_type'].isin(valid_types).all()
        
        # Check 2: No extreme quantities
        extreme_count = (df['quantity'].abs() > 1_000_000).sum()
        checks['no_extreme_quantities'] = extreme_count == 0
        if extreme_count > 0:
            self.validation_results['warnings'].append(
                f"Found {extreme_count} extreme quantity values"
            )
        
        # Check 3: Stock levels reasonable
        if 'stock_after' in df.columns:
            negative_stock_count = (df['stock_after'] < 0).sum()
            checks['no_negative_stock'] = negative_stock_count == 0
            if negative_stock_count > 0:
                self.validation_results['errors'].append(
                    f"Found {negative_stock_count} negative stock levels"
                )
        
        # Check 4: Receipts and issues present
        movement_types = df['movement_type'].unique()
        checks['has_receipts'] = 'receipt' in movement_types
        checks['has_issues'] = 'issue' in movement_types
        
        print(f"  ✅ Valid movement types: {checks['valid_movement_types']}")
        print(f"  ✅ No extreme quantities: {checks['no_extreme_quantities']}")
        if 'no_negative_stock' in checks:
            print(f"  ✅ No negative stock: {checks['no_negative_stock']}")
        print(f"  ✅ Has receipts: {checks['has_receipts']}")
        print(f"  ✅ Has issues: {checks['has_issues']}")
        
        self.validation_results['checks']['stock_movements'] = checks
        
        return all(checks.values())
    
    def validate_inventory_snapshots(self, df: pd.DataFrame):
        """Validate inventory snapshots"""
        print("\n🔍 Validating inventory snapshots...")
        checks = {}
        
        # Check 1: Monthly snapshots exist
        unique_months = df['year_month'].nunique()
        checks['monthly_snapshots'] = unique_months >= 20  # At least 20 months
        
        # Check 2: No negative stock
        negative_count = (df['stock_level'] < 0).sum()
        checks['no_negative_stock'] = negative_count == 0
        
        # Check 3: Warehouse and location assigned
        checks['has_warehouse'] = df['warehouse_id'].notna().all()
        checks['has_location'] = df['location_code'].notna().all()
        
        print(f"  ✅ Monthly snapshots: {checks['monthly_snapshots']} ({unique_months} months)")
        print(f"  ✅ No negative stock: {checks['no_negative_stock']}")
        print(f"  ✅ Has warehouse: {checks['has_warehouse']}")
        print(f"  ✅ Has location: {checks['has_location']}")
        
        self.validation_results['checks']['inventory_snapshots'] = checks
        
        return all(checks.values())
    
    def validate_orders(self, df: pd.DataFrame):
        """Validate orders history"""
        print("\n🔍 Validating orders...")
        checks = {}
        
        # Check 1: Order types valid
        valid_types = ['inbound', 'outbound']
        checks['valid_order_types'] = df['order_type'].isin(valid_types).all()
        
        # Check 2: Has both inbound and outbound
        order_types = df['order_type'].unique()
        checks['has_inbound'] = 'inbound' in order_types
        checks['has_outbound'] = 'outbound' in order_types
        
        # Check 3: No negative quantities
        negative_count = (df['quantity'] < 0).sum()
        checks['no_negative_quantities'] = negative_count == 0
        
        # Check 4: Order IDs unique
        checks['unique_order_ids'] = df['order_id'].nunique() == len(df)
        
        print(f"  ✅ Valid order types: {checks['valid_order_types']}")
        print(f"  ✅ Has inbound: {checks['has_inbound']}")
        print(f"  ✅ Has outbound: {checks['has_outbound']}")
        print(f"  ✅ No negative quantities: {checks['no_negative_quantities']}")
        print(f"  ✅ Unique order IDs: {checks['unique_order_ids']}")
        
        self.validation_results['checks']['orders'] = checks
        
        return all(checks.values())
    
    def check_data_quality(self, demand_df: pd.DataFrame):
        """Check overall data quality metrics"""
        print("\n📊 Checking data quality metrics...")
        
        # Seasonality analysis
        monthly_demand = demand_df.groupby('month')['demand'].sum()
        peak_month = monthly_demand.idxmax()
        low_month = monthly_demand.idxmin()
        seasonality_ratio = monthly_demand.max() / (monthly_demand.min() + 1)
        
        print(f"  Peak month: {peak_month} (April expected for Sri Lankan NY)")
        print(f"  Low month: {low_month} (February expected)")
        print(f"  Seasonality ratio: {seasonality_ratio:.2f}x")
        
        # Check if April and December are peaks (Sri Lankan context)
        april_rank = monthly_demand.rank(ascending=False)[4]  # April is month 4
        december_rank = monthly_demand.rank(ascending=False)[12]  # December is month 12
        
        if april_rank <= 2:
            print("  ✅ April is a peak month (Sri Lankan New Year)")
        else:
            self.validation_results['warnings'].append(
                "April is not a peak month - expected for Sri Lankan New Year"
            )
        
        if december_rank <= 2:
            print("  ✅ December is a peak month (Christmas)")
        else:
            self.validation_results['warnings'].append(
                "December is not a peak month - expected for Christmas"
            )
        
        # Variance check
        category_variance = demand_df.groupby('category')['demand'].std()
        print(f"\n  Demand variance by category:")
        for category, variance in category_variance.items():
            print(f"    {category}: {variance:.2f}")
        
        # Growth trend check
        demand_df['date_parsed'] = pd.to_datetime(demand_df['date'])
        demand_df['month_num'] = (
            (demand_df['date_parsed'].dt.year - 2023) * 12 + 
            demand_df['date_parsed'].dt.month
        )
        monthly_total = demand_df.groupby('month_num')['demand'].sum()
        
        if len(monthly_total) > 1:
            # Simple linear regression for trend
            x = monthly_total.index.values
            y = monthly_total.values
            trend = np.polyfit(x, y, 1)[0]
            
            if trend > 0:
                print(f"  ✅ Positive growth trend detected: {trend:.2f} per month")
            else:
                self.validation_results['warnings'].append(
                    "No positive growth trend detected"
                )
    
    def validate_all(self):
        """Run all validations"""
        print("="*60)
        print("DATA VALIDATION")
        print("="*60)
        
        try:
            # Load generated data
            demand_df = pd.read_csv(self.data_dir / "demand_history_2023_2024.csv")
            movements_df = pd.read_csv(self.data_dir / "stock_movements_2023_2024.csv")
            snapshots_df = pd.read_csv(self.data_dir / "inventory_snapshots_2023_2024.csv")
            orders_df = pd.read_csv(self.data_dir / "orders_history_2023_2024.csv")
            
            # Run validations
            demand_valid = self.validate_demand_history(demand_df)
            movements_valid = self.validate_stock_movements(movements_df)
            snapshots_valid = self.validate_inventory_snapshots(snapshots_df)
            orders_valid = self.validate_orders(orders_df)
            
            # Quality checks
            self.check_data_quality(demand_df)
            
            # Overall result
            all_valid = demand_valid and movements_valid and snapshots_valid and orders_valid
            self.validation_results['passed'] = all_valid
            
            # Save results (convert numpy bool to python bool)
            def convert_bool(obj):
                if isinstance(obj, dict):
                    return {k: convert_bool(v) for k, v in obj.items()}
                elif isinstance(obj, list):
                    return [convert_bool(v) for v in obj]
                elif hasattr(obj, 'item'):  # numpy bool
                    return obj.item()
                return obj
            
            results_file = self.data_dir / "validation_results.json"
            with open(results_file, 'w') as f:
                json.dump(convert_bool(self.validation_results), f, indent=2)
            
            print("\n" + "="*60)
            if all_valid:
                print("✅ ALL VALIDATIONS PASSED")
            else:
                print("⚠️  SOME VALIDATIONS FAILED")
            
            if self.validation_results['warnings']:
                print(f"\n⚠️  {len(self.validation_results['warnings'])} Warnings:")
                for warning in self.validation_results['warnings']:
                    print(f"  - {warning}")
            
            if self.validation_results['errors']:
                print(f"\n❌ {len(self.validation_results['errors'])} Errors:")
                for error in self.validation_results['errors']:
                    print(f"  - {error}")
            
            print(f"\n📁 Validation results saved to: {results_file}")
            print("="*60)
            
            return all_valid
            
        except Exception as e:
            print(f"\n❌ Validation failed with error: {e}")
            import traceback
            traceback.print_exc()
            return False

def main():
    import sys
    
    data_dir = "../synthetic_data"
    if len(sys.argv) > 1:
        data_dir = sys.argv[1]
    
    validator = DataValidator(data_dir)
    success = validator.validate_all()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
