/**
 * Pathfinding Utility Functions
 */

export interface GridCell {
  row: number;
  col: number;
  type: 'empty' | 'start' | 'end' | 'path' | 'obstacle';
}

export interface PathfindingRequest {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  gridRows: number;
  gridCols: number;
  blockedLocations: Array<{ row: number; col: number }>;
}

export interface PathfindingResponse {
  pathFound: boolean;
  path: Array<{ row: number; col: number; gCost: number; hCost: number; fCost: number }>;
  pathLength: number;
  executionTimeMs: number;
  message: string;
}

/**
 * Convert warehouse location code to grid coordinates
 * Example: "A-01-01-4-A" -> { row: 0, col: 0 }
 */
export function locationCodeToCoords(locationCode: string): { row: number; col: number } | null {
  try {
    const parts = locationCode.split('-');
    if (parts.length !== 5) return null;

    const area = parts[0]; // A, B, C, etc.
    const row = parseInt(parts[1]); // 01, 02, etc.
    const col = parseInt(parts[2]); // 01, 02, etc.

    // Convert to grid coordinates
    return {
      row: row - 1,
      col: col - 1,
    };
  } catch {
    return null;
  }
}

/**
 * Convert grid coordinates to warehouse location code
 * Example: { row: 0, col: 0 } -> "A-01-01-4-A"
 */
export function coordsToLocationCode(
  coords: { row: number; col: number },
  area: string = 'A',
  level: number = 1,
  binPosition: string = 'A'
): string {
  return `${area}-${String(coords.row + 1).padStart(2, '0')}-${String(coords.col + 1).padStart(2, '0')}-${level}-${binPosition}`;
}

/**
 * Calculate Manhattan distance between two points
 */
export function manhattanDistance(
  from: { row: number; col: number },
  to: { row: number; col: number }
): number {
  return Math.abs(from.row - to.row) + Math.abs(from.col - to.col);
}

/**
 * Calculate Euclidean distance between two points
 */
export function euclideanDistance(
  from: { row: number; col: number },
  to: { row: number; col: number }
): number {
  const dx = from.row - to.row;
  const dy = from.col - to.col;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Find path using API
 */
export async function findPathAPI(request: PathfindingRequest): Promise<PathfindingResponse> {
  const response = await fetch('http://localhost:8080/api/pathfinding/find-path', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error('Failed to find path');
  }

  return response.json();
}
