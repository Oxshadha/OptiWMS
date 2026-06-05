"use client";

import React, { useState } from 'react';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
    ScatterChart, Scatter, ZAxis, Cell, ComposedChart, BarChart, Bar, Line, Legend
} from 'recharts';
import clsx from 'clsx';

export default function ReplenishmentDashboard() {
    const [selectedSku, setSelectedSku] = useState<any>({ 
        id: 1, sku: 'SKU-10901', name: 'Premium Widget', current: 120, rop: 500, qty: 1500, value: '1.8M LKR', risk: 'High', status: 'Pending' 
    });
    
    const [searchQuery, setSearchQuery] = useState('');
    const [filterClass, setFilterClass] = useState('All');

    // Advanced Executive KPIs
    const kpis = {
        revenueAtRisk: "2.8M LKR",
        capitalTiedUp: "1.4M LKR",
        avgFillRate: "94.2%",
        projectedFillRate: "98.5%",
    };

    // Realistic Scatter Data (Volatility vs Annual Value)
    // X = Volatility (CoV), Y = Annual Value (LKR), Z = Bubble Size (Order Qty)
    const scatterData = [
        { sku: 'SKU-10901', volatility: 0.8, value: 5000000, qty: 1500, class: 'Critical' },
        { sku: 'SKU-10905', volatility: 0.6, value: 3000000, qty: 800, class: 'Monitor' },
        { sku: 'SKU-20042', volatility: 0.9, value: 4500000, qty: 1200, class: 'Critical' },
        { sku: 'SKU-33211', volatility: 0.2, value: 1000000, qty: 300, class: 'Healthy' },
        { sku: 'SKU-10912', volatility: 0.4, value: 500000, qty: 100, class: 'Healthy' },
        { sku: 'SKU-88210', volatility: 0.7, value: 800000, qty: 400, class: 'Monitor' },
        { sku: 'SKU-44021', volatility: 0.85, value: 2000000, qty: 650, class: 'Critical' },
    ];

    // Table Data
    const recommendedOrders = [
        { id: 1, sku: 'SKU-10901', name: 'Premium Widget', current: 120, rop: 500, qty: 1500, value: '1.8M LKR', risk: 'High', status: 'Pending' },
        { id: 2, sku: 'SKU-20042', name: 'Industrial Motor', current: 15, rop: 50, qty: 200, value: '1.2M LKR', risk: 'High', status: 'Pending' },
        { id: 3, sku: 'SKU-10905', name: 'Standard Widget', current: 40, rop: 100, qty: 400, value: '200k LKR', risk: 'Medium', status: 'Pending' },
        { id: 4, sku: 'SKU-44021', name: 'Copper Wiring', current: 200, rop: 600, qty: 1000, value: '500k LKR', risk: 'Medium', status: 'Approved' },
    ];

    // Projection Chart Data (Historical + Forecast)
    const projectionData = [
        { day: 'Day -14', actual: 800 },
        { day: 'Day -10', actual: 650 },
        { day: 'Day -5', actual: 500 },
        { day: 'Today', actual: 380, projected_no_action: 380, projected_with_action: 380 },
        { day: 'Day +5', projected_no_action: 250, projected_with_action: 250 },
        { day: 'Day +10 (Delivery)', projected_no_action: 100, projected_with_action: 1600 },
        { day: 'Day +15', projected_no_action: -50, projected_with_action: 1450 },
        { day: 'Day +20', projected_no_action: -200, projected_with_action: 1300 },
    ];

    // XAI Waterfall Data
    const waterfallData = [
        { name: 'Stock Deficit', value: 380, fill: '#3b82f6' }, 
        { name: 'Safety Buffer', value: 150, fill: '#60a5fa' },
        { name: 'EOQ Efficiency', value: 670, fill: '#10b981' }, 
        { name: 'Bulk Discount', value: 300, fill: '#8b5cf6' },  
        { name: 'Final Qty', value: 1500, fill: '#1e3a8a' }, 
    ];

    const getRiskColor = (volatility: number) => {
        if (volatility > 0.7) return '#ef4444'; // red-500
        if (volatility > 0.5) return '#f59e0b'; // amber-500
        return '#10b981'; // green-500
    };

    return (
        <div className="space-y-6 text-base-content">
            {/* KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-base-100 dark:bg-base-200 p-6 rounded-2xl shadow-sm border border-base-300 dark:border-base-700 border-l-4 border-l-error relative overflow-hidden group">
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-red-500 text-sm">warning</span>
                            <p className="text-sm font-semibold text-base-content/60 uppercase tracking-wider">Revenue at Risk (30d)</p>
                        </div>
                        <p className="text-4xl font-bold text-red-600 dark:text-red-400">{kpis.revenueAtRisk}</p>
                        <p className="text-xs text-base-content/50 mt-2">Value of projected stockouts across 12 critical SKUs if POs are ignored.</p>
                    </div>
                </div>

                <div className="bg-base-100 dark:bg-base-200 p-6 rounded-2xl shadow-sm border border-base-300 dark:border-base-700 border-l-4 border-l-warning relative overflow-hidden group">
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-amber-500 text-sm">inventory</span>
                            <p className="text-sm font-semibold text-base-content/60 uppercase tracking-wider">Capital in Excess Stock</p>
                        </div>
                        <p className="text-4xl font-bold text-amber-600 dark:text-amber-400">{kpis.capitalTiedUp}</p>
                        <p className="text-xs text-base-content/50 mt-2">Wasted holding capital on SKUs significantly above optimal EOQ levels.</p>
                    </div>
                </div>

                <div className="bg-base-100 dark:bg-base-200 p-6 rounded-2xl shadow-sm border border-base-300 dark:border-base-700 border-l-4 border-l-success relative overflow-hidden group">
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-green-500 text-sm">trending_up</span>
                            <p className="text-sm font-semibold text-base-content/60 uppercase tracking-wider">Fill Rate Projection</p>
                        </div>
                        <div className="flex items-end gap-3">
                            <p className="text-4xl font-bold text-green-600 dark:text-green-400">{kpis.projectedFillRate}</p>
                            <p className="text-sm text-base-content/50 mb-1 line-through">{kpis.avgFillRate}</p>
                        </div>
                        <p className="text-xs text-base-content/50 mt-2">Projected service level across all fulfillment zones upon PO approval.</p>
                    </div>
                </div>
            </div>

            {/* Main Visualizations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* 1. Risk vs Value Scatter Plot */}
                <div className="bg-base-100 dark:bg-base-200 p-6 rounded-2xl shadow-sm border border-base-200 dark:border-base-300">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-xl font-bold text-base-content">Portfolio Risk Analysis</h3>
                            <p className="text-sm text-base-content/60 mt-1">
                                Identifying high-value items with highly erratic demand (Top Right).
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                placeholder="Search SKU..." 
                                className="input input-bordered input-sm w-36 bg-base-100"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <select 
                                className="select select-bordered select-sm bg-base-100"
                                value={filterClass}
                                onChange={(e) => setFilterClass(e.target.value)}
                            >
                                <option value="All">All Classes</option>
                                <option value="Critical">Critical</option>
                                <option value="Monitor">Monitor</option>
                                <option value="Healthy">Healthy</option>
                            </select>
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                                <XAxis type="number" dataKey="volatility" name="Demand Volatility (CoV)" tick={{fontSize: 12}} domain={[0, 1]} label={{ value: 'Volatility (Risk)', position: 'bottom', offset: 0, fontSize: 12 }} />
                                <YAxis type="number" dataKey="value" name="Annual Value" tickFormatter={(v) => `${v/1000000}M`} tick={{fontSize: 12}} label={{ value: 'Annual Value (LKR)', angle: -90, position: 'left', fontSize: 12 }} />
                                <ZAxis type="number" dataKey="qty" range={[60, 400]} name="Order Qty" />
                                <Tooltip cursor={{strokeDasharray: '3 3'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} formatter={(value, name) => name === 'Annual Value' ? `${value} LKR` : value} />
                                <Scatter name="SKUs" data={scatterData}>
                                    {scatterData.map((entry, index) => {
                                        const matchesSearch = searchQuery === '' || entry.sku.toLowerCase().includes(searchQuery.toLowerCase());
                                        const matchesFilter = filterClass === 'All' || entry.class === filterClass;
                                        const isHighlighted = matchesSearch && matchesFilter;
                                        
                                        const isFaded = (!isHighlighted) && (searchQuery !== '' || filterClass !== 'All');

                                        return (
                                            <Cell 
                                                key={`cell-${index}`} 
                                                fill={isFaded ? '#cbd5e1' : getRiskColor(entry.volatility)} 
                                                opacity={isFaded ? 0.2 : 0.9} 
                                            />
                                        );
                                    })}
                                </Scatter>
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Stock Projection Chart (Dynamic) */}
                <div className="bg-base-100 dark:bg-base-200 p-6 rounded-2xl shadow-sm border border-base-200 dark:border-base-300">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-xl font-bold text-base-content">Stockout Projection {selectedSku ? `(${selectedSku.sku})` : '(SKU-10901)'}</h3>
                            <p className="text-sm text-base-content/60 mt-1">
                                AI forecast visualization demonstrating the impact of the proposed PO.
                            </p>
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={projectionData} margin={{ top: 20, right: 20, bottom: 0, left: -10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                                <XAxis dataKey="day" tick={{fontSize: 12}} />
                                <YAxis tick={{fontSize: 12}} />
                                <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                                <Legend wrapperStyle={{fontSize: '12px', marginTop: '10px'}} />
                                
                                <ReferenceLine y={100} label={{ position: 'top', value: 'Safety Stock', fontSize: 10, fill: '#ef4444' }} stroke="#ef4444" strokeDasharray="3 3" />
                                
                                {/* Historical */}
                                <Line type="monotone" dataKey="actual" name="Actual Stock" stroke="#6b7280" strokeWidth={3} dot={{r: 4}} />
                                
                                {/* Danger Zone Without Action */}
                                <Line type="monotone" dataKey="projected_no_action" name="Projected (Ignored)" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                
                                {/* Optimal with Action */}
                                <Area type="monotone" dataKey="projected_with_action" name="Projected (Approved PO)" fill="#10b981" fillOpacity={0.1} stroke="#10b981" strokeWidth={3} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Actionable Table & XAI Waterfall Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Recommendations Table */}
                <div className="bg-base-100 dark:bg-base-200 p-6 rounded-2xl shadow-sm border border-base-200 dark:border-base-300 lg:col-span-2">
                    <h3 className="text-xl font-bold text-base-content mb-6">AI Procurement Recommendations</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-base-content/80">
                            <thead className="bg-base-200 dark:bg-base-300 text-base-content uppercase text-xs tracking-wider">
                                <tr>
                                    <th className="px-4 py-3 rounded-tl-lg font-semibold">SKU / Item</th>
                                    <th className="px-4 py-3 font-semibold">Risk Lvl</th>
                                    <th className="px-4 py-3 font-semibold">Stock vs ROP</th>
                                    <th className="px-4 py-3 font-semibold">PO Qty</th>
                                    <th className="px-4 py-3 font-semibold">LKR Value</th>
                                    <th className="px-4 py-3 rounded-tr-lg font-semibold">Decision</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-base-200 dark:divide-base-300">
                                {recommendedOrders.map((order) => (
                                    <tr key={order.id} className="hover:bg-base-200/50 transition-colors">
                                        <td className="px-4 py-4">
                                            <div className="font-bold text-info cursor-pointer hover:underline" onClick={() => setSelectedSku(order)}>{order.sku}</div>
                                            <div className="text-xs text-base-content/50">{order.name}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className={clsx(
                                                "badge font-bold border-none text-white shadow-sm",
                                                order.risk === 'High' ? 'bg-error' : 'bg-warning text-yellow-900'
                                            )}>{order.risk}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="text-error font-bold">{order.current}</span>
                                            <span className="text-base-content/40 mx-1">/</span>
                                            <span className="text-base-content/70">{order.rop}</span>
                                        </td>
                                        <td className="px-4 py-4 font-bold text-lg text-base-content">{order.qty}</td>
                                        <td className="px-4 py-4 font-medium">{order.value}</td>
                                        <td className="px-4 py-4">
                                            {order.status === 'Pending' ? (
                                                <div className="flex gap-2">
                                                    <button className="btn btn-sm btn-success text-white">Approve</button>
                                                    <button 
                                                        className="btn btn-sm btn-outline btn-neutral"
                                                        onClick={() => setSelectedSku(order)}
                                                    >
                                                        Review Math
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="flex items-center text-green-600 font-bold text-sm">
                                                    <span className="material-symbols-outlined mr-1 text-base">check_circle</span>
                                                    Approved
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Explainable AI Sidebar Panel */}
                <div className={clsx(
                    "bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/20 dark:to-base-200 p-6 rounded-2xl shadow-sm border border-blue-200 dark:border-blue-900/50 transition-all duration-500",
                    selectedSku ? "opacity-100 translate-y-0" : "opacity-50 grayscale pointer-events-none"
                )}>
                    <div className="flex items-center gap-2 mb-4">
                        <span className="material-symbols-outlined text-blue-600">psychology</span>
                        <h3 className="text-xl font-bold text-blue-900 dark:text-blue-400">Explainable AI</h3>
                    </div>
                    
                    <p className="text-sm text-base-content/70 leading-relaxed mb-6">
                        {selectedSku ? (
                            <>
                                System Confidence: <span className="text-green-600 font-bold">96%</span>. <br/><br/>
                                The {selectedSku.qty} unit recommendation covers the stock deficit of 380 and maintains a probabilistic safety buffer of 150. 
                                Quantity was increased by 670 to meet Economic Order Quantity efficiencies, and bumped by 300 to hit the bulk discount threshold.
                            </>
                        ) : (
                            "Select an item from the table to view the exact mathematical breakdown of the AI's purchase order recommendation."
                        )}
                    </p>

                    <div className="h-[250px] w-full bg-white/50 dark:bg-base-300/50 rounded-xl p-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={waterfallData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} tick={{fill: '#6b7280', fontSize: 11, fontWeight: 500}} axisLine={false} tickLine={false} />
                                <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                                <Bar dataKey="value" barSize={24} radius={[0, 4, 4, 0]}>
                                    {waterfallData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>
        </div>
    );
}
