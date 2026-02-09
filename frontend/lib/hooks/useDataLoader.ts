/**
 * Industry Standard: Custom Data Fetching Hook
 * 
 * Rationale:
 * 1. React Query, SWR, and custom hooks are industry-standard patterns
 * 2. Reduces code duplication across 16+ admin pages
 * 3. Centralizes error handling, loading states, and reload logic
 * 4. Makes code more testable and maintainable
 * 5. Follows React best practices for data fetching
 * 
 * Based on:
 * - React official documentation on custom hooks
 * - Industry patterns from React Query, SWR
 * - React team recommendations for data fetching
 */

import { useState, useEffect, useCallback } from "react";

interface UseDataLoaderOptions {
  /**
   * Optional event name for reloading data
   * When provided, listens to window events (e.g., 'reloadCustomers')
   */
  reloadEventName?: string;
  
  /**
   * Whether to load data immediately on mount
   * Default: true
   */
  immediate?: boolean;
}

interface UseDataLoaderResult<T> {
  /** The loaded data */
  data: T[];
  
  /** Loading state */
  loading: boolean;
  
  /** Error message, if any */
  error: string | null;
  
  /** Manually reload data */
  reload: () => Promise<void>;
  
  /** Reset error state */
  clearError: () => void;
}

/**
 * Custom hook for data fetching with loading, error, and reload support
 * 
 * @param fetchFn - Async function that returns an array of data
 * @param options - Configuration options
 * @returns Object with data, loading, error, and reload function
 * 
 * @example
 * ```typescript
 * const { data: customers, loading, error, reload } = useDataLoader(
 *   () => customersApi.getAll(),
 *   { reloadEventName: 'reloadCustomers' }
 * );
 * ```
 */
export function useDataLoader<T>(
  fetchFn: () => Promise<T[]>,
  options: UseDataLoaderOptions = {}
): UseDataLoaderResult<T> {
  const { reloadEventName, immediate = true } = options;
  
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchFn();
      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load data";
      setError(errorMessage);
      setData([]);
      console.error("[useDataLoader] Error:", err);
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  // Load data on mount if immediate is true
  useEffect(() => {
    if (immediate) {
      loadData();
    }
  }, [loadData, immediate]);

  // Listen for reload events
  useEffect(() => {
    if (!reloadEventName) return;
    
    const handleReload = () => {
      loadData();
    };
    
    window.addEventListener(reloadEventName, handleReload);
    return () => {
      window.removeEventListener(reloadEventName, handleReload);
    };
  }, [reloadEventName, loadData]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    data,
    loading,
    error,
    reload: loadData,
    clearError,
  };
}
