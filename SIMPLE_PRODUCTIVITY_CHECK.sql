-- SIMPLE PRODUCTIVITY RLS CHECK
-- Basic diagnostic to identify productivity data access issues
-- Run this in Supabase SQL Editor

-- Step 1: Check if you're authenticated
SELECT 
  'Authentication Check' as step,
  auth.uid() as user_id,
  CASE 
    WHEN auth.uid() IS NOT NULL THEN 'Authenticated ✅'
    ELSE 'Not authenticated ❌'
  END as auth_status;

-- Step 2: Check RLS policies for key tables
SELECT 
  'RLS Policies Check' as step,
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%has_role.*director%' THEN 'Director access ✅'
    WHEN qual LIKE '%auth.uid()' THEN 'User access ✅'
    ELSE 'Other/None ⚠️'
  END as access_type
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('profiles', 'assignments', 'attendance')
ORDER BY tablename, policyname;

-- Step 3: Test basic data access
SELECT 
  'Data Access Test' as step,
  'profiles' as table_name,
  COUNT(*) as total_records
FROM profiles;

SELECT 
  'Data Access Test' as step,
  'assignments' as table_name,
  COUNT(*) as total_records
FROM assignments;

SELECT 
  'Data Access Test' as step,
  'attendance' as table_name,
  COUNT(*) as total_records
FROM attendance;

-- Step 4: Test director-specific access (if you are a director)
SELECT 
  'Director Access Test' as step,
  'profiles (employees only)' as table_name,
  COUNT(*) as accessible_records
FROM profiles 
WHERE role = 'employee'  -- This might need adjustment based on actual schema
LIMIT 1;  -- Just to test if the query works

-- Note: If you get errors on the queries above, the RLS policies are likely blocking access
-- Run the FIX_PRODUCTIVITY_RLS.sql script to create proper policies
