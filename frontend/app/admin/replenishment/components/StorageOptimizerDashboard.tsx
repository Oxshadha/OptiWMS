"use client";

import React, { useState } from 'react';
import clsx from 'clsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

export default function StorageOptimizerDashboard() {
    const [selectedInterval, setSelectedInterval] = useState('6 Months');

    // 1. Next Review Preferences & Countdown Data
    const reviewCycle = {
        category: "A-Class / High Volume",
        interval: selectedInterval,
        nextReviewDate: selectedInterval === '3 Months' ? "2026-03-15" : (selectedInterval === '1 Month' ? "2026-02-01" : "2026-06-17"),
        daysRemaining: selectedInterval === '3 Months' ? 4 : (selectedInterval === '1 Month' ? 1 : 12),
        status: selectedInterval === '3 Months' || selectedInterval === '1 Month' ? "Urgent" : "Approaching"
    };

    // 2. Mock Micro-Adjustment Engine (Capacity constraints)
    const microAdjustments = [
        {
            id: 1,
            skuToExpand: "SKU-10901 (Premium Widget)",
            poQty: "2,000 Units (6 mo)",
            spaceRequired: "14.2 m³",
            spaceAvailable: "8.0 m³",
            skuToCompress: "SKU-50992 (Discontinued)",
            freedSpace: "+ 6.5 m³",
            action: "Swap Bins & Compress",
            impact: "Prevents 1.8M LKR Stockout"
        },
        {
            id: 2,
            skuToExpand: "SKU-44021 (Copper Wire)",
            poQty: "5,000 Units (6 mo)",
            spaceRequired: "22.0 m³",
            spaceAvailable: "18.0 m³",
            skuToCompress: "SKU-88210 (Seasonal End)",
            freedSpace: "+ 5.0 m³",
            action: "Relocate to Top Rack",
            impact: "Maintains 25% bulk discount"
        }
    ];

    // 3. Liquidation / Expiry Center
    const deadStockItems = [
        { id: 1, sku: 'SKU-50992', type: 'Finished Good', qty: 150, value: '120k LKR', issue: 'Zero demand in 90 days', actionRec: 'Run 20% Discount Promo' },
        { id: 2, sku: 'RAW-0019', type: 'Raw Material', qty: 800, value: '50k LKR', issue: 'Expiring in 45 days', actionRec: 'Return to Vendor (RTV)' },
        { id: 3, sku: 'PKG-110', type: 'Packaging', qty: 2500, value: '10k LKR', issue: 'Obsolete branding', actionRec: 'Scrap & Recycle' }
    ];

    // 4. Replenishment History (Past cycles based on selection)
    const historyData: Record<string, any[]> = {
        '6 Months': [
            { cycle: 'H1 2026', date: 'Jan 15, 2026', decision: 'Ordered 1,500 SKU-10901', spaceAction: 'Compressed Zone C', outcome: 'Success: 0 Stockouts' },
            { cycle: 'H2 2025', date: 'Jul 10, 2025', decision: 'Ordered 800 SKU-20042', spaceAction: 'No action needed', outcome: 'Warning: 10% Overstock' },
            { cycle: 'H1 2025', date: 'Jan 12, 2025', decision: 'Liquidated 500 SKU-Z', spaceAction: 'Freed 12m³ in Zone A', outcome: 'Success: Space Reclaimed' },
        ],
        '3 Months': [
            { cycle: 'Q1 2026', date: 'Jan 05, 2026', decision: 'Ordered 400 SKU-10901', spaceAction: 'Moved to Zone B', outcome: 'Success: Handled Surge' },
            { cycle: 'Q4 2025', date: 'Oct 01, 2025', decision: 'Paused SKU-44021', spaceAction: 'No action needed', outcome: 'Warning: Slight Deficit' },
            { cycle: 'Q3 2025', date: 'Jul 05, 2025', decision: 'Liquidated 200 RAW-0019', spaceAction: 'Freed 5m³ in Zone B', outcome: 'Success: Avoided Expiry' },
        ],
        '1 Month': [
            { cycle: 'Jan 2026', date: 'Jan 01, 2026', decision: 'Ordered 100 Fast-Movers', spaceAction: 'Micro-adjust Zone A', outcome: 'Success' },
            { cycle: 'Dec 2025', date: 'Dec 01, 2025', decision: 'Holiday Surge Prep', spaceAction: 'Expanded Zone A by 10%', outcome: 'Success' },
        ],
        '12 Months': [
            { cycle: '2026 Annual', date: 'Jan 20, 2026', decision: 'Massive Raw Material PO', spaceAction: 'Full Zone C Reallocation', outcome: 'Pending' },
            { cycle: '2025 Annual', date: 'Jan 15, 2025', decision: 'Standard Annual Restock', spaceAction: 'No action needed', outcome: 'Success' },
        ]
    };
    const history = historyData[selectedInterval] || historyData['6 Months'];

    // Chart Data: GA Rack Capacity Utilization
    const capacityData = [
        { name: 'Zone A (Fast)', capacity: 100, currentUsage: 98, projectedUsage: 115, afterAdjustment: 95 },
        { name: 'Zone B (Medium)', capacity: 100, currentUsage: 70, projectedUsage: 75, afterAdjustment: 85 },
        { name: 'Zone C (Slow/Dead)', capacity: 100, currentUsage: 85, projectedUsage: 85, afterAdjustment: 40 },
    ];

    return (
        <div className="space-y-6">
            
            {/* Top Row: Countdown & History */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Countdown Panel */}
                <div className="bg-base-100 dark:bg-base-200 p-6 rounded-2xl shadow-sm border border-base-300 dark:border-base-700 border-l-4 border-l-info">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-info text-xl">event_upcoming</span>
                                <h3 className="text-xl font-bold text-base-content">Next Procurement Cycle</h3>
                            </div>
                            <select 
                                className="select select-bordered select-sm w-full max-w-xs mt-2 bg-base-100 text-base-content font-semibold"
                                value={selectedInterval}
                                onChange={(e) => setSelectedInterval(e.target.value)}
                            >
                                <option value="1 Month">1 Month Cycle</option>
                                <option value="3 Months">3 Months Cycle</option>
                                <option value="6 Months">6 Months Cycle</option>
                                <option value="12 Months">Annual Cycle (12 Mo)</option>
                            </select>
                        </div>
                        <div className={clsx("badge font-bold border-none text-white", reviewCycle.status === 'Urgent' ? 'bg-error' : 'bg-warning text-yellow-900')}>
                            {reviewCycle.status}
                        </div>
                    </div>
                    
                    <div className="flex items-end gap-4 mt-6">
                        <div className="text-5xl font-extrabold text-base-content">{reviewCycle.daysRemaining}</div>
                        <div className="text-lg font-medium text-base-content/60 mb-1">Days</div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-base-200 dark:border-base-300 flex justify-between text-sm">
                        <span className="text-base-content/60">Target Category:</span>
                        <span className="font-semibold text-base-content">{reviewCycle.category}</span>
                    </div>
                </div>

                {/* History Panel */}
                <div className="bg-base-100 dark:bg-base-200 p-6 rounded-2xl shadow-sm border border-base-200 dark:border-base-700 lg:col-span-2">
                    <h3 className="text-lg font-bold text-base-content mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-base-content/50">history</span>
                        Historical {selectedInterval} Decisions
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="text-base-content/60 uppercase text-xs">
                                <tr>
                                    <th className="pb-2 font-semibold">Cycle</th>
                                    <th className="pb-2 font-semibold">Key Decision</th>
                                    <th className="pb-2 font-semibold">Space Action</th>
                                    <th className="pb-2 font-semibold text-right">Outcome</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-base-200 dark:divide-base-300">
                                {history.map((h, i) => (
                                    <tr key={i} className="text-base-content">
                                        <td className="py-3">
                                            <div className="font-semibold">{h.cycle}</div>
                                            <div className="text-xs text-base-content/50">{h.date}</div>
                                        </td>
                                        <td className="py-3 font-medium">{h.decision}</td>
                                        <td className="py-3 text-base-content/70">{h.spaceAction}</td>
                                        <td className="py-3 text-right">
                                            <span className={clsx(
                                                "text-xs font-bold px-2 py-1 rounded",
                                                h.outcome.includes('Success') ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'
                                            )}>{h.outcome}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Middle Row: Micro-Adjustment Engine & Capacity Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Adjustments Table */}
                <div className="bg-base-100 dark:bg-base-200 p-6 rounded-2xl shadow-sm border border-base-200 dark:border-base-700">
                    <div className="mb-4">
                        <h3 className="text-xl font-bold text-base-content">Capacity Micro-Adjustments</h3>
                        <p className="text-sm text-base-content/60 mt-1">Resolving rack space deficits for the upcoming 6-month bulk orders.</p>
                    </div>
                    
                    <div className="space-y-4 mt-6">
                        {microAdjustments.map((adj) => (
                            <div key={adj.id} className="p-4 border border-base-300 dark:border-base-600 rounded-xl bg-base-50 dark:bg-base-300/30">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <div className="text-xs font-bold text-success uppercase tracking-wider mb-1">Expand Request</div>
                                        <div className="font-bold text-base-content">{adj.skuToExpand}</div>
                                        <div className="text-sm text-base-content/70">Bulk PO: {adj.poQty}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-bold text-error uppercase tracking-wider mb-1">Space Deficit</div>
                                        <div className="font-bold text-error">{adj.spaceRequired} required</div>
                                        <div className="text-sm text-base-content/70">Only {adj.spaceAvailable} available</div>
                                    </div>
                                </div>
                                
                                <div className="bg-base-200 dark:bg-base-100 p-3 rounded-lg flex items-center justify-between border border-base-300 dark:border-base-700">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-warning">compress</span>
                                        <div>
                                            <div className="text-sm font-semibold text-base-content">Action: {adj.action}</div>
                                            <div className="text-xs text-base-content/60">Target: {adj.skuToCompress}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-bold text-success">{adj.freedSpace}</div>
                                        <button className="text-xs text-info hover:underline mt-1">{adj.impact}</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Capacity Chart */}
                <div className="bg-base-100 dark:bg-base-200 p-6 rounded-2xl shadow-sm border border-base-200 dark:border-base-700">
                    <div className="mb-4">
                        <h3 className="text-xl font-bold text-base-content">GA Rack Utilization Impact</h3>
                        <p className="text-sm text-base-content/60 mt-1">Visualizing space utilization % before and after the micro-adjustments.</p>
                    </div>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={capacityData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="name" tick={{fontSize: 12}} />
                                <YAxis tick={{fontSize: 12}} domain={[0, 120]} />
                                <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                                <Legend wrapperStyle={{fontSize: '12px', marginTop: '10px'}} />
                                
                                <ReferenceLine y={100} label={{ position: 'top', value: '100% Max Physical Capacity', fontSize: 10, fill: '#ef4444' }} stroke="#ef4444" strokeDasharray="3 3" />
                                
                                <Bar dataKey="projectedUsage" name="Projected (Without Adjustment)" fill="#ef4444" radius={[4, 4, 0, 0]} opacity={0.5} />
                                <Bar dataKey="afterAdjustment" name="Optimized (After Micro-Adjustments)" fill="#39BE7D" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Bottom Row: Liquidation / Dead-Stock Center */}
            <div className="bg-base-100 dark:bg-base-200 p-6 rounded-2xl shadow-sm border border-base-300 dark:border-base-700 border-l-4 border-l-error">
                <div className="flex justify-between items-end mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-base-content">Liquidation & Expiry Action Center</h3>
                        <p className="text-sm text-base-content/60 mt-1">Mandatory actions to clear physical rack space before the next bulk delivery arrives.</p>
                    </div>
                    <button className="btn btn-outline btn-error btn-sm">Generate Liquidation Report</button>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-base-content/80">
                        <thead className="bg-base-200 dark:bg-base-300 text-base-content uppercase text-xs tracking-wider">
                            <tr>
                                <th className="px-4 py-3 rounded-tl-lg font-semibold">SKU / Item</th>
                                <th className="px-4 py-3 font-semibold">Material Type</th>
                                <th className="px-4 py-3 font-semibold">Quantity / Value Trapped</th>
                                <th className="px-4 py-3 font-semibold text-error">Core Issue</th>
                                <th className="px-4 py-3 rounded-tr-lg font-semibold">AI Recommendation</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-base-200 dark:divide-base-300">
                            {deadStockItems.map((item) => (
                                <tr key={item.id} className="hover:bg-base-200/50 transition-colors">
                                    <td className="px-4 py-4 font-bold text-info cursor-pointer hover:underline">
                                        {item.sku}
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="badge badge-neutral text-xs font-bold border-none text-white">{item.type}</div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="font-bold text-base-content">{item.qty} units</div>
                                        <div className="text-xs text-base-content/50">{item.value}</div>
                                    </td>
                                    <td className="px-4 py-4 font-semibold text-error">{item.issue}</td>
                                    <td className="px-4 py-4">
                                        <div className="flex gap-2">
                                            <button className="btn btn-sm btn-neutral text-white">{item.actionRec}</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}
