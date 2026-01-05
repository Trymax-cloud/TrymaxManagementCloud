import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useAppGate() {
  const [isAppReady, setIsAppReady] = useState(false);
  const { user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Wait for auth session to resolve
        if (authLoading) return;

        // Get current session
        const { data: { session } } = await supabase.auth.getSession();
        
        // Basic app bootstrap - you can add more initialization here
        // For now, just ensure auth is resolved
        setIsAppReady(true);
      } catch (error) {
        console.error('App initialization failed:', error);
        // Still set app ready to show error UI instead of blank screen
        setIsAppReady(true);
      }
    };

    initializeApp();
  }, [authLoading]);

  return { isAppReady };
}
