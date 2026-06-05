"use client";

import React from 'react';
import ReplenishmentDashboard from './components/ReplenishmentDashboard';

export default function ReplenishmentPage() {
    return (
        <div className="p-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Replenishment Planner</h1>
                <p className="text-sm text-gray-500 mt-1">
                    AI-driven inventory advisory system balancing stockouts, holding costs, and supplier constraints.
                </p>
            </div>
            
            <ReplenishmentDashboard />
        </div>
    );
}
