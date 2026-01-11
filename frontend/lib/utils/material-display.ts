/**
 * Helper utilities for displaying materials in worker-friendly format
 * Always shows SKU (Material Code) and Product Name, never UUIDs
 */

export interface MaterialDisplayInfo {
  sku: string;           // Material Code (e.g., "100036", "MAT-12345")
  name: string;          // Product Name/Description (e.g., "CAUSTIC SODA")
  materialId: string;    // UUID (internal use only, never displayed)
}

/**
 * Check if a string is a UUID (not user-friendly)
 */
export function isUUID(str: string): boolean {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(str);
}

/**
 * Format material for display - always shows SKU and name, never UUID
 */
export function formatMaterialDisplay(
  materialCode?: string | null,
  description?: string | null,
  materialId?: string | null
): MaterialDisplayInfo {
  // If materialCode exists and is not a UUID, use it as SKU
  const sku = materialCode && !isUUID(materialCode) && materialCode.length < 50
    ? materialCode
    : materialId && !isUUID(materialId) && materialId.length < 50
    ? materialId
    : "N/A";

  // Use description as name, fallback to materialCode if it's not a UUID
  const name = description && description.trim()
    ? description
    : materialCode && !isUUID(materialCode)
    ? materialCode
    : "Unknown Item";

  return {
    sku,
    name,
    materialId: materialId || "",
  };
}

/**
 * Get material display text for UI
 * Returns formatted string like "100036 • CAUSTIC SODA"
 */
export function getMaterialDisplayText(
  materialCode?: string | null,
  description?: string | null,
  materialId?: string | null
): string {
  const display = formatMaterialDisplay(materialCode, description, materialId);
  
  if (display.sku === "N/A" && display.name === "Unknown Item") {
    return "Unknown Item";
  }
  
  if (display.sku === display.name || display.name === "Unknown Item") {
    return display.sku;
  }
  
  return `${display.sku} • ${display.name}`;
}
