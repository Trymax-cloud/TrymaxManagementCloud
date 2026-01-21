import { lazy, Suspense, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, HashRouter } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { OfflineIndicator } from "@/components/pwa/OfflineIndicator";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { RealtimeProvider } from "@/components/providers/RealtimeProvider";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { useElectronValidation } from "@/utils/validation";
import { useAuth } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { AppLoader } from "@/components/ui/AppLoader";
import { useAppGate } from "@/components/ui/AppGate";

// Helper to handle chunk loading errors (happens after new deployments)
const lazyWithRetry = (importFn: () => Promise<{ default: React.ComponentType }>) => {
  return lazy(() =>
    importFn().catch(() => {
      // Chunk failed to load - likely a new deployment with different hashes
      // Reload the page to get the new HTML with correct chunk references
      window.location.reload();
      return { default: () => null };
    })
  );
};

// Use HashRouter for Electron compatibility
const AppRouter = ({ children }: { children: React.ReactNode }) => {
  return <HashRouter>{children}</HashRouter>;
};

// Lazy load pages for better performance with retry on chunk load failure
const Auth = lazyWithRetry(() => import("./pages/Auth"));
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const Assignments = lazyWithRetry(() => import("./pages/Assignments"));
const Projects = lazyWithRetry(() => import("./pages/Projects"));
const Employees = lazyWithRetry(() => import("./pages/Employees"));
const Ratings = lazyWithRetry(() => import("./pages/Ratings"));
const Payments = lazyWithRetry(() => import("./pages/Payments"));
const MyPayments = lazyWithRetry(() => import("./pages/MyPayments"));
const DailySummary = lazyWithRetry(() => import("./pages/DailySummary"));
const Notifications = lazyWithRetry(() => import("./pages/Notifications"));
const Settings = lazyWithRetry(() => import("./pages/Settings"));
const Messages = lazyWithRetry(() => import("./pages/Messages"));
const Meetings = lazyWithRetry(() => import("./pages/Meetings"));
const Reports = lazyWithRetry(() => import("./pages/Reports"));
const Unauthorized = lazyWithRetry(() => import("./pages/Unauthorized"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));

// Suspense fallback component
const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <LoadingSpinner size="lg" />
  </div>
);

function AppContent() {
  const { isAppReady } = useAppGate();

  return (
    <AppLoader isAppReady={isAppReady}>
      <RealtimeProvider>
        <Suspense fallback={<PageLoader />}>
          <AppRouter>
            <Routes>
              <Route path="/" element={<Auth />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/unauthorized" element={<Unauthorized />} />
              
              {/* Protected Routes */}
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/assignments" element={<ProtectedRoute><Assignments /></ProtectedRoute>} />
              <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
              <Route path="/employees" element={<ProtectedRoute allowedRoles={["director"]}><Employees /></ProtectedRoute>} />
              <Route path="/ratings" element={<ProtectedRoute><Ratings /></ProtectedRoute>} />
              <Route path="/payments" element={<ProtectedRoute allowedRoles={["director"]}><Payments /></ProtectedRoute>} />
              <Route path="/my-payments" element={<ProtectedRoute><MyPayments /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute allowedRoles={["director"]}><Reports /></ProtectedRoute>} />
              <Route path="/daily-summary" element={<ProtectedRoute><DailySummary /></ProtectedRoute>} />
              <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
              <Route path="/meetings" element={<ProtectedRoute><Meetings /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppRouter>
        </Suspense>
      </RealtimeProvider>
    </AppLoader>
  );
}

function App() {
  const { isElectron } = useElectronValidation();
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error: any) => {
          // Don't retry on 4xx errors
          if (error?.status >= 400 && error?.status < 500) {
            return false;
          }
          // Retry up to 2 times on other errors
          return failureCount < 2;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 1,
      },
    },
  }));

  useEffect(() => {
    // No notification permission needed for Electron (handled by main process)
    // Only web browsers need permission requests
    return () => {};
  }, []);

  // Handle Electron navigation from notification clicks
  useEffect(() => {
    if (isElectron && (window as any).electronAPI?.onNavigate) {
      const handleNavigate = (url: string) => {
        console.log('🔔 Navigating to:', url);
        window.location.hash = url;
      };
      
      (window as any).electronAPI.onNavigate(handleNavigate);
      
      return () => {
        // Cleanup if needed
      };
    }
  }, [isElectron]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SettingsProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <OfflineIndicator />
            <InstallPrompt />
            <AppContent />
          </TooltipProvider>
        </SettingsProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
