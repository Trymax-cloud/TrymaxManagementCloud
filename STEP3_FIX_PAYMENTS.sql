-- STEP 3: Fix CLIENT_PAYMENTS RLS Performance Issues
-- Run this after STEP2_FIX_PROFILES.sql

-- Fix CLIENT_PAYMENTS policies
DROP POLICY IF EXISTS "Directors can manage payments" ON public.client_payments;

-- Recreate with optimized auth calls
CREATE POLICY "Directors can manage payments" ON public.client_payments 
USING (public.has_role((select auth.uid()), 'director'::public.app_role));

-- Verify the fix
SELECT 
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%(select auth.uid())%' THEN 'OPTIMIZED ✅'
    ELSE 'NEEDS_FIX ❌'
  END as status
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'client_payments'
ORDER BY policyname;
