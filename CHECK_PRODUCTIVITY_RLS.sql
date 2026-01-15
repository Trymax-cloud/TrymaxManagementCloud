-- CHECK PRODUCTIVITY RLS POLICIES
-- Debug script to check RLS policies for productivity data
-- Run this in Supabase SQL Editor to identify RLS issues

-- Check current user and role
SELECT 
  'Current User Info' as info_type,
  auth.uid() as user_id,
  auth.jwt() as jwt_token,
  (SELECT user_metadata->>'role' FROM auth.users WHERE id = auth.uid()) as user_role;

-- Check RLS policies for profiles table
SELECT 
  'profiles RLS Policies' as table_name,
  policyname,
  cmd,
  roles,
  qual,
  CASE 
    WHEN qual LIKE '%has_role.*director%' THEN 'DIRECTOR_ACCESS ✅'
    WHEN qual LIKE '%auth.uid() = id%' THEN 'SELF_ACCESS ✅'
    WHEN qual IS NULL THEN 'PUBLIC_ACCESS ⚠️'
    ELSE 'OTHER ❌'
  END as access_type
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY policyname;

-- Check RLS policies for assignments table
SELECT 
  'assignments RLS Policies' as table_name,
  policyname,
  cmd,
  roles,
  qual,
  CASE 
    WHEN qual LIKE '%has_role.*director%' THEN 'DIRECTOR_ACCESS ✅'
    WHEN qual LIKE '%assignee_id = auth.uid()' THEN 'ASSIGNEE_ACCESS ✅'
    WHEN qual IS NULL THEN 'PUBLIC_ACCESS ⚠️'
    ELSE 'OTHER ❌'
  END as access_type
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'assignments'
ORDER BY policyname;

-- Check RLS policies for attendance table
SELECT 
  'attendance RLS Policies' as table_name,
  policyname,
  cmd,
  roles,
  qual,
  CASE 
    WHEN qual LIKE '%has_role.*director%' THEN 'DIRECTOR_ACCESS ✅'
    WHEN qual LIKE '%user_id = auth.uid()' THEN 'SELF_ACCESS ✅'
    WHEN qual IS NULL THEN 'PUBLIC_ACCESS ⚠️'
    ELSE 'OTHER ❌'
  END as access_type
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'attendance'
ORDER BY policyname;

-- Test data access for directors
-- Test profiles access
SELECT 
  'profiles - Director Access Test' as test_description,
  COUNT(*) as accessible_records,
  'Should return all employee profiles' as expected_result
FROM profiles 
WHERE has_role((select auth.uid()), 'director'::app_role) AND role = 'employee';

-- Test assignments access
SELECT 
  'assignments - Director Access Test' as test_description,
  COUNT(*) as accessible_records,
  'Should return all assignments' as expected_result
FROM assignments 
WHERE has_role((select auth.uid()), 'director'::app_role);

-- Test attendance access
SELECT 
  'attendance - Director Access Test' as test_description,
  COUNT(*) as accessible_records,
  'Should return all attendance records' as expected_result
FROM attendance 
WHERE has_role((select auth.uid()), 'director'::app_role);

-- Check if tables exist and have data
SELECT 
  'profiles' as table_name,
  (SELECT COUNT(*) FROM profiles) as total_records,
  (SELECT COUNT(*) FROM profiles WHERE role = 'employee') as employee_records
UNION ALL
SELECT 
  'assignments' as table_name,
  (SELECT COUNT(*) FROM assignments) as total_records,
  (SELECT COUNT(*) FROM assignments WHERE assignee_id IN (SELECT id FROM profiles WHERE role = 'employee')) as employee_records
UNION ALL
SELECT 
  'attendance' as table_name,
  (SELECT COUNT(*) FROM attendance) as total_records,
  (SELECT COUNT(*) FROM attendance WHERE user_id IN (SELECT id FROM profiles WHERE role = 'employee')) as employee_records;
