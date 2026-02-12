export function buildLookupMap<T, K extends string | number, V>(
  items: T[],
  keySelector: (item: T) => K | null | undefined,
  valueSelector: (item: T) => V,
): Map<K, V> {
  const map = new Map<K, V>();
  for (const item of items) {
    const key = keySelector(item);
    if (key !== null && key !== undefined) {
      map.set(key, valueSelector(item));
    }
  }
  return map;
}

export function getLookupValue<K, V>(
  map: Map<K, V>,
  key: K | null | undefined,
  fallback: V,
): V {
  if (key === null || key === undefined) {
    return fallback;
  }
  return map.get(key) ?? fallback;
}
