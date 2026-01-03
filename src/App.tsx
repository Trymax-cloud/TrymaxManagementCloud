import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { OfflineIndicator } from "@/components/pwa/OfflineIndicator";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { RealtimeProvider } from "@/components/providers/RealtimeProvider";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { useElectronValidation } from "@/utils/validation";

// Lazy load pages for better performance
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Assignments = lazy(() => import("./pages/Assignments"));
const Projects = lazy(() => import("./pages/Projects"));
const Employees = lazy(() => import("./pages/Employees"));
const Ratings = lazy(() => import("./pages/Ratings"));
const Payments = lazy(() => import("./pages/Payments"));
const DailySummary = lazy(() => import("./pages/DailySummary"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Settings = lazy(() => import("./pages/Settings"));
const Messages = lazy(() => import("./pages/Messages"));
const Meetings = lazy(() => import("./pages/Meetings"));
const Reports = lazy(() => import("./pages/Reports"));
const Unauthorized = lazy(() => import("./pages/Unauthorized"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Suspense fallback component
const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <LoadingSpinner size="lg" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => {
  // Temporarily disable Electron validation to debug loading issues
  // useElectronValidation();

  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <OfflineIndicator />
          <InstallPrompt />
          <BrowserRouter>
            <AuthProvider>
              <RealtimeProvider>
                <Suspense fallback={<PageLoader />}>
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
                    <Route path="/reports" element={<ProtectedRoute allowedRoles={["director"]}><Reports /></ProtectedRoute>} />
                    <Route path="/daily-summary" element={<ProtectedRoute><DailySummary /></ProtectedRoute>} />
                    <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
                    <Route path="/meetings" element={<ProtectedRoute><Meetings /></ProtectedRoute>} />
                    <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                    
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </RealtimeProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </SettingsProvider>
    </QueryClientProvider>
  );
};

export default App;
