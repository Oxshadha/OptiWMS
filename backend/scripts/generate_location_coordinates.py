"""
Location Coordinates Generator
Generates X, Y coordinates for all warehouse locations
Supports pathfinding algorithms (A*, TSP, Dijkstra)
"""

import pandas as pd
import numpy as np
from pathlib import Path
import json

class LocationCoordinatesGenerator:
    def __init__(self, output_dir: str):
        self.output_dir = Path(output_dir)
        
        # Warehouse layout parameters (in meters)
        self.aisle_width = 3.0  # Width of aisle for forklift
        self.rack_depth = 2.5   # Depth of one side of rack
        self.bay_width = 1.2    # Width of each bay
        self.level_height = 2.0 # Height between levels
        
    def parse_location_code(self, location_code: str):
        """
        Parse location code: ST-WH001-01-001-1-A
        Returns: area, warehouse, row, bay, level, bin
        """
        try:
            parts = location_code.split('-')
            if len(parts) >= 6:
                return {
                    'area': parts[0],
                    'warehouse': parts[1],
                    'row': int(parts[2]),
                    'bay': int(parts[3]),
                    'level': int(parts[4]),
                    'bin': parts[5]
                }
        except:
            pass
        return None
    
    def calculate_coordinates(self, parsed_location):
        """
        Calculate X, Y, Z coordinates based on warehouse layout
        
        Layout assumptions:
        - X axis: Along the aisle (row direction)
        - Y axis: Across the aisle (bay direction)
        - Z axis: Vertical (level direction)
        
        Entrance at (0, 0, 0)
        """
        if not parsed_location:
            return None
        
        row = parsed_location['row']
        bay = parsed_location['bay']
        level = parsed_location['level']
        bin_pos = parsed_location['bin']
        
        # X coordinate (along aisle)
        # Each row is separated by aisle_width + rack_depth
        x = (row - 1) * (self.aisle_width + self.rack_depth * 2)
        
        # Y coordinate (across aisle - which side of rack)
        # Bins A, B, C are on different sides
        if bin_pos == 'A':
            y = bay * self.bay_width  # Left side
        elif bin_pos == 'B':
            y = bay * self.bay_width + self.rack_depth  # Middle
        else:  # C
            y = bay * self.bay_width + self.rack_depth * 2  # Right side
        
        # Z coordinate (vertical)
        z = (level - 1) * self.level_height
        
        return {
            'coordinate_x': round(x, 2),
            'coordinate_y': round(y, 2),
            'coordinate_z': round(z, 2)
        }
    
    def calculate_accessibility_rating(self, parsed_location, coords):
        """
        Calculate accessibility rating (1-10)
        Based on distance from entrance and level
        """
        if not parsed_location or not coords:
            return 5  # Default
        
        # Base score starts at 10 (most accessible)
        score = 10.0
        
        # Penalty for distance from entrance
        distance_from_entrance = np.sqrt(coords['coordinate_x']**2 + coords['coordinate_y']**2)
        distance_penalty = min(distance_from_entrance / 10, 5)  # Max -5 points
        score -= distance_penalty
        
        # Penalty for height (level)
        level = parsed_location['level']
        level_penalty = (level - 1) * 1.5  # -1.5 points per level above ground
        score -= level_penalty
        
        # Bonus for ground level in front rows
        if level == 1 and parsed_location['row'] <= 3:
            score += 2
        
        # Clamp to 1-10
        score = max(1, min(10, round(score, 1)))
        
        return score
    
    def generate_sample_locations(self, num_areas=2, rows_per_area=10, bays_per_row=20, levels=4):
        """
        Generate sample locations for testing
        Creates a realistic warehouse layout
        """
        print(f"\n📍 Generating sample warehouse locations...")
        print(f"  Areas: {num_areas}")
        print(f"  Rows per area: {rows_per_area}")
        print(f"  Bays per row: {bays_per_row}")
        print(f"  Levels: {levels}")
        
        locations = []
        
        areas = ['ST', 'A']  # Storage, Area A
        bins = ['A', 'B', 'C']
        
        for area in areas[:num_areas]:
            for row in range(1, rows_per_area + 1):
                for bay in range(1, bays_per_row + 1):
                    for level in range(1, levels + 1):
                        for bin_pos in bins:
                            location_code = f"{area}-WH001-{row:02d}-{bay:03d}-{level}-{bin_pos}"
                            locations.append({
                                'location_code': location_code,
                                'warehouse_id': 'WH-001',
                                'area': area,
                                'row_number': f"{row:02d}",
                                'bay_number': f"{bay:03d}",
                                'level_number': level,
                                'bin_position': bin_pos,
                            })
        
        return pd.DataFrame(locations)
    
    def generate_coordinates_for_locations(self, locations_df):
        """Generate coordinates for all locations"""
        print(f"\n🗺️  Calculating coordinates for {len(locations_df)} locations...")
        
        coordinates_records = []
        
        for idx, location in locations_df.iterrows():
            location_code = location['location_code']
            
            # Parse location code
            parsed = self.parse_location_code(location_code)
            
            # Calculate coordinates
            coords = self.calculate_coordinates(parsed)
            
            if coords:
                # Calculate accessibility
                accessibility = self.calculate_accessibility_rating(parsed, coords)
                
                coordinates_records.append({
                    'location_code': location_code,
                    'warehouse_id': location.get('warehouse_id', 'WH-001'),
                    'area': location.get('area', parsed['area'] if parsed else ''),
                    'row_number': location.get('row_number', f"{parsed['row']:02d}" if parsed else ''),
                    'bay_number': location.get('bay_number', f"{parsed['bay']:03d}" if parsed else ''),
                    'level_number': location.get('level_number', parsed['level'] if parsed else 1),
                    'bin_position': location.get('bin_position', parsed['bin'] if parsed else 'A'),
                    'coordinate_x': coords['coordinate_x'],
                    'coordinate_y': coords['coordinate_y'],
                    'coordinate_z': coords['coordinate_z'],
                    'accessibility_rating': accessibility,
                    'is_active': True,
                    'location_type': 'storage',
                    'max_pallet_capacity': np.random.randint(2, 6),  # 2-5 pallets per location
                })
            
            if (idx + 1) % 500 == 0:
                print(f"  Progress: {idx + 1}/{len(locations_df)} locations")
        
        self.coordinates_df = pd.DataFrame(coordinates_records)
        
        print(f"  ✅ Generated coordinates for {len(self.coordinates_df)} locations")
        
        return self.coordinates_df
    
    def calculate_distance_matrix(self, sample_size=100):
        """
        Calculate distance matrix for pathfinding
        Uses Manhattan distance (warehouse navigation)
        Sample_size limits matrix size for performance
        """
        print(f"\n📏 Calculating distance matrix (sample size: {sample_size})...")
        
        # Sample locations for distance matrix (full matrix would be huge)
        if len(self.coordinates_df) > sample_size:
            sample_locations = self.coordinates_df.sample(n=sample_size, random_state=42)
        else:
            sample_locations = self.coordinates_df
        
        location_codes = sample_locations['location_code'].tolist()
        n = len(location_codes)
        
        # Initialize distance matrix
        distance_matrix = pd.DataFrame(
            index=location_codes,
            columns=location_codes,
            dtype=float
        )
        
        # Calculate Manhattan distances
        for i, loc1_code in enumerate(location_codes):
            loc1 = sample_locations[sample_locations['location_code'] == loc1_code].iloc[0]
            
            for j, loc2_code in enumerate(location_codes):
                if i == j:
                    distance_matrix.at[loc1_code, loc2_code] = 0.0
                else:
                    loc2 = sample_locations[sample_locations['location_code'] == loc2_code].iloc[0]
                    
                    # Manhattan distance (suitable for warehouse aisles)
                    distance = (
                        abs(loc1['coordinate_x'] - loc2['coordinate_x']) +
                        abs(loc1['coordinate_y'] - loc2['coordinate_y']) +
                        abs(loc1['coordinate_z'] - loc2['coordinate_z']) * 2  # Vertical movement is slower
                    )
                    
                    distance_matrix.at[loc1_code, loc2_code] = round(distance, 2)
            
            if (i + 1) % 10 == 0:
                print(f"  Progress: {i + 1}/{n} locations")
        
        self.distance_matrix_df = distance_matrix
        
        print(f"  ✅ Distance matrix calculated ({n}x{n})")
        print(f"  Min distance: {distance_matrix[distance_matrix > 0].min().min():.2f}m")
        print(f"  Max distance: {distance_matrix.max().max():.2f}m")
        print(f"  Avg distance: {distance_matrix[distance_matrix > 0].mean().mean():.2f}m")
        
        return self.distance_matrix_df
    
    def generate_waypoints(self):
        """
        Generate key waypoints for pathfinding
        (entrance, packing stations, loading docks, etc.)
        """
        print(f"\n🚪 Generating waypoints...")
        
        waypoints = [
            {
                'waypoint_name': 'Main Entrance',
                'waypoint_code': 'ENTRANCE-01',
                'coordinate_x': 0.0,
                'coordinate_y': 0.0,
                'coordinate_z': 0.0,
                'waypoint_type': 'entrance'
            },
            {
                'waypoint_name': 'Packing Station 1',
                'waypoint_code': 'PACK-01',
                'coordinate_x': 5.0,
                'coordinate_y': 2.0,
                'coordinate_z': 0.0,
                'waypoint_type': 'packing'
            },
            {
                'waypoint_name': 'Packing Station 2',
                'waypoint_code': 'PACK-02',
                'coordinate_x': 5.0,
                'coordinate_y': 8.0,
                'coordinate_z': 0.0,
                'waypoint_type': 'packing'
            },
            {
                'waypoint_name': 'Loading Dock 1',
                'waypoint_code': 'DOCK-01',
                'coordinate_x': 2.0,
                'coordinate_y': 15.0,
                'coordinate_z': 0.0,
                'waypoint_type': 'loading_dock'
            },
            {
                'waypoint_name': 'Loading Dock 2',
                'waypoint_code': 'DOCK-02',
                'coordinate_x': 2.0,
                'coordinate_y': 25.0,
                'coordinate_z': 0.0,
                'waypoint_type': 'loading_dock'
            },
            {
                'waypoint_name': 'Receiving Area',
                'waypoint_code': 'RECV-01',
                'coordinate_x': 1.0,
                'coordinate_y': 1.0,
                'coordinate_z': 0.0,
                'waypoint_type': 'receiving'
            },
        ]
        
        self.waypoints_df = pd.DataFrame(waypoints)
        print(f"  ✅ Generated {len(self.waypoints_df)} waypoints")
        
        return self.waypoints_df
    
    def save_results(self):
        """Save all generated data"""
        print(f"\n💾 Saving results...")
        
        # Save coordinates
        coords_file = self.output_dir / "location_coordinates.csv"
        self.coordinates_df.to_csv(coords_file, index=False)
        print(f"  ✅ Coordinates saved to {coords_file}")
        
        # Save distance matrix
        if hasattr(self, 'distance_matrix_df'):
            matrix_file = self.output_dir / "location_distance_matrix.csv"
            self.distance_matrix_df.to_csv(matrix_file)
            print(f"  ✅ Distance matrix saved to {matrix_file}")
        
        # Save waypoints
        if hasattr(self, 'waypoints_df'):
            waypoints_file = self.output_dir / "warehouse_waypoints.csv"
            self.waypoints_df.to_csv(waypoints_file, index=False)
            print(f"  ✅ Waypoints saved to {waypoints_file}")
        
        # Save summary
        summary = {
            'generation_date': pd.Timestamp.now().isoformat(),
            'total_locations': len(self.coordinates_df),
            'coordinate_ranges': {
                'x': {'min': float(self.coordinates_df['coordinate_x'].min()),
                      'max': float(self.coordinates_df['coordinate_x'].max())},
                'y': {'min': float(self.coordinates_df['coordinate_y'].min()),
                      'max': float(self.coordinates_df['coordinate_y'].max())},
                'z': {'min': float(self.coordinates_df['coordinate_z'].min()),
                      'max': float(self.coordinates_df['coordinate_z'].max())},
            },
            'accessibility_stats': {
                'min': float(self.coordinates_df['accessibility_rating'].min()),
                'max': float(self.coordinates_df['accessibility_rating'].max()),
                'avg': float(self.coordinates_df['accessibility_rating'].mean()),
            },
            'warehouse_dimensions': {
                'aisle_width_m': self.aisle_width,
                'rack_depth_m': self.rack_depth,
                'bay_width_m': self.bay_width,
                'level_height_m': self.level_height,
            }
        }
        
        summary_file = self.output_dir / "coordinates_summary.json"
        with open(summary_file, 'w') as f:
            json.dump(summary, f, indent=2)
        print(f"  ✅ Summary saved to {summary_file}")

def main():
    import sys
    
    output_dir = "../synthetic_data"
    
    if len(sys.argv) > 1:
        output_dir = sys.argv[1]
    
    print("="*60)
    print("Location Coordinates Generator")
    print("Warehouse Layout with X, Y, Z Coordinates")
    print("="*60)
    print(f"Output: {output_dir}")
    print("="*60)
    
    generator = LocationCoordinatesGenerator(output_dir)
    
    # Generate sample locations (can be replaced with actual location data)
    locations_df = generator.generate_sample_locations(
        num_areas=2,
        rows_per_area=10,
        bays_per_row=20,
        levels=4
    )
    
    # Generate coordinates
    generator.generate_coordinates_for_locations(locations_df)
    
    # Generate distance matrix (sample)
    generator.calculate_distance_matrix(sample_size=100)
    
    # Generate waypoints
    generator.generate_waypoints()
    
    # Save results
    generator.save_results()
    
    print("\n✅ Location coordinates generation complete!")
    print("\n📋 Generated files:")
    print("  - location_coordinates.csv (X, Y, Z coordinates + accessibility)")
    print("  - location_distance_matrix.csv (100x100 distance matrix)")
    print("  - warehouse_waypoints.csv (Key waypoints)")
    print("  - coordinates_summary.json (Statistics)")

if __name__ == "__main__":
    main()
