'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SummaryCards } from './SummaryCards';
import { DataTable } from './DataTable';
import { StatusChip } from './StatusChip';
import { KpiTile } from './KpiTile';
import { ordersApi } from '@/lib/api/orders';
import { inventoryApi } from '@/lib/api/inventory';

interface StorageItem {
  id: string;
  name: string;
  quantity: number;
  category: string;
  source: string;
  location?: string;
  status: 'pending' | 'stored' | 'processing';
}

interface PickingOrder {
  id: string;
  order_id: string;
  customer: string;
  items_count: number;
  total_qty: number;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
  created_at: string;
}

export default function LogisticAgentDashboard() {
  const router = useRouter();
  const [storageItems, setStorageItems] = useState<StorageItem[]>([]);
  const [pickingOrders, setPickingOrders] = useState<PickingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<PickingOrder | null>(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Load initial data
  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      let loadedStorage: StorageItem[] = [];
      let loadedOrders: PickingOrder[] = [];

      try {
        // Fetch inventory items from API
        const inventoryItems = await inventoryApi.getAll();
        loadedStorage = inventoryItems.map(item => ({
          id: item.id,
          name: `Material #${item.materialId}`,
          quantity: parseInt(item.quantity || '0'),
          category: item.materialType || 'General',
          source: `LPN: ${item.lpnCode || item.locationCode || 'N/A'}`,
          location: item.locationCode,
          status: (item.status?.toLowerCase() as 'pending' | 'stored' | 'processing') || 'pending',
        }));
      } catch (invError) {
        console.warn('Failed to fetch inventory from API, using sample data:', invError);
        // Fallback to sample data
        loadedStorage = [
          {
            id: 'item-1',
            name: 'Fresh Vegetables',
            quantity: 75,
            category: 'Produce',
            source: 'Receiving #3',
            status: 'pending',
          },
          {
            id: 'item-2',
            name: 'Smartphone XYZ',
            quantity: 2,
            category: 'Electronics',
            source: 'Receiving #35',
            status: 'pending',
          },
          {
            id: 'item-3',
            name: 'Frozen Goods Batch A',
            quantity: 42,
            category: 'Frozen',
            source: 'Receiving #28',
            status: 'processing',
          },
        ];
      }

      try {
        // Fetch outbound orders from API
        const allOrders = await ordersApi.getAllOutbound();
        loadedOrders = allOrders.map((order, idx) => ({
          id: order.id,
          order_id: order.orderNumber || `#${idx + 1}`,
          customer: order.customerId || 'Unknown',
          items_count: 1,
          total_qty: 1,
          status: (order.status?.toLowerCase() === 'pending' ? 'pending' : 'in_progress') as 'pending' | 'in_progress' | 'completed',
          priority: (order.priority?.toLowerCase() as 'high' | 'medium' | 'low') || 'medium',
          created_at: order.orderDate || new Date().toLocaleDateString(),
        }));
      } catch (ordError) {
        console.warn('Failed to fetch orders from API, using sample data:', ordError);
        // Fallback to sample data
        loadedOrders = [
          {
            id: 'order-5',
            order_id: '#5',
            customer: 'Customer 1',
            items_count: 2,
            total_qty: 4,
            status: 'pending',
            priority: 'high',
            created_at: '7/25/2025',
          },
          {
            id: 'order-12',
            order_id: '#12',
            customer: 'Customer 2',
            items_count: 2,
            total_qty: 2,
            status: 'pending',
            priority: 'medium',
            created_at: '7/25/2025',
          },
          {
            id: 'order-8',
            order_id: '#8',
            customer: 'Customer 3',
            items_count: 3,
            total_qty: 8,
            status: 'pending',
            priority: 'medium',
            created_at: '7/24/2025',
          },
        ];
      }

      setStorageItems(loadedStorage);
      setPickingOrders(loadedOrders);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartPicking = (order: PickingOrder) => {
    setSelectedOrder(order);
    // Navigate to admin pathfinding with order context
    router.push(
      `/admin/pathfinding?orderId=${order.id}&customerId=${order.customer}`
    );
  };

  const handleStoreItem = async (item: StorageItem) => {
    try {
      // Call API to update item status
      // const res = await fetch(`/api/storage/${item.id}/store`, { method: 'POST' });
      console.log('Storing item:', item.id);
      // Update UI
      setStorageItems(prev =>
        prev.map(i => (i.id === item.id ? { ...i, status: 'stored' } : i))
      );
    } catch (error) {
      console.error('Failed to store item:', error);
    }
  };

  const handleRefresh = () => {
    loadDashboardData();
  };

  const pendingStorageCount = storageItems.filter(
    i => i.status === 'pending'
  ).length;
  const pendingOrdersCount = pickingOrders.filter(
    i => i.status === 'pending'
  ).length;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">
            Route Optimizer
          </h1>
          <p className="text-slate-400">
            Manage inventory and optimize picking routes
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-slate-400">Last updated:</p>
            <p className="text-lg font-semibold text-white">
              {formatTime(lastUpdated)}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg p-6 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-amber-100 text-sm font-medium">
                Available for Storing
              </p>
              <p className="text-4xl font-bold mt-2">{pendingStorageCount}</p>
            </div>
            <div className="text-4xl opacity-30">📦</div>
          </div>
          <p className="text-amber-100 text-xs mt-4">
            Newly received items awaiting storage
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">
                Pending Orders
              </p>
              <p className="text-4xl font-bold mt-2">{pendingOrdersCount}</p>
            </div>
            <div className="text-4xl opacity-30">🎯</div>
          </div>
          <p className="text-blue-100 text-xs mt-4">
            Orders ready for picking
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">
                In Progress
              </p>
              <p className="text-4xl font-bold mt-2">
                {storageItems.filter(i => i.status === 'processing').length}
              </p>
            </div>
            <div className="text-4xl opacity-30">⚡</div>
          </div>
          <p className="text-green-100 text-xs mt-4">
            Items being processed
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">
                Avg Pick Time
              </p>
              <p className="text-4xl font-bold mt-2">4.2m</p>
            </div>
            <div className="text-4xl opacity-30">⏱️</div>
          </div>
          <p className="text-purple-100 text-xs mt-4">
            Average picking time per order
          </p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Storage Items */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-4 border-b border-slate-200">
            <h2 className="text-xl font-bold text-white">
              Items Available for Storing
            </h2>
            <p className="text-slate-300 text-sm mt-1">
              Items ready to storage
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    ITEM
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    QTY
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    CATEGORY
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    SOURCE
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    ACTION
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {storageItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {item.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {item.quantity}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {item.source}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {item.status === 'pending' ? (
                        <button
                          onClick={() => handleStoreItem(item)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-xs"
                        >
                          Store
                        </button>
                      ) : (
                        <span className="text-green-600 font-medium text-xs">
                          {item.status === 'stored' ? '✓ Stored' : '⚡ Processing'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pending Orders */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-4 border-b border-slate-200">
            <h2 className="text-xl font-bold text-white">
              Pending Orders for Picking
            </h2>
            <p className="text-slate-300 text-sm mt-1">
              Orders ready for collection and packing
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    ORDER ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    CUSTOMER
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    ITEMS
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    TOTAL QTY
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    PRIORITY
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    ACTION
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pickingOrders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">
                      {order.order_id}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {order.customer}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {order.items_count} Items
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {order.total_qty}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${order.priority === 'high'
                            ? 'bg-red-100 text-red-700'
                            : order.priority === 'medium'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                      >
                        {order.priority.charAt(0).toUpperCase() +
                          order.priority.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => handleStartPicking(order)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-xs"
                      >
                        Start Picking →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Quick Stats Footer */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg p-4 shadow">
          <div className="text-slate-600 text-sm font-medium mb-2">
            Efficiency Rate
          </div>
          <div className="text-3xl font-bold text-green-600">94.2%</div>
          <div className="text-xs text-slate-500 mt-1">
            ↑ 2.3% from last week
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow">
          <div className="text-slate-600 text-sm font-medium mb-2">
            Orders Completed Today
          </div>
          <div className="text-3xl font-bold text-blue-600">24</div>
          <div className="text-xs text-slate-500 mt-1">
            Average: 18 per day
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow">
          <div className="text-slate-600 text-sm font-medium mb-2">
            Cost Savings
          </div>
          <div className="text-3xl font-bold text-purple-600">$2,340</div>
          <div className="text-xs text-slate-500 mt-1">
            Via optimized routes
          </div>
        </div>
      </div>
    </div>
  );
}
