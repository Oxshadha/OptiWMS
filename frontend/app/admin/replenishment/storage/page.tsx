"use client";

import React from 'react';
import StorageOptimizerDashboard from '../components/StorageOptimizerDashboard';

export default function StorageOptimizerPage() {
    return (
        <div className="p-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Forecast-Aware Re-Slotting</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Detects significant shifts in demand volatility to trigger Genetic Algorithm warehouse re-slotting.
                </p>
            </div>
            
            <StorageOptimizerDashboard />
        </div>
    );
}
