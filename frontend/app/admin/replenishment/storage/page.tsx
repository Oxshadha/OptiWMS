"use client";

import React from 'react';
import StorageOptimizerDashboard from '../components/StorageOptimizerDashboard';

export default function StorageOptimizerPage() {
    return (
        <div className="p-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-base-content">Cyclical Storage & Liquidation Planner</h1>
                <p className="text-sm text-base-content/60 mt-2 max-w-4xl">
                    Long-term (3-6 month) capacity allocation engine. This module evaluates massive bulk purchase orders against 
                    physical Genetic Algorithm (GA) rack constraints, recommending dynamic space micro-adjustments and dead-stock liquidation to maximize warehouse density.
                </p>
            </div>
            
            <StorageOptimizerDashboard />
        </div>
    );
}
