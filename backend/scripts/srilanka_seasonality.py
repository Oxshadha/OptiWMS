"""
Sri Lankan Seasonality Patterns for Warehouse Management
Based on FMCG industry patterns, festivals, monsoons, and economic cycles
"""

# Sri Lankan National Holidays and Festivals (Major Impact on Demand)
SRI_LANKAN_FESTIVALS = {
    'sinhala_new_year': {'month': 4, 'impact': 1.40, 'prep_months': [3, 4]},
    'vesak': {'month': 5, 'impact': 1.15},
    'poson': {'month': 6, 'impact': 1.08},
    'esala': {'month': 7, 'impact': 1.10},
    'deepavali': {'month': 10, 'impact': 1.15, 'prep_months': [10]},
    'christmas': {'month': 12, 'impact': 1.30, 'prep_months': [11, 12]},
}

# Base seasonality multipliers for Sri Lankan market
# Accounts for festivals, monsoons, school terms, and agricultural cycles
SRI_LANKAN_BASE_SEASONALITY = {
    1: 0.95,   # January - Post-holiday slump, back to school
    2: 0.88,   # February - Lowest demand month
    3: 1.15,   # March - Sinhala New Year preparation surge
    4: 1.40,   # April - Sinhala & Tamil New Year peak
    5: 1.18,   # May - Vesak + Southwest Monsoon begins
    6: 1.08,   # June - Poson + Mid-year school term
    7: 1.12,   # July - Esala + School holidays
    8: 1.10,   # August - Harvest season (Yala)
    9: 1.08,   # September - School reopening + Southwest Monsoon peak
    10: 1.15,  # October - Deepavali preparation + harvest
    11: 1.10,  # November - Post-Deepavali + festive season begins
    12: 1.32,  # December - Christmas, New Year peak demand
}

# Category-specific seasonality patterns
CATEGORY_SEASONALITY = {
    # Personal Care & Hygiene (Soap, Body Wash, Cologne)
    'personal_care': {
        'base': SRI_LANKAN_BASE_SEASONALITY,
        'modifiers': {
            3: 1.25,   # NY prep - cleaning surge
            4: 1.50,   # NY peak - gifting
            5: 1.20,   # Vesak + Monsoon humidity
            12: 1.40,  # Christmas gifting
        },
        'monsoon_boost': 1.12,  # Higher during monsoon months (May-Sep)
        'growth_rate': 0.025,    # 2.5% annual growth
    },
    
    # Baby Care (Napkins, Diapers, Baby Products)
    'baby_care': {
        'base': SRI_LANKAN_BASE_SEASONALITY,
        'modifiers': {
            4: 1.25,   # NY gifting
            12: 1.25,  # Christmas gifting
        },
        'steady': True,         # Less seasonal, more stable demand
        'growth_rate': 0.035,   # 3.5% annual growth (growing category)
    },
    
    # Household Care (Cleaning Products, Detergents)
    'household': {
        'base': SRI_LANKAN_BASE_SEASONALITY,
        'modifiers': {
            3: 1.30,   # Pre-NY cleaning surge
            4: 1.20,   # NY period
            9: 1.15,   # Post-monsoon cleaning
        },
        'monsoon_boost': 1.15,  # Significant boost during monsoons
        'growth_rate': 0.020,   # 2% annual growth
    },
    
    # Cosmetics & Beauty
    'cosmetics': {
        'base': SRI_LANKAN_BASE_SEASONALITY,
        'modifiers': {
            3: 1.20,
            4: 1.45,   # Highest peak for NY
            11: 1.25,  # Deepavali
            12: 1.45,  # Christmas
        },
        'festive_boost': 1.25,
        'growth_rate': 0.030,  # 3% annual growth
    },
    
    # Raw Materials (Manufacturing inputs)
    'raw_materials': {
        'base': SRI_LANKAN_BASE_SEASONALITY,
        'modifiers': {
            1: 0.85,   # Post-holiday manufacturing slow
            2: 0.82,   # Lowest
            3: 1.20,   # Ramp up for NY production
        },
        'production_lead': 1,   # Lead production by 1 month
        'growth_rate': 0.022,   # 2.2% annual growth
    },
    
    # Packaging Materials
    'packaging': {
        'base': SRI_LANKAN_BASE_SEASONALITY,
        'modifiers': {
            3: 1.25,   # NY prep
            11: 1.20,  # Festival season prep
        },
        'production_lead': 1,
        'growth_rate': 0.028,  # 2.8% annual growth
    },
}

# Monsoon impact on different product categories
MONSOON_PATTERNS = {
    'southwest_monsoon': {  # May - September
        'months': [5, 6, 7, 8, 9],
        'impact': {
            'personal_care': 1.12,
            'household': 1.15,
            'baby_care': 1.05,
            'raw_materials': 0.98,  # Slight reduction due to logistics
        }
    },
    'northeast_monsoon': {  # December - February
        'months': [12, 1, 2],
        'impact': {
            'personal_care': 1.05,
            'household': 1.08,
            'baby_care': 1.03,
            'raw_materials': 0.95,  # Logistics challenges
        }
    }
}

# School term impact
SCHOOL_TERMS = {
    'first_term': {'months': [1, 2, 3], 'impact': 1.08},      # January reopening
    'second_term': {'months': [5, 6, 7], 'impact': 1.05},     # May reopening
    'third_term': {'months': [9, 10, 11], 'impact': 1.10},    # September reopening
}

# Economic cycle adjustments for Sri Lankan context
ECONOMIC_FACTORS = {
    '2022_crisis': {'months': range(3, 9), 'impact': 0.85},   # Economic crisis impact
    '2023_recovery': {'months': range(1, 13), 'impact': 0.92}, # Gradual recovery
    '2024_growth': {'months': range(1, 13), 'impact': 1.05},  # Return to growth
}

# Regional variations (Colombo vs Outstation)
REGIONAL_PATTERNS = {
    'colombo': 1.15,      # Urban premium demand
    'western_province': 1.10,
    'central_province': 0.95,
    'southern_province': 0.92,
    'northern_province': 0.88,
    'eastern_province': 0.85,
}

def get_category_from_description(description: str) -> str:
    """
    Categorize RAW MATERIALS only (not products)
    For synthetic data generation - demand patterns
    Products (household, personal_care, baby_care) are FINISHED GOODS, not raw materials
    """
    description_lower = description.lower()
    
    # Packaging materials
    if any(word in description_lower for word in ['pouch', 'pe back', 'sheet', 'woven', 'paper', 'reel', 'tape']):
        return 'packaging_material'
    
    # Chemical raw materials (for demand forecasting)
    if any(word in description_lower for word in ['caustic', 'carbonate', 'silicate', 'sulphate']):
        return 'chemical_bulk'
    
    # Surfactants
    if any(word in description_lower for word in ['betaine', 'galaxy', 'emal', 'sulphonate']):
        return 'chemical_surfactant'
    
    # Fragrances/essences (raw materials, not finished products)
    if any(word in description_lower for word in ['cologne bulk', 'fragrance', 'essence', 'oil']):
        return 'raw_fragrance'
    
    # Default: raw material
    return 'raw_material'

def get_unit_type_from_description(unit_type: str, description: str) -> str:
    """
    Standardize unit types
    """
    if not unit_type or unit_type.strip() == '':
        # Infer from description
        description_lower = description.lower()
        if 'oil' in description_lower or 'liquid' in description_lower:
            return 'Drum'
        elif any(word in description_lower for word in ['powder', 'chemical', 'granule']):
            return 'Bags'
        elif any(word in description_lower for word in ['sheet', 'woven', 'film']):
            return 'Reel'
        elif 'box' in description_lower:
            return 'Box'
        else:
            return 'Bags'  # Default
    
    return unit_type.strip()

def apply_srilanka_seasonality(month: int, category: str, year: int) -> float:
    """
    Calculate seasonality multiplier for a given month and category
    """
    # Get category pattern
    category_pattern = CATEGORY_SEASONALITY.get(category, CATEGORY_SEASONALITY['raw_materials'])
    
    # Start with base seasonality
    base_multiplier = category_pattern['base'].get(month, 1.0)
    
    # Apply category-specific modifiers
    modifiers = category_pattern.get('modifiers', {})
    if month in modifiers:
        base_multiplier = modifiers[month]
    
    # Apply monsoon impact
    if 'monsoon_boost' in category_pattern:
        if month in MONSOON_PATTERNS['southwest_monsoon']['months']:
            base_multiplier *= category_pattern['monsoon_boost']
        elif month in MONSOON_PATTERNS['northeast_monsoon']['months']:
            monsoon_impact = MONSOON_PATTERNS['northeast_monsoon']['impact'].get(category, 1.0)
            base_multiplier *= monsoon_impact
    
    # Apply economic factors based on year
    if year == 2022:
        if month in ECONOMIC_FACTORS['2022_crisis']['months']:
            base_multiplier *= ECONOMIC_FACTORS['2022_crisis']['impact']
    elif year == 2023:
        base_multiplier *= ECONOMIC_FACTORS['2023_recovery']['impact']
    elif year == 2024:
        base_multiplier *= ECONOMIC_FACTORS['2024_growth']['impact']
    
    return base_multiplier

def get_growth_rate(category: str) -> float:
    """
    Get annual growth rate for category
    """
    category_pattern = CATEGORY_SEASONALITY.get(category, CATEGORY_SEASONALITY['raw_materials'])
    return category_pattern.get('growth_rate', 0.02)
