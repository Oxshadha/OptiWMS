"use client";

import React, { useState } from 'react';
import clsx from 'clsx';
import ReplenishmentDashboard from './components/ReplenishmentDashboard';
import StorageOptimizerDashboard from './components/StorageOptimizerDashboard';

export default function ReplenishmentPage() {
    const [activeTab, setActiveTab] = useState<'replenishment' | 'storage'>('replenishment');

    return (
        <div className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-base-content">Intelligent Replenishment Engine</h1>
                    <p className="text-sm text-base-content/60 mt-2 max-w-4xl">
                        AI-driven inventory advisory balancing daily stockouts, holding costs, and long-term storage constraints.
                    </p>
                </div>
                
                {/* Tab Navigation */}
                <div className="bg-base-200 dark:bg-base-300 p-1 rounded-xl inline-flex shadow-sm">
                    <button 
                        onClick={() => setActiveTab('replenishment')}
                        className={clsx(
                            "px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300",
                            activeTab === 'replenishment' 
                                ? "bg-base-100 text-base-content shadow-sm" 
                                : "text-base-content/60 hover:text-base-content hover:bg-base-200"
                        )}
                    >
                        Replenishment Math
                    </button>
                    <button 
                        onClick={() => setActiveTab('storage')}
                        className={clsx(
                            "px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300",
                            activeTab === 'storage' 
                                ? "bg-base-100 text-base-content shadow-sm" 
                                : "text-base-content/60 hover:text-base-content hover:bg-base-200"
                        )}
                    >
                        Cyclical Storage & Liquidation
                    </button>
                </div>
            </div>
            
            {/* Render the selected dashboard */}
            {activeTab === 'replenishment' ? (
                <div className="animate-in fade-in duration-500">
                    <ReplenishmentDashboard />
                </div>
            ) : (
                <div className="animate-in fade-in duration-500">
                    <StorageOptimizerDashboard />
                </div>
            )}
            
        </div>
    );
}
