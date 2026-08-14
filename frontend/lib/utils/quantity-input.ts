/**
 * Helpers for quantity fields in the worker PWA.
 *
 * A controlled `<input type="number" value={someNumber}>` keeps a stale string on
 * screen: after typing "243" into a field showing "0", the DOM value is "0243",
 * and React skips the write-back because `"0243" != 243` is false. The field then
 * reads "0243" forever even though state holds 243. Binding a string and stripping
 * leading zeros ourselves avoids the mismatch entirely.
 */

/** Value to bind to the input. Renders empty rather than a leading "0" to type past. */
export function quantityInputValue(quantity: number): string {
  return quantity === 0 ? "" : String(quantity);
}

/** Parses what the worker typed, ignoring non-digits and leading zeros. */
export function parseQuantityInput(raw: string): number {
  const digits = raw.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
  if (digits === "") {
    return 0;
  }
  const parsed = Number.parseInt(digits, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Props shared by every whole-number quantity field, so handhelds get a numeric keypad. */
export const QUANTITY_INPUT_PROPS = {
  type: "text" as const,
  inputMode: "numeric" as const,
  pattern: "[0-9]*",
  autoComplete: "off",
};

/** Value to bind to a decimal field (weights). Same stale-DOM problem, one decimal point allowed. */
export function decimalInputValue(value: number): string {
  return value === 0 ? "" : String(value);
}

/** Parses a decimal entry, keeping at most one decimal point and dropping leading zeros. */
export function parseDecimalInput(raw: string): number {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  const singleDot =
    firstDot === -1
      ? cleaned
      : cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
  const normalized = singleDot.replace(/^0+(?=\d)/, "");
  if (normalized === "" || normalized === ".") {
    return 0;
  }
  const parsed = Number.parseFloat(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export const DECIMAL_INPUT_PROPS = {
  type: "text" as const,
  inputMode: "decimal" as const,
  autoComplete: "off",
};
