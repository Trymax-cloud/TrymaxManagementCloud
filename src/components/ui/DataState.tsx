import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface DataStateProps<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  children: (data: T) => React.ReactNode;
  emptyMessage?: string;
  loadingMessage?: string;
  showRetryButton?: boolean;
  onRetry?: () => void;
}

export function DataState<T>({
  data,
  isLoading,
  error,
  children,
  emptyMessage = "No data available",
  loadingMessage = "Loading...",
  showRetryButton = true,
  onRetry,
}: DataStateProps<T>) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <LoadingSpinner size="lg" className="mb-4" />
        <p className="text-muted-foreground">{loadingMessage}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-medium mb-2">Something went wrong</h3>
        <p className="text-muted-foreground text-center mb-4">
          {error.message || 'Failed to load data'}
        </p>
        {showRetryButton && onRetry && (
          <Button onClick={onRetry} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No data</h3>
        <p className="text-muted-foreground text-center">
          {emptyMessage}
        </p>
      </div>
    );
  }

  return <>{children(data)}</>;
}
