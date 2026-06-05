"use client";

import React, { useState, useEffect } from 'react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
    LineChart, Line, Area, AreaChart
} from 'recharts';

export default function ReplenishmentDashboard() {
    // Mock Data based on the AI engine output
    const [selectedSku, setSelectedSku] = useState(null);
    
    const kpis = {
        healthScore: 88,
        itemsBelowRop: 12,
        totalOrderValue: "4.2M LKR",
        avgDaysCover: 45
    };

    const abcXyzMatrix = [
        { id: 'AX', class: 'AX', count: 15, rev: 'High', var: 'Low', color: 'bg-green-100 border-green-500 text-green-700' },
        { id: 'AY', class: 'AY', count: 8, rev: 'High', var: 'Med', color: 'bg-green-100 border-green-400 text-green-700' },
        { id: 'AZ', class: 'AZ', count: 3, rev: 'High', var: 'High', color: 'bg-yellow-100 border-yellow-500 text-yellow-700' },
        { id: 'BX', class: 'BX', count: 42, rev: 'Med', var: 'Low', color: 'bg-green-50 border-green-300 text-green-600' },
        { id: 'BY', class: 'BY', count: 28, rev: 'Med', var: 'Med', color: 'bg-yellow-50 border-yellow-400 text-yellow-600' },
        { id: 'BZ', class: 'BZ', count: 12, rev: 'Med', var: 'High', color: 'bg-orange-100 border-orange-500 text-orange-700' },
        { id: 'CX', class: 'CX', count: 120, rev: 'Low', var: 'Low', color: 'bg-gray-100 border-gray-300 text-gray-600' },
        { id: 'CY', class: 'CY', count: 85, rev: 'Low', var: 'Med', color: 'bg-gray-100 border-gray-400 text-gray-600' },
        { id: 'CZ', class: 'CZ', count: 45, rev: 'Low', var: 'High', color: 'bg-red-50 border-red-400 text-red-600' },
    ];

    const recommendedOrders = [
        { id: 1, sku: 'SKU-10901', name: 'Premium Widget', class: 'AX', current: 120, rop: 500, qty: 1500, value: '1.8M LKR', status: 'Pending' },
        { id: 2, sku: 'SKU-10905', name: 'Standard Widget', class: 'BY', current: 40, rop: 100, qty: 400, value: '200k LKR', status: 'Pending' },
        { id: 3, sku: 'SKU-10912', name: 'Basic Component', class: 'CZ', current: 5, rop: 20, qty: 100, value: '15k LKR', status: 'Approved' },
    ];

    const waterfallData = [
        { name: 'Stock Deficit', value: 380, fill: '#3b82f6' }, // blue-500
        { name: 'Safety Buffer', value: 150, fill: '#3b82f6' },
        { name: 'EOQ Adjustment', value: 670, fill: '#10b981' }, // green-500
        { name: 'Bulk Discount', value: 300, fill: '#8b5cf6' },  // violet-500
        { name: 'Final Qty', value: 1500, fill: '#1e3a8a' }, // blue-900
    ];

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-blue-500">
                    <p className="text-sm font-medium text-gray-500">Warehouse Health Score</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{kpis.healthScore}%</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-red-500">
                    <p className="text-sm font-medium text-gray-500">Items Below ROP</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{kpis.itemsBelowRop}</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-green-500">
                    <p className="text-sm font-medium text-gray-500">Total Draft Order Value</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{kpis.totalOrderValue}</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-purple-500">
                    <p className="text-sm font-medium text-gray-500">Avg Days Cover</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{kpis.avgDaysCover}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ABC-XYZ Matrix */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 col-span-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">ABC-XYZ Classification Matrix</h3>
                    <div className="grid grid-cols-4 gap-2 text-center text-sm">
                        <div className="col-span-1"></div>
                        <div className="font-semibold text-gray-500">X (Stable)</div>
                        <div className="font-semibold text-gray-500">Y (Variable)</div>
                        <div className="font-semibold text-gray-500">Z (Erratic)</div>
                        
                        <div className="font-semibold text-gray-500 flex items-center justify-end pr-2">A (High Val)</div>
                        {abcXyzMatrix.slice(0,3).map(cell => (
                            <div key={cell.id} className={`${cell.color} border-2 rounded-lg p-3 flex flex-col items-center justify-center cursor-pointer hover:opacity-80 transition-opacity`}>
                                <span className="font-bold">{cell.class}</span>
                                <span className="text-xs mt-1">{cell.count} SKUs</span>
                            </div>
                        ))}
                        
                        <div className="font-semibold text-gray-500 flex items-center justify-end pr-2">B (Med Val)</div>
                        {abcXyzMatrix.slice(3,6).map(cell => (
                            <div key={cell.id} className={`${cell.color} border-2 rounded-lg p-3 flex flex-col items-center justify-center cursor-pointer hover:opacity-80 transition-opacity`}>
                                <span className="font-bold">{cell.class}</span>
                                <span className="text-xs mt-1">{cell.count} SKUs</span>
                            </div>
                        ))}
                        
                        <div className="font-semibold text-gray-500 flex items-center justify-end pr-2">C (Low Val)</div>
                        {abcXyzMatrix.slice(6,9).map(cell => (
                            <div key={cell.id} className={`${cell.color} border-2 rounded-lg p-3 flex flex-col items-center justify-center cursor-pointer hover:opacity-80 transition-opacity`}>
                                <span className="font-bold">{cell.class}</span>
                                <span className="text-xs mt-1">{cell.count} SKUs</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Priority Orders Table */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 col-span-2">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Replenishment Recommendations</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-600">
                            <thead className="bg-gray-50 text-gray-700">
                                <tr>
                                    <th className="px-4 py-3 font-medium rounded-tl-lg">SKU</th>
                                    <th className="px-4 py-3 font-medium">Class</th>
                                    <th className="px-4 py-3 font-medium">Stock / ROP</th>
                                    <th className="px-4 py-3 font-medium">Suggested Qty</th>
                                    <th className="px-4 py-3 font-medium">Value</th>
                                    <th className="px-4 py-3 font-medium rounded-tr-lg">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recommendedOrders.map((order) => (
                                    <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-blue-600 cursor-pointer" onClick={() => setSelectedSku(order)}>
                                            {order.sku}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="bg-gray-100 px-2 py-1 rounded text-xs font-semibold">{order.class}</span>
                                        </td>
                                        <td className="px-4 py-3 text-red-500 font-medium">
                                            {order.current} <span className="text-gray-400 font-normal">/ {order.rop}</span>
                                        </td>
                                        <td className="px-4 py-3 font-bold text-gray-900">{order.qty}</td>
                                        <td className="px-4 py-3">{order.value}</td>
                                        <td className="px-4 py-3">
                                            {order.status === 'Pending' ? (
                                                <div className="flex gap-2">
                                                    <button className="bg-green-500 text-white px-3 py-1 rounded shadow-sm hover:bg-green-600 text-xs font-semibold transition-colors">
                                                        Approve
                                                    </button>
                                                    <button className="bg-white border border-gray-300 text-gray-700 px-3 py-1 rounded shadow-sm hover:bg-gray-50 text-xs font-semibold transition-colors"
                                                            onClick={() => setSelectedSku(order)}>
                                                        Why?
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-green-600 font-medium text-sm flex items-center">
                                                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
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
            </div>

            {/* XAI Waterfall Section */}
            {selectedSku && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-200 animate-fade-in-up">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">
                                Explainable AI: Why order {selectedSku.qty} units of {selectedSku.sku}?
                            </h3>
                            <p className="text-sm text-gray-500 mt-1 max-w-3xl">
                                System Confidence: <span className="text-green-600 font-bold">96%</span>. 
                                The recommendation covers the stock deficit of 380 and maintains a probabilistic safety buffer of 150. 
                                Quantity was increased by 670 to meet Economic Order Quantity (EOQ) efficiencies, and further adjusted by 300 to hit the 1500-unit bulk discount threshold.
                            </p>
                        </div>
                        <button 
                            className="text-gray-400 hover:text-gray-600"
                            onClick={() => setSelectedSku(null)}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>

                    <div className="h-72 w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={waterfallData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={120} tick={{fill: '#4b5563', fontSize: 13}} />
                                <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}} />
                                <Bar dataKey="value" barSize={30} radius={[0, 4, 4, 0]}>
                                    {waterfallData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    );
}
