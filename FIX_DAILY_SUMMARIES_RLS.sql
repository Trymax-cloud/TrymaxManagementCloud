-- FIX DAILY SUMMARIES RLS POLICIES
-- Allow directors to see all employees' daily notes
-- Run this in Supabase SQL Editor to fix daily reports visibility

-- Drop existing restrictive RLS policies on daily_summaries
DROP POLICY IF EXISTS "Directors can view all daily summaries" ON public.daily_summaries;
DROP POLICY IF EXISTS "Users can manage own daily summaries" ON public.daily_summaries;
DROP POLICY IF EXISTS "Users can view own daily summaries" ON public.daily_summaries;

-- Create proper PERMISSIVE policies for daily_summaries
-- Directors can view ALL daily summaries (not just their own)
CREATE POLICY "Directors can view all daily summaries"
ON public.daily_summaries
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'director'::app_role));

-- Users can view their own daily summaries
CREATE POLICY "Users can view own daily summaries"
ON public.daily_summaries
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own daily summaries
CREATE POLICY "Users can insert own daily summaries"
ON public.daily_summaries
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own daily summaries
CREATE POLICY "Users can update own daily summaries"
ON public.daily_summaries
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Directors can update any daily summary (for admin purposes)
CREATE POLICY "Directors can update all daily summaries"
ON public.daily_summaries
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'director'::app_role));

-- Verify the policies were created correctly
SELECT 
  policyname,
  cmd,
  roles,
  qual,
  CASE 
    WHEN qual LIKE '%has_role.*director%' THEN 'DIRECTOR_ACCESS ✅'
    WHEN qual LIKE '%auth.uid() = user_id%' THEN 'USER_ACCESS ✅'
    ELSE 'OTHER ❌'
  END as access_type
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'daily_summaries'
ORDER BY policyname;

-- Test director access (this should return all rows for directors)
SELECT 
  'Director can access all daily summaries' as test_description,
  COUNT(*) as accessible_summaries
FROM daily_summaries 
WHERE has_role((select auth.uid()), 'director'::app_role);

-- Test user access (this should return only their own rows for users)
SELECT 
  'User can access only their own summaries' as test_description,
  COUNT(*) as accessible_summaries
FROM daily_summaries 
WHERE auth.uid() = user_id;
