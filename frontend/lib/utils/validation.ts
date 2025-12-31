/**
 * Validation utilities for location codes, LPNs, and other formats
 */

/**
 * Validates location code format: AREA-ROW-BAY-LEVEL-POS
 * Example: "C-02-05-3-B"
 * Format: Single letter area, 2-digit row, 2-digit bay, 1-2 digit level, single letter position
 */
export function validateLocationCode(locationCode: string): {
  valid: boolean;
  error?: string;
  parsed?: {
    area: string;
    row: string;
    bay: string;
    level: string;
    position: string;
  };
} {
  if (!locationCode || locationCode.trim() === "") {
    return { valid: false, error: "Location code cannot be empty" };
  }

  // Remove whitespace
  const code = locationCode.trim().toUpperCase();

  // Pattern: AREA-ROW-BAY-LEVEL-POS
  // AREA: Single letter (A-Z)
  // ROW: 2 digits (01-99)
  // BAY: 2-3 digits (001-999)
  // LEVEL: 1-2 digits (1-10)
  // POS: Single letter (A-Z)
  const pattern = /^([A-Z])-(\d{2})-(\d{2,3})-(\d{1,2})-([A-Z])$/;

  const match = code.match(pattern);
  if (!match) {
    return {
      valid: false,
      error: "Invalid format. Expected: AREA-ROW-BAY-LEVEL-POS (e.g., C-02-05-3-B)",
    };
  }

  const [, area, row, bay, level, position] = match;

  // Validate area (A, B, C, D, R, ST, RC, PK, PA, SH, RM, FG)
  const validAreas = ["A", "B", "C", "D", "R", "ST", "RC", "PK", "PA", "SH", "RM", "FG"];
  if (!validAreas.includes(area)) {
    return {
      valid: false,
      error: `Invalid area. Must be one of: ${validAreas.join(", ")}`,
    };
  }

  // Validate level (1-10)
  const levelNum = parseInt(level, 10);
  if (levelNum < 1 || levelNum > 10) {
    return {
      valid: false,
      error: "Level must be between 1 and 10",
    };
  }

  return {
    valid: true,
    parsed: {
      area,
      row,
      bay,
      level,
      position,
    },
  };
}

/**
 * Validates LPN (License Plate Number) format
 * Format: LPN-XXXX where XXXX is alphanumeric (4-8 characters)
 * Example: "LPN-1234", "LPN-ABC123"
 */
export function validateLPN(lpn: string): {
  valid: boolean;
  error?: string;
} {
  if (!lpn || lpn.trim() === "") {
    return { valid: false, error: "LPN cannot be empty" };
  }

  const code = lpn.trim().toUpperCase();

  // Pattern: LPN- followed by 4-8 alphanumeric characters
  const pattern = /^LPN-[A-Z0-9]{4,8}$/;

  if (!pattern.test(code)) {
    return {
      valid: false,
      error: "Invalid LPN format. Expected: LPN-XXXX (e.g., LPN-1234 or LPN-ABC123)",
    };
  }

  return { valid: true };
}

/**
 * Formats location code for display
 * Converts "C-02-05-3-B" to "Area C / Row 02 / Bay 05 / Level 3 / Bin B"
 */
export function formatLocationCodeForDisplay(locationCode: string): string {
  const validation = validateLocationCode(locationCode);
  if (!validation.valid || !validation.parsed) {
    return locationCode; // Return as-is if invalid
  }

  const { area, row, bay, level, position } = validation.parsed;
  return `Area ${area} / Row ${row} / Bay ${bay} / Level ${level} / Bin ${position}`;
}

/**
 * Parses location code into components
 */
export function parseLocationCode(locationCode: string): {
  area: string;
  row: string;
  bay: string;
  level: string;
  position: string;
} | null {
  const validation = validateLocationCode(locationCode);
  return validation.parsed || null;
}

