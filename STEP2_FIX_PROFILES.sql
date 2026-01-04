-- STEP 2: Fix PROFILES RLS Performance Issues
-- Run this after STEP1_FIX_ASSIGNMENTS.sql

-- Fix PROFILES policies
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Directors can view all profiles" ON public.profiles;

-- Recreate with optimized auth calls
CREATE POLICY "Users can insert own profile" ON public.profiles 
FOR INSERT WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Users can update own profile" ON public.profiles 
FOR UPDATE USING ((select auth.uid()) = id);

CREATE POLICY "Users can view own profile" ON public.profiles 
FOR SELECT USING ((select auth.uid()) = id);

CREATE POLICY "Directors can view all profiles" ON public.profiles 
FOR SELECT USING (public.has_role((select auth.uid()), 'director'::public.app_role));

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
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY policyname;
