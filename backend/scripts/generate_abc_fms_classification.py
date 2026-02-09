"""
ABC/FMS Classification Generator
Implements Pareto analysis and movement frequency classification
Based on Training Report methodology (Pages 25-28)
"""

import pandas as pd
import numpy as np
from pathlib import Path
import json

class ABCFMSClassifier:
    def __init__(self, demand_data_path: str, output_dir: str):
        self.demand_data_path = Path(demand_data_path)
        self.output_dir = Path(output_dir)
        
    def load_demand_data(self):
        """Load demand history"""
        print("📂 Loading demand history...")
        self.demand_df = pd.read_csv(self.demand_data_path)
        print(f"  ✅ Loaded {len(self.demand_df)} demand records")
        print(f"  📦 Unique materials: {self.demand_df['material_code'].nunique()}")
    
    def calculate_abc_classification(self):
        """
        ABC Classification using Pareto 80-20 rule
        A items: Top 80% of total demand
        B items: Next 15% of total demand  
        C items: Remaining 5% of total demand
        """
        print("\n📊 Calculating ABC classification (Pareto analysis)...")
        
        # Calculate total demand per material
        material_demand = self.demand_df.groupby('material_code').agg({
            'demand': 'sum',
            'description': 'first'
        }).reset_index()
        
        # Sort by demand (descending)
        material_demand = material_demand.sort_values('demand', ascending=False)
        
        # Calculate cumulative percentage
        material_demand['cumulative_demand'] = material_demand['demand'].cumsum()
        total_demand = material_demand['demand'].sum()
        material_demand['cumulative_pct'] = (material_demand['cumulative_demand'] / total_demand) * 100
        
        # Assign ABC category
        def assign_abc(cum_pct):
            if cum_pct <= 80:
                return 'A'
            elif cum_pct <= 95:
                return 'B'
            else:
                return 'C'
        
        material_demand['abc_category'] = material_demand['cumulative_pct'].apply(assign_abc)
        
        # Calculate contribution percentage
        material_demand['demand_contribution_pct'] = (material_demand['demand'] / total_demand) * 100
        
        self.abc_df = material_demand[['material_code', 'description', 'demand', 
                                        'cumulative_pct', 'demand_contribution_pct', 'abc_category']]
        
        # Print summary
        abc_summary = self.abc_df['abc_category'].value_counts().sort_index()
        print(f"  ABC Distribution:")
        for category, count in abc_summary.items():
            pct = (count / len(self.abc_df)) * 100
            total_demand_pct = self.abc_df[self.abc_df['abc_category'] == category]['demand_contribution_pct'].sum()
            print(f"    {category}: {count} materials ({pct:.1f}%) - {total_demand_pct:.1f}% of total demand")
        
        return self.abc_df
    
    def calculate_fms_classification(self):
        """
        FMS (Fast/Medium/Slow) Classification based on movement frequency
        Fast: High frequency movements (>= 1.5x average)
        Medium: Average frequency movements (0.5x to 1.5x average)
        Slow: Low frequency movements (< 0.5x average)
        """
        print("\n🔄 Calculating FMS classification (movement frequency)...")
        
        # Calculate movement frequency (number of transactions)
        movement_freq = self.demand_df.groupby('material_code').agg({
            'demand': ['count', 'sum', 'mean', 'std']
        }).reset_index()
        
        movement_freq.columns = ['material_code', 'movement_count', 'total_demand', 'avg_demand', 'std_demand']
        
        # Calculate average movement frequency
        avg_movement_count = movement_freq['movement_count'].mean()
        
        # Assign FMS category
        def assign_fms(count, avg):
            if count >= avg * 1.5:
                return 'fast'
            elif count >= avg * 0.5:
                return 'medium'
            else:
                return 'slow'
        
        movement_freq['fms_category'] = movement_freq.apply(
            lambda row: assign_fms(row['movement_count'], avg_movement_count), axis=1
        )
        
        # Calculate velocity score (movements per month)
        total_months = 24  # Our data spans 24 months
        movement_freq['velocity_score'] = movement_freq['movement_count'] / total_months
        
        self.fms_df = movement_freq[['material_code', 'movement_count', 'total_demand', 
                                      'velocity_score', 'fms_category']]
        
        # Print summary
        fms_summary = self.fms_df['fms_category'].value_counts()
        print(f"  FMS Distribution:")
        for category in ['fast', 'medium', 'slow']:
            if category in fms_summary.index:
                count = fms_summary[category]
                pct = (count / len(self.fms_df)) * 100
                avg_velocity = self.fms_df[self.fms_df['fms_category'] == category]['velocity_score'].mean()
                print(f"    {category.capitalize()}: {count} materials ({pct:.1f}%) - Avg velocity: {avg_velocity:.2f} moves/month")
        
        return self.fms_df
    
    def generate_amalgamated_analysis(self):
        """
        Amalgamated Analysis: Combine ABC + FMS
        Creates strategic storage zones based on both classifications
        """
        print("\n🔗 Generating amalgamated analysis (ABC + FMS)...")
        
        # Merge ABC and FMS classifications
        self.amalgamated_df = self.abc_df.merge(
            self.fms_df[['material_code', 'fms_category', 'velocity_score', 'movement_count']],
            on='material_code'
        )
        
        # Create combined classification
        def create_combined_class(row):
            return f"{row['abc_category']}-{row['fms_category'].capitalize()}"
        
        self.amalgamated_df['combined_classification'] = self.amalgamated_df.apply(
            create_combined_class, axis=1
        )
        
        # Assign storage zone priority (1 = highest priority, 9 = lowest)
        zone_priority = {
            'A-Fast': 1,      # Golden zone - most accessible
            'A-Medium': 2,
            'B-Fast': 3,
            'A-Slow': 4,
            'B-Medium': 5,
            'C-Fast': 6,
            'B-Slow': 7,
            'C-Medium': 8,
            'C-Slow': 9,      # Least accessible
        }
        
        self.amalgamated_df['storage_priority'] = self.amalgamated_df['combined_classification'].map(zone_priority)
        
        # Assign recommended storage zones
        def recommend_zone(priority):
            if priority <= 2:
                return 'Zone A (High Accessibility - Front/Ground)'
            elif priority <= 4:
                return 'Zone B (Medium Accessibility - Middle)'
            elif priority <= 6:
                return 'Zone C (Medium-Low Accessibility)'
            else:
                return 'Zone D (Low Accessibility - Back/Upper)'
        
        self.amalgamated_df['recommended_zone'] = self.amalgamated_df['storage_priority'].apply(recommend_zone)
        
        # Print summary
        print(f"  Combined Classifications:")
        combined_summary = self.amalgamated_df['combined_classification'].value_counts().sort_values(ascending=False)
        for classification, count in combined_summary.head(10).items():
            pct = (count / len(self.amalgamated_df)) * 100
            print(f"    {classification}: {count} materials ({pct:.1f}%)")
        
        print(f"\n  Storage Zone Distribution:")
        zone_summary = self.amalgamated_df['recommended_zone'].value_counts()
        for zone, count in zone_summary.items():
            pct = (count / len(self.amalgamated_df)) * 100
            print(f"    {zone}: {count} materials ({pct:.1f}%)")
        
        return self.amalgamated_df
    
    def calculate_accessibility_requirements(self):
        """
        Calculate accessibility requirements for each material
        Used for GA optimization
        """
        print("\n🎯 Calculating accessibility requirements...")
        
        # Accessibility score (1-10, where 10 = most accessible)
        def calculate_accessibility_score(row):
            # Base score from storage priority (inverse)
            base_score = 10 - row['storage_priority']
            
            # Adjust for velocity
            velocity_factor = min(row['velocity_score'] / 2, 3)  # Max +3 points
            
            # Adjust for demand contribution
            demand_factor = min(row['demand_contribution_pct'] / 5, 2)  # Max +2 points
            
            total_score = base_score + velocity_factor + demand_factor
            return min(10, max(1, round(total_score, 1)))  # Clamp to 1-10
        
        self.amalgamated_df['required_accessibility'] = self.amalgamated_df.apply(
            calculate_accessibility_score, axis=1
        )
        
        # Calculate preferred level (floor level for heavy/high-volume items)
        def calculate_preferred_level(row):
            # A-Fast and high demand → ground level
            if row['abc_category'] == 'A' and row['fms_category'] == 'fast':
                return 1
            elif row['abc_category'] == 'A':
                return np.random.choice([1, 2], p=[0.7, 0.3])
            elif row['abc_category'] == 'B':
                return np.random.choice([1, 2, 3], p=[0.3, 0.4, 0.3])
            else:  # C category
                return np.random.choice([2, 3, 4], p=[0.2, 0.4, 0.4])
        
        self.amalgamated_df['preferred_level'] = self.amalgamated_df.apply(
            calculate_preferred_level, axis=1
        )
        
        print(f"  Accessibility score range: {self.amalgamated_df['required_accessibility'].min():.1f} - {self.amalgamated_df['required_accessibility'].max():.1f}")
        print(f"  Average accessibility score: {self.amalgamated_df['required_accessibility'].mean():.1f}")
        
        return self.amalgamated_df
    
    def save_results(self):
        """Save all classification results"""
        print("\n💾 Saving classification results...")
        
        # Save ABC classification
        abc_file = self.output_dir / "abc_classification.csv"
        self.abc_df.to_csv(abc_file, index=False)
        print(f"  ✅ ABC classification saved to {abc_file}")
        
        # Save FMS classification
        fms_file = self.output_dir / "fms_classification.csv"
        self.fms_df.to_csv(fms_file, index=False)
        print(f"  ✅ FMS classification saved to {fms_file}")
        
        # Save amalgamated analysis
        amalgamated_file = self.output_dir / "abc_fms_amalgamated.csv"
        self.amalgamated_df.to_csv(amalgamated_file, index=False)
        print(f"  ✅ Amalgamated analysis saved to {amalgamated_file}")
        
        # Save summary statistics
        summary = {
            'generation_date': pd.Timestamp.now().isoformat(),
            'total_materials': len(self.amalgamated_df),
            'abc_distribution': self.abc_df['abc_category'].value_counts().to_dict(),
            'fms_distribution': self.fms_df['fms_category'].value_counts().to_dict(),
            'combined_distribution': self.amalgamated_df['combined_classification'].value_counts().to_dict(),
            'zone_distribution': self.amalgamated_df['recommended_zone'].value_counts().to_dict(),
            'avg_accessibility_score': float(self.amalgamated_df['required_accessibility'].mean()),
        }
        
        summary_file = self.output_dir / "abc_fms_summary.json"
        with open(summary_file, 'w') as f:
            json.dump(summary, f, indent=2)
        print(f"  ✅ Summary saved to {summary_file}")

def main():
    import sys
    
    demand_data_path = "../synthetic_data/demand_history_2023_2024.csv"
    output_dir = "../synthetic_data"
    
    if len(sys.argv) > 1:
        demand_data_path = sys.argv[1]
    if len(sys.argv) > 2:
        output_dir = sys.argv[2]
    
    print("="*60)
    print("ABC/FMS Classification Generator")
    print("Training Report Methodology (Pareto + Movement Frequency)")
    print("="*60)
    print(f"Input: {demand_data_path}")
    print(f"Output: {output_dir}")
    print("="*60)
    
    classifier = ABCFMSClassifier(demand_data_path, output_dir)
    classifier.load_demand_data()
    classifier.calculate_abc_classification()
    classifier.calculate_fms_classification()
    classifier.generate_amalgamated_analysis()
    classifier.calculate_accessibility_requirements()
    classifier.save_results()
    
    print("\n✅ ABC/FMS classification complete!")
    print("\n📋 Generated files:")
    print("  - abc_classification.csv (Pareto analysis)")
    print("  - fms_classification.csv (Movement frequency)")
    print("  - abc_fms_amalgamated.csv (Combined analysis with storage zones)")
    print("  - abc_fms_summary.json (Statistics)")

if __name__ == "__main__":
    main()
