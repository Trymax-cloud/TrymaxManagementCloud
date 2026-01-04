-- ============================================================
-- EWMP EMPLOYEE VISIBILITY FIX
-- Fix RLS policies so directors can see all employees
-- ============================================================

-- First, let's see what's currently happening with profiles and roles
SELECT 
  'CURRENT PROFILES AND ROLES' as info,
  p.id as user_id,
  p.name,
  p.email,
  r.role::text as role_text,
  p.created_at as profile_created_at,
  r.created_at as role_created_at
FROM public.profiles p
LEFT JOIN public.user_roles r ON p.id = r.user_id
ORDER BY p.created_at DESC;

-- Check current RLS policies on profiles
SELECT 
  'PROFILES POLICIES' as info,
  policyname,
  cmd,
  qual,
  CASE 
    WHEN qual LIKE '%(select auth.uid())%' THEN 'OPTIMIZED ✅'
    ELSE 'NEEDS FIX ❌'
  END as auth_status
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'profiles'
ORDER BY cmd, policyname;

-- Check current RLS policies on user_roles
SELECT 
  'USER_ROLES POLICIES' as info,
  policyname,
  cmd,
  qual,
  CASE 
    WHEN qual LIKE '%(select auth.uid())%' THEN 'OPTIMIZED ✅'
    ELSE 'NEEDS FIX ❌'
  END as auth_status
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'user_roles'
ORDER BY cmd, policyname;

-- ============================================================
-- FIX PROFILES POLICIES FOR DIRECTOR VISIBILITY
-- ============================================================

-- Drop existing profiles policies
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profile_self" ON public.profiles;
DROP POLICY IF EXISTS "profile_director" ON public.profiles;

-- Create new policies that allow directors to see all profiles
CREATE POLICY "profiles_select"
ON public.profiles FOR SELECT
USING (
  (select auth.uid()) = id
  OR public.has_role((select auth.uid()), 'director')
);

CREATE POLICY "profiles_update"
ON public.profiles FOR UPDATE
USING ((select auth.uid()) = id);

-- ============================================================
-- FIX USER_ROLES POLICIES FOR DIRECTOR VISIBILITY
-- ============================================================

-- Drop existing user_roles policies
DROP POLICY IF EXISTS "roles_select" ON public.user_roles;
DROP POLICY IF EXISTS "roles_self" ON public.user_roles;

-- Create new policies that allow directors to see all roles
CREATE POLICY "roles_select"
ON public.user_roles FOR SELECT
USING (
  (select auth.uid()) = user_id
  OR public.has_role((select auth.uid()), 'director')
);

-- ============================================================
-- TEST THE FIX
-- ============================================================

-- Test query that should work for directors (simulated)
-- This simulates what the frontend is trying to fetch
SELECT 
  'TEST QUERY - EMPLOYEES LIST' as info,
  p.id,
  p.name,
  p.email,
  r.role::text as role,
  CASE 
    WHEN r.role = 'director' THEN '👑 DIRECTOR'
    WHEN r.role = 'employee' THEN '👤 EMPLOYEE'
    ELSE '❓ UNKNOWN'
  END as user_type
FROM public.profiles p
INNER JOIN public.user_roles r ON p.id = r.user_id
WHERE r.role = 'employee'
ORDER BY p.name;

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Show final policy state
SELECT 
  'FINAL PROFILES POLICIES' as info,
  policyname,
  cmd,
  qual,
  CASE 
    WHEN qual LIKE '%(select auth.uid())%' THEN 'OPTIMIZED ✅'
    ELSE 'NEEDS FIX ❌'
  END as auth_status
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'profiles'
ORDER BY cmd, policyname;

SELECT 
  'FINAL USER_ROLES POLICIES' as info,
  policyname,
  cmd,
  qual,
  CASE 
    WHEN qual LIKE '%(select auth.uid())%' THEN 'OPTIMIZED ✅'
    ELSE 'NEEDS FIX ❌'
  END as auth_status
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'user_roles'
ORDER BY cmd, policyname;

-- ============================================================
-- FRONTEND DEBUGGING HELP
-- ============================================================

-- If you still can't see employees, check your frontend hooks
-- The issue might be in how the data is being fetched
-- Look for hooks like useProfiles, useUsers, etc.

-- ============================================================
-- DONE ✅
-- ============================================================
