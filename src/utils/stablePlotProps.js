/**
 * Build a stable cache key for Plotly layout objects (JSON-serializable fields).
 */
export function layoutStableKey(layout) {
  if (!layout) return '';
  try {
    return JSON.stringify(layout);
  } catch {
    return String(Date.now());
  }
}

/**
 * Build a stable cache key for Plotly config (ignores function handlers in modebar buttons).
 */
export function configStableKey(config) {
  if (!config) return '';
  const {
    modeBarButtonsToAdd,
    modeBarButtonsToRemove,
    ...rest
  } = config;
  const addKey = Array.isArray(modeBarButtonsToAdd)
    ? modeBarButtonsToAdd.map((btn) => btn?.name ?? '').join('|')
    : '';
  const removeKey = Array.isArray(modeBarButtonsToRemove)
    ? modeBarButtonsToRemove.join('|')
    : '';
  try {
    return `${JSON.stringify(rest)}::${addKey}::${removeKey}`;
  } catch {
    return String(Date.now());
  }
}

/**
 * Return a cached value when key matches; otherwise compute and store.
 */
export function getStableCachedValue(cacheRef, key, compute) {
  if (cacheRef.current.key === key) {
    return cacheRef.current.value;
  }
  const value = compute();
  cacheRef.current = { key, value };
  return value;
}
