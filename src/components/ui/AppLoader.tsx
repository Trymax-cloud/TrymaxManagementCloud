import React from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface AppLoaderProps {
  children: React.ReactNode;
  isAppReady: boolean;
}

export function AppLoader({ children, isAppReady }: AppLoaderProps) {
  if (!isAppReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mb-4" />
          <h2 className="text-lg font-medium text-gray-900">Loading Application...</h2>
          <p className="text-sm text-gray-600 mt-2">Please wait while we prepare your workspace</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
