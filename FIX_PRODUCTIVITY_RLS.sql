-- FIX PRODUCTIVITY RLS POLICIES
-- Fix RLS policies for profiles, assignments, and attendance tables
-- Run this in Supabase SQL Editor if CHECK_PRODUCTIVITY_RLS.sql reveals issues

-- Fix profiles RLS policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Directors can view all profiles" ON public.profiles;

-- Create proper PERMISSIVE policies for profiles
CREATE POLICY "Directors can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'director'));

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Fix assignments RLS policies
DROP POLICY IF EXISTS "Users can view own assignments" ON public.assignments;
DROP POLICY IF EXISTS "Users can update own assignments" ON public.assignments;
DROP POLICY IF EXISTS "Directors can view all assignments" ON public.assignments;

-- Create proper PERMISSIVE policies for assignments
CREATE POLICY "Directors can view all assignments"
ON public.assignments
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'director'));

CREATE POLICY "Users can view own assignments"
ON public.assignments
FOR SELECT
TO authenticated
USING (assignee_id = auth.uid());

CREATE POLICY "Users can update own assignments"
ON public.assignments
FOR UPDATE
TO authenticated
USING (assignee_id = auth.uid())
WITH CHECK (assignee_id = auth.uid());

-- Fix attendance RLS policies
DROP POLICY IF EXISTS "Users can view own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Users can update own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Directors can view all attendance" ON public.attendance;

-- Create proper PERMISSIVE policies for attendance
CREATE POLICY "Directors can view all attendance"
ON public.attendance
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'director'));

CREATE POLICY "Users can view own attendance"
ON public.attendance
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update own attendance"
ON public.attendance
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Verify all policies were created correctly
SELECT 
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  CASE 
    WHEN qual LIKE '%EXISTS.*user_roles.*director%' THEN 'DIRECTOR_ACCESS ✅'
    WHEN qual LIKE '%auth.uid() = id%' OR qual LIKE '%assignee_id = auth.uid()' OR qual LIKE '%user_id = auth.uid()' THEN 'USER_ACCESS ✅'
    WHEN qual IS NULL THEN 'PUBLIC_ACCESS ⚠️'
    ELSE 'OTHER ❌'
  END as access_type
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('profiles', 'assignments', 'attendance')
ORDER BY tablename, policyname;

-- Test director access after fixes
SELECT 
  'POST-FIX: profiles Director Test' as test_description,
  COUNT(*) as accessible_records
FROM profiles p
JOIN user_roles ur ON p.id = ur.user_id
WHERE ur.role = 'employee';

SELECT 
  'POST-FIX: assignments Director Test' as test_description,
  COUNT(*) as accessible_records
FROM assignments;

SELECT 
  'POST-FIX: attendance Director Test' as test_description,
  COUNT(*) as accessible_records
FROM attendance;
