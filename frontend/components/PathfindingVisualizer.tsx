'use client';

import React, { useState, useEffect } from 'react';
import './PathfindingVisualizer.css';

interface PathNode {
  row: number;
  col: number;
  gCost: number;
  hCost: number;
  fCost: number;
}

interface PathResponse {
  pathFound: boolean;
  path: PathNode[];
  pathLength: number;
  executionTimeMs: number;
  message: string;
}

interface Cell {
  row: number;
  col: number;
  type: 'empty' | 'start' | 'end' | 'path' | 'obstacle' | 'searching';
}

export default function PathfindingVisualizer() {
  const GRID_SIZE = 12;
  const [grid, setGrid] = useState<Cell[][]>([]);
  const [startPos, setStartPos] = useState({ row: 0, col: 0 });
  const [endPos, setEndPos] = useState({ row: GRID_SIZE - 1, col: GRID_SIZE - 1 });
  const [obstacles, setObstacles] = useState<Set<string>>(new Set());
  const [path, setPath] = useState<PathNode[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [message, setMessage] = useState('');
  const [executionTime, setExecutionTime] = useState(0);

  // Initialize grid
  useEffect(() => {
    const newGrid: Cell[][] = [];
    for (let i = 0; i < GRID_SIZE; i++) {
      newGrid[i] = [];
      for (let j = 0; j < GRID_SIZE; j++) {
        let type: Cell['type'] = 'empty';
        if (i === startPos.row && j === startPos.col) type = 'start';
        else if (i === endPos.row && j === endPos.col) type = 'end';
        else if (obstacles.has(`${i},${j}`)) type = 'obstacle';
        
        newGrid[i][j] = { row: i, col: j, type };
      }
    }
    setGrid(newGrid);
  }, [startPos, endPos, obstacles]);

  // Handle cell click
  const handleCellClick = (row: number, col: number) => {
    if (row === startPos.row && col === startPos.col) return;
    if (row === endPos.row && col === endPos.col) return;

    const key = `${row},${col}`;
    const newObstacles = new Set(obstacles);
    
    if (newObstacles.has(key)) {
      newObstacles.delete(key);
    } else {
      newObstacles.add(key);
    }
    
    setObstacles(newObstacles);
  };

  // Set start position
  const handleSetStart = (row: number, col: number) => {
    setStartPos({ row, col });
    const key = `${row},${col}`;
    const newObstacles = new Set(obstacles);
    newObstacles.delete(key);
    setObstacles(newObstacles);
  };

  // Set end position
  const handleSetEnd = (row: number, col: number) => {
    setEndPos({ row, col });
    const key = `${row},${col}`;
    const newObstacles = new Set(obstacles);
    newObstacles.delete(key);
    setObstacles(newObstacles);
  };

  // Find path with A*
  const handleFindPath = async () => {
    setIsSearching(true);
    setMessage('');
    setPath([]);

    try {
      const blockedLocations = Array.from(obstacles).map(pos => {
        const [row, col] = pos.split(',').map(Number);
        return { row, col };
      });

      const response = await fetch('http://localhost:8080/api/pathfinding/find-path', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startRow: startPos.row,
          startCol: startPos.col,
          endRow: endPos.row,
          endCol: endPos.col,
          gridRows: GRID_SIZE,
          gridCols: GRID_SIZE,
          blockedLocations,
        }),
      });

      const data: PathResponse = await response.json();
      
      setMessage(data.message);
      setExecutionTime(data.executionTimeMs);
      setPath(data.path);

      // Update grid with path
      if (data.pathFound) {
        const newGrid = grid.map(row => [...row]);
        data.path.forEach(node => {
          if ((node.row !== startPos.row || node.col !== startPos.col) &&
              (node.row !== endPos.row || node.col !== endPos.col)) {
            newGrid[node.row][node.col] = {
              ...newGrid[node.row][node.col],
              type: 'path'
            };
          }
        });
        setGrid(newGrid);
      }
    } catch (error) {
      setMessage('Error finding path: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsSearching(false);
    }
  };

  // Reset
  const handleReset = () => {
    setPath([]);
    setObstacles(new Set());
    setMessage('');
    setExecutionTime(0);
  };

  return (
    <div className="pathfinding-container">
      <div className="pathfinding-header">
        <h2>A* Pathfinding Visualizer</h2>
        <p className="subtitle">Find optimal paths in the warehouse</p>
      </div>

      <div className="pathfinding-content">
        <div className="grid-section">
          <div className="grid-wrapper">
            <div className="grid">
              {grid.map((row, rowIdx) => (
                <div key={rowIdx} className="grid-row">
                  {row.map((cell, colIdx) => (
                    <div
                      key={`${rowIdx}-${colIdx}`}
                      className={`grid-cell ${cell.type}`}
                      onClick={() => handleCellClick(rowIdx, colIdx)}
                      title={`Row: ${rowIdx}, Col: ${colIdx}`}
                    >
                      {cell.type === 'start' && <span className="marker">S</span>}
                      {cell.type === 'end' && <span className="marker">E</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="controls">
            <button
              className="btn btn-primary"
              onClick={handleFindPath}
              disabled={isSearching}
            >
              {isSearching ? 'Searching...' : 'Find Path (A*)'}
            </button>
            <button className="btn btn-secondary" onClick={handleReset}>
              Reset
            </button>
          </div>
        </div>

        <div className="info-panel">
          <div className="legend">
            <h3>Legend</h3>
            <div className="legend-item">
              <div className="legend-color start"></div>
              <span>Start Position (S)</span>
            </div>
            <div className="legend-item">
              <div className="legend-color end"></div>
              <span>End Position (E)</span>
            </div>
            <div className="legend-item">
              <div className="legend-color path"></div>
              <span>Optimal Path</span>
            </div>
            <div className="legend-item">
              <div className="legend-color obstacle"></div>
              <span>Obstacle (Click to toggle)</span>
            </div>
          </div>

          <div className="stats">
            <h3>Results</h3>
            {message && (
              <div className={`message ${path.length > 0 ? 'success' : 'info'}`}>
                {message}
              </div>
            )}
            {path.length > 0 && (
              <>
                <p><strong>Path Length:</strong> {path.length} steps</p>
                <p><strong>Execution Time:</strong> {executionTime}ms</p>
              </>
            )}
          </div>

          <div className="instructions">
            <h3>Instructions</h3>
            <ol>
              <li>Click cells to add obstacles</li>
              <li>Right-click to set start position (S)</li>
              <li>Right-click on another cell to set end position (E)</li>
              <li>Click "Find Path" to run A* algorithm</li>
              <li>Click "Reset" to clear</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
