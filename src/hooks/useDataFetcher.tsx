import { useState, useEffect, useCallback } from 'react';

interface UseDataFetcherOptions<T> {
  fetchFn: () => Promise<T>;
  dependencies?: any[];
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

interface UseDataFetcherResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useDataFetcher<T>({
  fetchFn,
  dependencies = [],
  onSuccess,
  onError,
}: UseDataFetcherOptions<T>): UseDataFetcherResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    // Cancel previous request if still pending
    if (abortController) {
      abortController.abort();
    }

    const newController = new AbortController();
    setAbortController(newController);

    try {
      setIsLoading(true);
      setError(null);
      
      const result = await fetchFn();
      
      // Check if request was aborted
      if (newController.signal.aborted) {
        return;
      }

      setData(result);
      onSuccess?.(result);
    } catch (err) {
      // Don't treat abort as error
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err);
        onError?.(err);
      }
    } finally {
      if (!newController.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [fetchFn, onSuccess, onError]);

  useEffect(() => {
    fetchData();

    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
  }, dependencies);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}
