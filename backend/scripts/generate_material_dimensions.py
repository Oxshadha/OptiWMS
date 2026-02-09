"""
Material Dimensions Generator
Generates realistic dimensions, weights, and pallet requirements for all materials
Based on Sri Lankan FMCG product specifications
"""

import pandas as pd
import numpy as np
from pathlib import Path
import json

class MaterialDimensionsGenerator:
    def __init__(self, input_dir: str, output_dir: str):
        self.input_dir = Path(input_dir)
        self.output_dir = Path(output_dir)
        
    def load_data(self):
        """Load materials and active stock data"""
        print("📂 Loading material data...")
        
        # Load materials
        materials_path = self.input_dir / "Item code and descriptions.csv"
        self.materials_df = pd.read_csv(materials_path)
        self.materials_df = self.materials_df[self.materials_df['Material Code'].notna()]
        self.materials_df = self.materials_df[self.materials_df['Material Code'] != '']
        print(f"  ✅ Loaded {len(self.materials_df)} materials")
        
        # Load active stock
        active_stock_path = self.input_dir / "Active stock.csv"
        self.active_stock_df = pd.read_csv(active_stock_path)
        self.active_stock_df.columns = self.active_stock_df.columns.str.strip()
        
        # Clean up first column
        first_col = self.active_stock_df.columns[0]
        self.active_stock_df = self.active_stock_df.rename(columns={first_col: 'Material Code'})
        self.active_stock_df = self.active_stock_df[self.active_stock_df['Material Code'].notna()]
        print(f"  ✅ Loaded {len(self.active_stock_df)} active stock records")
    
    def categorize_material(self, description: str):
        """Categorize material for dimension generation"""
        desc_lower = description.lower()
        
        # Baby care products
        if any(word in desc_lower for word in ['napkin', 'diaper', 'nappy', 'baby', 'fluff']):
            return 'baby_care'
        
        # Personal care liquids (drums)
        elif any(word in desc_lower for word in ['cologne', 'oil', 'glycerine', 'liquid', 'perfume']):
            return 'personal_care_liquid'
        
        # Personal care powders/solids
        elif any(word in desc_lower for word in ['talcum', 'powder', 'soap']):
            return 'personal_care_solid'
        
        # Household chemicals (bags/drums)
        elif any(word in desc_lower for word in ['caustic', 'soda', 'carbonate', 'silicate', 'sulphate', 'zeolite']):
            return 'chemical_bulk'
        
        # Surfactants and specialty chemicals
        elif any(word in desc_lower for word in ['betaine', 'galaxy', 'emal', 'sulphonate', 'aos']):
            return 'chemical_surfactant'
        
        # Packaging materials - sheets and films
        elif any(word in desc_lower for word in ['sheet', 'woven', 'pe back', 'film', 'non-woven']):
            return 'packaging_sheet'
        
        # Packaging materials - pouches
        elif any(word in desc_lower for word in ['pouch', 'bag', 'wrapper']):
            return 'packaging_pouch'
        
        # Paper and labels
        elif any(word in desc_lower for word in ['paper', 'label', 'sticker']):
            return 'packaging_paper'
        
        # Colors and dyes
        elif any(word in desc_lower for word in ['color', 'colour', 'dye', 'pigment', 'speckle']):
            return 'colorant'
        
        # Fragrances
        elif any(word in desc_lower for word in ['fragrance', 'essence', 'aroma']):
            return 'fragrance'
        
        # Default
        else:
            return 'general'
    
    def generate_dimensions(self, category: str, description: str):
        """Generate realistic dimensions based on category"""
        
        # Baby care products (boxes of napkins/diapers)
        if category == 'baby_care':
            return {
                'length_cm': round(np.random.uniform(45, 65), 2),
                'width_cm': round(np.random.uniform(35, 50), 2),
                'height_cm': round(np.random.uniform(25, 45), 2),
                'weight_kg': round(np.random.uniform(8, 18), 2),
                'pallet_spaces': round(np.random.uniform(0.25, 0.5), 2),  # Multiple per pallet
                'stackable': True,
                'max_stack_height': np.random.randint(4, 8),
            }
        
        # Personal care liquids (drums/containers)
        elif category == 'personal_care_liquid':
            return {
                'length_cm': round(np.random.uniform(55, 75), 2),
                'width_cm': round(np.random.uniform(55, 75), 2),
                'height_cm': round(np.random.uniform(85, 125), 2),
                'weight_kg': round(np.random.uniform(150, 280), 2),
                'pallet_spaces': round(np.random.uniform(0.3, 0.6), 2),
                'stackable': False,  # Heavy drums
                'max_stack_height': 1,
            }
        
        # Personal care solids (bags/boxes)
        elif category == 'personal_care_solid':
            return {
                'length_cm': round(np.random.uniform(40, 60), 2),
                'width_cm': round(np.random.uniform(30, 45), 2),
                'height_cm': round(np.random.uniform(15, 35), 2),
                'weight_kg': round(np.random.uniform(10, 30), 2),
                'pallet_spaces': round(np.random.uniform(0.15, 0.35), 2),
                'stackable': True,
                'max_stack_height': np.random.randint(5, 10),
            }
        
        # Chemical bulk (large bags/drums)
        elif category == 'chemical_bulk':
            return {
                'length_cm': round(np.random.uniform(60, 90), 2),
                'width_cm': round(np.random.uniform(50, 70), 2),
                'height_cm': round(np.random.uniform(15, 35), 2),
                'weight_kg': round(np.random.uniform(25, 60), 2),
                'pallet_spaces': round(np.random.uniform(0.4, 0.8), 2),
                'stackable': True,
                'max_stack_height': np.random.randint(3, 6),
            }
        
        # Surfactants (medium drums/containers)
        elif category == 'chemical_surfactant':
            return {
                'length_cm': round(np.random.uniform(50, 70), 2),
                'width_cm': round(np.random.uniform(50, 70), 2),
                'height_cm': round(np.random.uniform(70, 100), 2),
                'weight_kg': round(np.random.uniform(80, 200), 2),
                'pallet_spaces': round(np.random.uniform(0.25, 0.5), 2),
                'stackable': True,
                'max_stack_height': np.random.randint(2, 4),
            }
        
        # Packaging sheets (reels/rolls)
        elif category == 'packaging_sheet':
            return {
                'length_cm': round(np.random.uniform(120, 180), 2),
                'width_cm': round(np.random.uniform(15, 35), 2),
                'height_cm': round(np.random.uniform(15, 35), 2),
                'weight_kg': round(np.random.uniform(8, 25), 2),
                'pallet_spaces': round(np.random.uniform(0.2, 0.4), 2),
                'stackable': True,
                'max_stack_height': np.random.randint(6, 12),
            }
        
        # Packaging pouches (boxes of pouches)
        elif category == 'packaging_pouch':
            return {
                'length_cm': round(np.random.uniform(50, 70), 2),
                'width_cm': round(np.random.uniform(40, 55), 2),
                'height_cm': round(np.random.uniform(35, 50), 2),
                'weight_kg': round(np.random.uniform(5, 15), 2),
                'pallet_spaces': round(np.random.uniform(0.15, 0.3), 2),
                'stackable': True,
                'max_stack_height': np.random.randint(6, 10),
            }
        
        # Paper and labels (small boxes)
        elif category == 'packaging_paper':
            return {
                'length_cm': round(np.random.uniform(30, 50), 2),
                'width_cm': round(np.random.uniform(25, 40), 2),
                'height_cm': round(np.random.uniform(20, 35), 2),
                'weight_kg': round(np.random.uniform(3, 12), 2),
                'pallet_spaces': round(np.random.uniform(0.1, 0.2), 2),
                'stackable': True,
                'max_stack_height': np.random.randint(8, 15),
            }
        
        # Colorants (small containers)
        elif category == 'colorant':
            return {
                'length_cm': round(np.random.uniform(25, 40), 2),
                'width_cm': round(np.random.uniform(25, 40), 2),
                'height_cm': round(np.random.uniform(30, 50), 2),
                'weight_kg': round(np.random.uniform(2, 8), 2),
                'pallet_spaces': round(np.random.uniform(0.05, 0.15), 2),
                'stackable': True,
                'max_stack_height': np.random.randint(10, 20),
            }
        
        # Fragrances (small bottles/containers)
        elif category == 'fragrance':
            return {
                'length_cm': round(np.random.uniform(20, 35), 2),
                'width_cm': round(np.random.uniform(20, 35), 2),
                'height_cm': round(np.random.uniform(25, 40), 2),
                'weight_kg': round(np.random.uniform(1, 6), 2),
                'pallet_spaces': round(np.random.uniform(0.05, 0.12), 2),
                'stackable': True,
                'max_stack_height': np.random.randint(12, 20),
            }
        
        # General (medium boxes)
        else:
            return {
                'length_cm': round(np.random.uniform(35, 55), 2),
                'width_cm': round(np.random.uniform(30, 45), 2),
                'height_cm': round(np.random.uniform(20, 40), 2),
                'weight_kg': round(np.random.uniform(5, 20), 2),
                'pallet_spaces': round(np.random.uniform(0.2, 0.4), 2),
                'stackable': True,
                'max_stack_height': np.random.randint(5, 10),
            }
    
    def get_pallet_requirement_from_csv(self, material_code):
        """Get pallet requirement from Active stock CSV if available"""
        stock_row = self.active_stock_df[
            self.active_stock_df['Material Code'] == material_code
        ]
        
        if not stock_row.empty:
            # Try to find pallet requirement column
            pallet_cols = [col for col in stock_row.columns if 'pallet' in col.lower()]
            if pallet_cols:
                try:
                    value = stock_row.iloc[0][pallet_cols[0]]
                    if pd.notna(value) and value != '' and value != ' -   ':
                        # Clean and convert
                        value_str = str(value).replace(',', '').strip()
                        return float(value_str)
                except:
                    pass
        
        return None
    
    def generate_all_dimensions(self):
        """Generate dimensions for all materials"""
        print("\n📏 Generating material dimensions...")
        
        dimension_records = []
        
        for idx, material in self.materials_df.iterrows():
            material_code = material['Material Code']
            description = material['Description']
            
            # Categorize material
            category = self.categorize_material(description)
            
            # Generate dimensions
            dims = self.generate_dimensions(category, description)
            
            # Try to get pallet requirement from CSV
            csv_pallet_req = self.get_pallet_requirement_from_csv(material_code)
            if csv_pallet_req is not None:
                dims['pallet_spaces'] = csv_pallet_req
            
            # Determine temperature and hazard requirements
            temp_controlled = any(word in description.lower() for word in ['vaccine', 'perishable', 'fresh'])
            hazardous = any(word in description.lower() for word in ['acid', 'caustic', 'flammable', 'toxic'])
            
            # Add special handling flags
            fragile = category in ['colorant', 'fragrance', 'packaging_paper']
            
            dimension_records.append({
                'material_code': material_code,
                'description': description,
                'category': category,
                'length_cm': dims['length_cm'],
                'width_cm': dims['width_cm'],
                'height_cm': dims['height_cm'],
                'weight_kg': dims['weight_kg'],
                'volume_cm3': round(dims['length_cm'] * dims['width_cm'] * dims['height_cm'], 2),
                'pallet_spaces': dims['pallet_spaces'],
                'stackable': dims['stackable'],
                'max_stack_height': dims['max_stack_height'],
                'temperature_controlled': temp_controlled,
                'hazardous': hazardous,
                'fragile': fragile,
            })
            
            if (idx + 1) % 50 == 0:
                print(f"  Progress: {idx + 1}/{len(self.materials_df)} materials")
        
        self.dimensions_df = pd.DataFrame(dimension_records)
        
        # Save to CSV
        output_file = self.output_dir / "material_dimensions.csv"
        self.dimensions_df.to_csv(output_file, index=False)
        print(f"  ✅ Generated dimensions for {len(self.dimensions_df)} materials")
        print(f"  💾 Saved to {output_file}")
        
        # Generate summary
        self.generate_summary()
        
        return self.dimensions_df
    
    def generate_summary(self):
        """Generate summary statistics"""
        print("\n📊 Dimension Summary:")
        print(f"  Category distribution:")
        for category, count in self.dimensions_df['category'].value_counts().items():
            print(f"    {category}: {count}")
        
        print(f"\n  Weight statistics:")
        print(f"    Min: {self.dimensions_df['weight_kg'].min():.2f} kg")
        print(f"    Max: {self.dimensions_df['weight_kg'].max():.2f} kg")
        print(f"    Average: {self.dimensions_df['weight_kg'].mean():.2f} kg")
        
        print(f"\n  Pallet space statistics:")
        print(f"    Min: {self.dimensions_df['pallet_spaces'].min():.2f}")
        print(f"    Max: {self.dimensions_df['pallet_spaces'].max():.2f}")
        print(f"    Average: {self.dimensions_df['pallet_spaces'].mean():.2f}")
        
        print(f"\n  Stackability:")
        print(f"    Stackable: {self.dimensions_df['stackable'].sum()}")
        print(f"    Non-stackable: {(~self.dimensions_df['stackable']).sum()}")
        
        print(f"\n  Special handling:")
        print(f"    Temperature controlled: {self.dimensions_df['temperature_controlled'].sum()}")
        print(f"    Hazardous: {self.dimensions_df['hazardous'].sum()}")
        print(f"    Fragile: {self.dimensions_df['fragile'].sum()}")

def main():
    import sys
    
    input_dir = "../../frontend/Database Documents"
    output_dir = "../synthetic_data"
    
    if len(sys.argv) > 1:
        input_dir = sys.argv[1]
    if len(sys.argv) > 2:
        output_dir = sys.argv[2]
    
    print("="*60)
    print("Material Dimensions Generator")
    print("Sri Lankan FMCG Product Specifications")
    print("="*60)
    print(f"Input: {input_dir}")
    print(f"Output: {output_dir}")
    print("="*60)
    
    generator = MaterialDimensionsGenerator(input_dir, output_dir)
    generator.load_data()
    generator.generate_all_dimensions()
    
    print("\n✅ Material dimensions generation complete!")

if __name__ == "__main__":
    main()
