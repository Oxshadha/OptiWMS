import React, { useEffect, useState } from 'react';
import { MapPin, ChevronRight, CheckCircle, AlertTriangle, Loader } from 'lucide-react';
import { pathfindingApi } from '@/lib/api/pathfinding';
import './PickingRouteGuide.module.css';

interface PickingItem {
  id: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  location: string;
  binNumber?: string;
}

interface PickingRouteGuideProps {
  items: PickingItem[];
  currentLocation: string;
  onItemConfirm: (itemId: string) => void;
  onRouteComplete: () => void;
}

export function PickingRouteGuide({
  items,
  currentLocation,
  onItemConfirm,
  onRouteComplete,
}: PickingRouteGuideProps) {
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [route, setRoute] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [estimatedTime, setEstimatedTime] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);

  const currentItem = items[currentItemIndex];
  const completedItems = currentItemIndex;
  const remainingItems = items.length - currentItemIndex - 1;

  useEffect(() => {
    if (!currentItem) return;

    fetchRoute();
  }, [currentItemIndex]);

  const fetchRoute = async () => {
    if (!currentItem) return;

    try {
      setIsLoading(true);
      setError('');

      const response = await pathfindingApi.findPath({
        startLocation: currentLocation,
        endLocation: currentItem.location,
        blockedLocations: [],
        equipmentType: 'picker',
      });

      if (response.path && response.path.length > 0) {
        setRoute(response.path);
        setEstimatedTime(Math.ceil(response.estimatedTimeSeconds || 45));
        setTotalDistance(response.totalDistance || 0);
      } else {
        setError('No path found to this location');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch route');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmPick = () => {
    onItemConfirm(currentItem.id);

    if (currentItemIndex < items.length - 1) {
      setCurrentItemIndex(currentItemIndex + 1);
    } else {
      onRouteComplete();
    }
  };

  const generateInstructions = () => {
    if (route.length < 2) return [];

    const instructions: string[] = [];
    
    for (let i = 0; i < route.length - 1; i++) {
      const current = route[i];
      const next = route[i + 1];

      // Determine direction
      let direction = '';
      if (next.y > current.y) direction = 'North';
      else if (next.y < current.y) direction = 'South';
      
      if (next.x > current.x) direction += ' East';
      else if (next.x < current.x) direction += ' West';

      if (i === 0) {
        instructions.push(`Start: Move ${direction.trim()} towards ${next.label}`);
      } else if (i === route.length - 2) {
        instructions.push(`Final: Proceed ${direction.trim()} to reach your destination`);
      } else {
        instructions.push(`Continue ${direction.trim()} to ${next.label}`);
      }
    }

    return instructions;
  };

  if (!currentItem) {
    return (
      <div className="picking-complete">
        <CheckCircle size={48} className="success-icon" />
        <h2>All items picked!</h2>
        <p>Great job! You've completed the picking task.</p>
        <button className="action-button" onClick={onRouteComplete}>
          Complete Task
        </button>
      </div>
    );
  }

  const instructions = generateInstructions();

  return (
    <div className="picking-route-guide">
      {/* Progress Header */}
      <div className="progress-header">
        <div className="progress-info">
          <span className="progress-label">Progress</span>
          <span className="progress-numbers">
            {completedItems + 1}/{items.length}
          </span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{
              width: `${((completedItems + 1) / items.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Current Item */}
      <div className="current-item-container">
        <div className="item-badge">Item {currentItemIndex + 1}</div>
        <div className="item-details">
          <h3 className="item-name">{currentItem.itemName}</h3>
          <div className="item-info">
            <span className="item-code">{currentItem.itemCode}</span>
            <span className="item-quantity">Qty: {currentItem.quantity}</span>
          </div>
        </div>
      </div>

      {/* Location & Routing */}
      <div className="location-section">
        <div className="location-tag">
          <MapPin size={16} />
          <span>Location: {currentItem.location}</span>
        </div>

        {isLoading ? (
          <div className="loading-state">
            <Loader size={24} className="spinner" />
            <p>Calculating optimal route...</p>
          </div>
        ) : error ? (
          <div className="error-alert">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        ) : (
          <>
            {/* Route Metrics */}
            <div className="route-metrics">
              <div className="metric">
                <span className="metric-label">Est. Time</span>
                <span className="metric-value">{estimatedTime}s</span>
              </div>
              <div className="metric">
                <span className="metric-label">Distance</span>
                <span className="metric-value">
                  {totalDistance.toFixed(1)}m
                </span>
              </div>
            </div>

            {/* Step-by-Step Instructions */}
            {instructions.length > 0 && (
              <div className="instructions-container">
                <h4>Route Instructions</h4>
                <ol className="instructions-list">
                  {instructions.map((instruction, index) => (
                    <li key={index} className="instruction-step">
                      <span className="step-number">{index + 1}</span>
                      <span className="step-text">{instruction}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        )}
      </div>

      {/* Action Buttons */}
      <div className="action-buttons">
        <button
          className="confirm-button"
          onClick={handleConfirmPick}
          disabled={isLoading || !route.length}
        >
          <CheckCircle size={16} />
          <span>Item Picked</span>
        </button>

        {remainingItems > 0 && (
          <button className="next-button" onClick={handleConfirmPick}>
            <span>Next Item ({remainingItems} remaining)</span>
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      {/* Remaining Items Summary */}
      {remainingItems > 0 && (
        <div className="remaining-summary">
          <h4>Upcoming Items</h4>
          <div className="upcoming-list">
            {items.slice(currentItemIndex + 1, Math.min(currentItemIndex + 3, items.length)).map((item, index) => (
              <div key={item.id} className="upcoming-item">
                <span className="upcoming-number">{currentItemIndex + index + 2}</span>
                <div className="upcoming-details">
                  <div className="upcoming-name">{item.itemName}</div>
                  <div className="upcoming-location">{item.location}</div>
                </div>
              </div>
            ))}
            {remainingItems > 2 && (
              <div className="more-items">
                +{remainingItems - 2} more items
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
