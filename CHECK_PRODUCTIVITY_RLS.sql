-- CHECK PRODUCTIVITY RLS POLICIES
-- Debug script to check RLS policies for productivity data
-- Run this in Supabase SQL Editor to identify RLS issues

-- Check current user and role (using user_roles table)
SELECT 
  'Current User Info' as info_type,
  auth.uid() as user_id,
  ur.role as user_role
FROM user_roles ur
WHERE ur.user_id = auth.uid();

-- Check if user exists in profiles table
SELECT 
  'Profile Check' as info_type,
  auth.uid() as user_id,
  CASE 
    WHEN EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()) THEN 'Profile exists ✅'
    ELSE 'Profile not found ❌'
  END as profile_status;

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
-- Test profiles access (employees only)
SELECT 
  'profiles - Director Access Test' as test_description,
  COUNT(*) as accessible_records,
  'Should return all employee profiles' as expected_result
FROM profiles p
JOIN user_roles ur ON p.id = ur.user_id
WHERE ur.role = 'employee';

-- Test assignments access
SELECT 
  'assignments - Director Access Test' as test_description,
  COUNT(*) as accessible_records,
  'Should return all assignments' as expected_result
FROM assignments;

-- Test attendance access (if table exists)
SELECT 
  'attendance - Director Access Test' as test_description,
  COUNT(*) as accessible_records,
  'Should return all attendance records' as expected_result
FROM attendance;

-- Check if tables exist and have data
SELECT 
  'profiles' as table_name,
  (SELECT COUNT(*) FROM profiles) as total_records,
  (SELECT COUNT(*) FROM profiles p JOIN user_roles ur ON p.id = ur.user_id WHERE ur.role = 'employee') as employee_records
UNION ALL
SELECT 
  'assignments' as table_name,
  (SELECT COUNT(*) FROM assignments) as total_records,
  (SELECT COUNT(*) FROM assignments WHERE assignee_id IN (SELECT user_id FROM user_roles WHERE role = 'employee')) as employee_records
UNION ALL
SELECT 
  'attendance' as table_name,
  (SELECT COUNT(*) FROM attendance) as total_records,
  (SELECT COUNT(*) FROM attendance WHERE user_id IN (SELECT user_id FROM user_roles WHERE role = 'employee')) as employee_records;
