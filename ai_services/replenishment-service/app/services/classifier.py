import pandas as pd
import numpy as np
from typing import List, Dict, Any

class InventoryClassifier:
    """
    Implements ABC-XYZ inventory classification.
    ABC is based on Pareto principle (revenue/volume).
    XYZ is based on demand variability (Coefficient of Variation).
    """
    
    def __init__(self, a_threshold=0.80, b_threshold=0.95, x_cov_threshold=0.5, y_cov_threshold=1.0):
        self.a_threshold = a_threshold
        self.b_threshold = b_threshold
        self.x_cov_threshold = x_cov_threshold
        self.y_cov_threshold = y_cov_threshold

    def classify(self, historical_demand: List[Dict[str, Any]]) -> pd.DataFrame:
        """
        historical_demand should be a list of dicts with:
        {'sku': 'str', 'revenue': float, 'demand': float, 'period': 'str'}
        """
        df = pd.DataFrame(historical_demand)
        if df.empty:
            return pd.DataFrame()
            
        # 1. ABC Classification
        sku_revenue = df.groupby('sku')['revenue'].sum().reset_index()
        sku_revenue = sku_revenue.sort_values(by='revenue', ascending=False)
        
        total_rev = sku_revenue['revenue'].sum()
        sku_revenue['cum_rev'] = sku_revenue['revenue'].cumsum()
        sku_revenue['cum_rev_pct'] = sku_revenue['cum_rev'] / total_rev if total_rev > 0 else 0
        
        def assign_abc(pct):
            if pct <= self.a_threshold:
                return 'A'
            elif pct <= self.b_threshold:
                return 'B'
            else:
                return 'C'
                
        sku_revenue['abc_class'] = sku_revenue['cum_rev_pct'].apply(assign_abc)
        
        # 2. XYZ Classification
        sku_stats = df.groupby('sku')['demand'].agg(['mean', 'std']).reset_index()
        sku_stats['cov'] = sku_stats['std'] / sku_stats['mean'].replace(0, np.nan)
        sku_stats['cov'] = sku_stats['cov'].fillna(0) # handle 0 variance or mean
        
        def assign_xyz(cov):
            if cov < self.x_cov_threshold:
                return 'X'
            elif cov < self.y_cov_threshold:
                return 'Y'
            else:
                return 'Z'
                
        sku_stats['xyz_class'] = sku_stats['cov'].apply(assign_xyz)
        
        # Merge results
        result = pd.merge(sku_revenue, sku_stats, on='sku')
        result['combined_class'] = result['abc_class'] + result['xyz_class']
        
        # Assign Service Levels
        def assign_service_level(abc_class):
            if abc_class == 'A':
                return 0.98
            elif abc_class == 'B':
                return 0.95
            else:
                return 0.90
                
        result['service_level_target'] = result['abc_class'].apply(assign_service_level)
        
        return result
