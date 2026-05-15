'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, MapPinIcon, CheckCircleIcon } from '@heroicons/react/20/solid';

interface FloorLevel {
  id: string;
  name: string;
  level: number;
  bins: Bin[];
}

interface Bin {
  id: string;
  position: { x: number; y: number };
  status: 'empty' | 'partial' | 'full' | 'occupied' | 'target' | 'collected';
  category: string;
  fillPercentage: number;
}

interface PickingItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  location: string;
  floor: number;
  bin: string;
  status: 'pending' | 'collecting' | 'collected';
}

interface Order {
  id: string;
  number: string;
  items: PickingItem[];
  totalItems: number;
  collectedItems: number;
}

export default function AdvancedPickingInterface({ orderId, customerId }: { orderId?: string | null; customerId?: string | null } = {}) {
  const [currentFloor, setCurrentFloor] = useState(1);
  const [workerPosition, setWorkerPosition] = useState({ x: 0, y: 1 });
  const [order, setOrder] = useState<Order>({
    id: 'order-5',
    number: '#5',
    items: [
      {
        id: 'item-1',
        sku: 'SKU-001',
        name: 'Fresh Vegetables',
        quantity: 2,
        location: 'D2.1',
        floor: 1,
        bin: 'D2.1',
        status: 'collecting',
      },
      {
        id: 'item-2',
        sku: 'SKU-002',
        name: 'Frozen Goods',
        quantity: 1,
        location: 'C3.2',
        floor: 2,
        bin: 'C3.2',
        status: 'pending',
      },
    ],
    totalItems: 2,
    collectedItems: 0,
  });

  const [floors, setFloors] = useState<FloorLevel[]>([
    {
      id: 'f1',
      name: 'Floor 1 (Ground Level)',
      level: 1,
      bins: generateFloorBins(1, 9, 9),
    },
    {
      id: 'f2',
      name: 'Floor 2',
      level: 2,
      bins: generateFloorBins(2, 9, 9),
    },
    {
      id: 'f3',
      name: 'Floor 3',
      level: 3,
      bins: generateFloorBins(3, 9, 9),
    },
    {
      id: 'f4',
      name: 'Floor 4',
      level: 4,
      bins: generateFloorBins(4, 9, 9),
    },
  ]);

  const currentFloorData = floors[currentFloor - 1];
  const currentItem = order.items.find(item => item.status === 'collecting');

  const handleCollectItem = () => {
    setOrder(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.status === 'collecting'
          ? { ...item, status: 'collected' }
          : item
      ),
      collectedItems: prev.collectedItems + 1,
    }));

    // Move to next item
    const nextPendingItem = order.items.find(item => item.status === 'pending');
    if (nextPendingItem) {
      setCurrentFloor(nextPendingItem.floor);
      setOrder(prev => ({
        ...prev,
        items: prev.items.map(item =>
          item.id === nextPendingItem.id
            ? { ...item, status: 'collecting' }
            : item
        ),
      }));
    }
  };

  const handleCancelOrder = () => {
    setOrder({
      id: 'order-5',
      number: '#5',
      items: [
        {
          id: 'item-1',
          sku: 'SKU-001',
          name: 'Fresh Vegetables',
          quantity: 2,
          location: 'D2.1',
          floor: 1,
          bin: 'D2.1',
          status: 'pending',
        },
        {
          id: 'item-2',
          sku: 'SKU-002',
          name: 'Frozen Goods',
          quantity: 1,
          location: 'C3.2',
          floor: 2,
          bin: 'C3.2',
          status: 'pending',
        },
      ],
      totalItems: 2,
      collectedItems: 0,
    });
    setCurrentFloor(1);
  };

  const isOrderComplete = order.collectedItems === order.totalItems;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                Collecting Order {order.number}
              </h1>
              <div className="flex items-center gap-4 text-blue-100">
                <div>
                  <div className="text-sm opacity-80">Progress</div>
                  <div className="text-lg font-bold">
                    {order.collectedItems}/{order.totalItems}
                  </div>
                </div>
                <div className="flex-1 bg-blue-500 rounded-full h-2">
                  <div
                    className="bg-green-400 h-2 rounded-full transition-all"
                    style={{
                      width: `${(order.collectedItems / order.totalItems) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
            {isOrderComplete && (
              <div className="text-right">
                <CheckCircleIcon className="w-12 h-12 text-green-400 mb-2" />
                <p className="font-bold">Order Complete!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Item Details */}
        <div className="lg:col-span-1 space-y-4">
          {/* Current Item */}
          {currentItem && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">
                Current Item
              </h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-600">Item</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {currentItem.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{currentItem.sku}</p>
                </div>

                <div>
                  <p className="text-sm text-slate-600">Quantity</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {currentItem.quantity}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-600">Category</p>
                  <p className="text-sm text-slate-900">Not specified</p>
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm text-slate-600 mb-2">Collection Path</p>
                  <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-700">
                    Navigate to item location shown on map
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Item Location: <span className="font-bold">{currentItem.location}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Blue circle = Receiving point | Orange circle = Item location
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <p className="text-xs font-bold text-blue-900 mb-2">
                    Floor Details: {currentItem.floor}
                  </p>
                  <div className="space-y-1 text-xs text-blue-800">
                    <div>Rack View:</div>
                    <div className="ml-2">
                      ☐ {currentItem.bin.charAt(0)}{currentItem.floor} - Collect from here
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* All Items List */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">All Items</h2>
            <div className="space-y-3">
              {order.items.map((item, idx) => (
                <div
                  key={item.id}
                  className={`border rounded-lg p-3 transition-colors ${
                    item.status === 'collected'
                      ? 'bg-green-50 border-green-200'
                      : item.status === 'collecting'
                        ? 'bg-blue-50 border-blue-300 border-2'
                        : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-bold text-slate-900 text-sm">
                        {idx + 1}. {item.name}
                      </p>
                      <p className="text-xs text-slate-600">{item.sku}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Qty: {item.quantity} | Floor {item.floor}
                      </p>
                    </div>
                    {item.status === 'collected' && (
                      <CheckCircleIcon className="w-5 h-5 text-green-600" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center/Right - Floor Map & Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Floor Selector */}
          <div className="flex items-center justify-between bg-white rounded-lg shadow-lg p-4">
            <button
              onClick={() => setCurrentFloor(Math.max(1, currentFloor - 1))}
              disabled={currentFloor === 1}
              className="p-2 hover:bg-slate-100 disabled:opacity-50 rounded-lg"
            >
              <ChevronLeftIcon className="w-6 h-6 text-slate-700" />
            </button>

            <div className="flex gap-2">
              {floors.map(floor => (
                <button
                  key={floor.id}
                  onClick={() => setCurrentFloor(floor.level)}
                  className={`px-6 py-2 rounded-lg font-bold transition-colors ${
                    currentFloor === floor.level
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  F{floor.level}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCurrentFloor(Math.min(4, currentFloor + 1))}
              disabled={currentFloor === 4}
              className="p-2 hover:bg-slate-100 disabled:opacity-50 rounded-lg"
            >
              <ChevronRightIcon className="w-6 h-6 text-slate-700" />
            </button>
          </div>

          {/* Floor Map Visualization */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              Floor {currentFloor} Layout
            </h2>

            <div className="grid gap-1 mb-6" style={getGridStyle(9, 9)}>
              {currentFloorData?.bins.map((bin, idx) => {
                const isTarget =
                  currentItem && currentItem.bin === `${String.fromCharCode(65 + bin.position.x)}${bin.position.y}`;
                return (
                  <div
                    key={`${bin.position.x}-${bin.position.y}`}
                    className={`w-full aspect-square rounded flex items-center justify-center text-xs font-bold text-white cursor-pointer transition-all hover:shadow-lg ${
                      isTarget
                        ? 'bg-orange-500 border-2 border-orange-600 shadow-lg'
                        : getBinColor(bin.status)
                    }`}
                    title={`${String.fromCharCode(65 + bin.position.x)}${bin.position.y}`}
                  >
                    {isTarget ? '📍' : getStatusIcon(bin.status)}
                  </div>
                );
              })}
            </div>

            {/* Picking Progress Card */}
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-blue-900">Picking Progress</h3>
                <span className="text-sm font-bold text-blue-700">
                  Step {Math.min(order.collectedItems + 1, order.totalItems)}/{order.totalItems}
                </span>
              </div>
              {currentItem && (
                <p className="text-sm text-blue-800">
                  Navigate to highlighted destination
                </p>
              )}
            </div>

            {/* Worker Location */}
            <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPinIcon className="w-5 h-5 text-blue-600" />
                <span className="font-bold text-slate-900">Worker Location</span>
              </div>
              <p className="text-sm text-slate-600">
                Position: [{workerPosition.x}, {workerPosition.y}]
              </p>
              {currentItem && (
                <p className="text-sm text-slate-600 mt-1">
                  Next Destination: {currentItem.bin}
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-end">
            <button
              onClick={handleCancelOrder}
              className="px-6 py-3 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-semibold transition-colors"
            >
              Cancel Order
            </button>
            <button
              onClick={handleCollectItem}
              disabled={isOrderComplete || !currentItem}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white rounded-lg font-semibold transition-colors"
            >
              {isOrderComplete ? '✓ Order Complete' : 'Collect & Next Item'}
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="max-w-7xl mx-auto mt-8 bg-white rounded-lg shadow-lg p-6">
        <h3 className="font-bold text-slate-900 mb-4">Bin Storage Status Legend</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded"></div>
            <span className="text-sm">Empty (0%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-500 rounded"></div>
            <span className="text-sm">Partial (50-80%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-yellow-500 rounded"></div>
            <span className="text-sm">Occupied/In Use</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-600 rounded"></div>
            <span className="text-sm">Full (&gt;80%)</span>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-200">
          <h4 className="font-semibold text-slate-900 mb-2 text-sm">Slot Categories</h4>
          <p className="text-xs text-slate-600">
            • <span className="font-medium">P01-P14:</span> Small/Pallet storage (Blue when empty, Green when partial, etc.)
          </p>
          <p className="text-xs text-slate-600 mt-1">
            • <span className="font-medium">D01-D14:</span> Large item storage (Color indicates status, not type)
          </p>
          <p className="text-xs text-slate-600 mt-1">
            • <span className="font-medium">B01-B21:</span> Medium/Bin storage (Color indicates status, not type)
          </p>
          <p className="text-xs text-slate-600 mt-3">
            Each slot has 4 floors; e.g., B01-F1, B01-F2, B01-F3, B01-F4. All floors share coordinates but represent different storage levels.
          </p>
        </div>
      </div>
    </div>
  );
}

function generateFloorBins(floor: number, cols: number, rows: number): Bin[] {
  const bins: Bin[] = [];
  const categories = ['Small/Pallet', 'Large', 'Medium/Bin', 'Bulk', 'Hazmat', 'Cold'];
  const statuses: Array<'empty' | 'partial' | 'full' | 'occupied'> = [
    'empty',
    'partial',
    'full',
    'occupied',
  ];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      // Deterministic hash based on position for consistent display
      const hash = ((x * 7 + y * 13 + floor * 31) * 2654435761) >>> 0;
      bins.push({
        id: `${String.fromCharCode(65 + x)}${y + 1}-F${floor}`,
        position: { x, y },
        status: statuses[hash % statuses.length],
        category: categories[(hash >> 4) % categories.length],
        fillPercentage: (hash >> 8) % 100,
      });
    }
  }

  return bins;
}

function getBinColor(status: string): string {
  switch (status) {
    case 'empty':
      return 'bg-blue-500';
    case 'partial':
      return 'bg-green-500';
    case 'full':
      return 'bg-red-600';
    case 'occupied':
      return 'bg-yellow-500';
    default:
      return 'bg-slate-400';
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'empty':
      return '□';
    case 'partial':
      return '▨';
    case 'full':
      return '■';
    case 'occupied':
      return '◆';
    default:
      return '?';
  }
}

function getGridStyle(cols: number, rows: number) {
  return {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
  };
}
