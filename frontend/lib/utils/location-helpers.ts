/**
 * Location helper utilities for validation and synchronization
 * Handles format conflicts and ensures locations exist in database
 */

import { locationsApi, Location } from '@/lib/api/locations';
import { validateLocationCode } from './validation';

/**
 * IMPORTANT: Location format is standardized to C-02-05-3-B (AREA-ROW-BAY-LEVEL-POS)
 * This is the ONLY format accepted by the system.
 */

/**
 * Validates location exists in database and is active
 * This is the real validation - format validation is just a first check
 */
export async function validateLocationExists(
  locationCode: string,
  warehouseId?: string
): Promise<{
  valid: boolean;
  error?: string;
  location?: Location;
}> {
  if (!locationCode || locationCode.trim() === "") {
    return { valid: false, error: "Location code cannot be empty" };
  }

  // First check format (lenient)
  const formatValidation = validateLocationCode(locationCode);
  if (!formatValidation.valid && formatValidation.error) {
    return { valid: false, error: formatValidation.error };
  }

  // Then check database existence (this is the real validation)
  try {
    const location = await locationsApi.getByCode(locationCode.trim().toUpperCase());
    
    // Check if location is active
    if (!location.isActive) {
      return {
        valid: false,
        error: `Location "${locationCode}" exists but is not active. Please select an active location.`,
        location,
      };
    }

    // Check warehouse match if provided
    if (warehouseId && location.warehouseId !== warehouseId) {
      return {
        valid: false,
        error: `Location "${locationCode}" belongs to a different warehouse.`,
        location,
      };
    }

    return { valid: true, location };
  } catch (error: any) {
    if (error?.response?.status === 404) {
      return {
        valid: false,
        error: `Location "${locationCode}" not found in database. Please verify the location code exists in the locations table.`,
      };
    }
    
    return {
      valid: false,
      error: `Error checking location: ${error?.message || 'Unknown error'}`,
    };
  }
}

/**
 * Normalizes location code for comparison
 * Handles format variations like ST-WH-001-01-001-1-A vs A-01-01-1-A
 */
export function normalizeLocationCode(locationCode: string): string {
  if (!locationCode) return "";
  
  // Remove whitespace and convert to uppercase
  let normalized = locationCode.trim().toUpperCase();
  
  // Remove common prefixes like "ST-WH-001-" if present
  normalized = normalized.replace(/^ST-WH-\d{3}-/, '');
  
  return normalized;
}

/**
 * Checks if two location codes refer to the same location
 * Handles format variations
 */
export function areLocationsEqual(loc1: string, loc2: string): boolean {
  const norm1 = normalizeLocationCode(loc1);
  const norm2 = normalizeLocationCode(loc2);
  
  return norm1 === norm2;
}

/**
 * Formats location code for display with fallback
 */
export function formatLocationForDisplay(locationCode: string): string {
  if (!locationCode) return "N/A";
  
  // Try to parse and format nicely
  const validation = validateLocationCode(locationCode);
  if (validation.valid && validation.parsed) {
    const { area, row, bay, level, position } = validation.parsed;
    return `${area}-${row}-${bay}-${level}-${position}`;
  }
  
  // If can't parse, return as-is (might be valid format we don't recognize)
  return locationCode;
}
