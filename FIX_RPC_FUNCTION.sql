-- ============================================================
-- EWMP EMPLOYEE VISIBILITY FIX - RPC FUNCTION
-- Fix the missing get_verified_profiles function
-- ============================================================

-- Check if the RPC function exists
SELECT 
  'RPC FUNCTIONS CHECK' as info,
  proname as function_name,
  prosrc as source_code
FROM pg_proc 
WHERE proname = 'get_verified_profiles';

-- ============================================================
-- CREATE THE MISSING RPC FUNCTION
-- ============================================================

-- Drop the function if it exists (to recreate it properly)
DROP FUNCTION IF EXISTS public.get_verified_profiles();

-- Create the proper function to get all profiles for directors
CREATE OR REPLACE FUNCTION public.get_verified_profiles()
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return query result
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.email,
    p.avatar_url,
    p.created_at,
    p.updated_at,
    r.role::text
  FROM public.profiles p
  INNER JOIN public.user_roles r ON p.id = r.user_id
  WHERE 
    -- Directors can see everyone
    public.has_role((select auth.uid()), 'director') = true
    -- Employees can only see themselves
    OR p.id = (select auth.uid())
  ORDER BY p.name;
END;
$$;

-- ============================================================
-- ALTERNATIVE: FIX THE FRONTEND HOOK DIRECTLY
-- ============================================================

-- Instead of using RPC, let's create a simpler approach
-- The frontend can just query profiles directly with proper RLS

-- ============================================================
-- TEST THE RPC FUNCTION
-- ============================================================

-- Test the function (this simulates what the frontend calls)
SELECT * FROM public.get_verified_profiles();

-- ============================================================
-- BACKUP: CREATE A SIMPLER FUNCTION
-- ============================================================

-- If the above doesn't work, create a simpler version
CREATE OR REPLACE FUNCTION public.get_all_employees()
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  avatar_url TEXT,
  role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.email,
    p.avatar_url,
    r.role::text
  FROM public.profiles p
  INNER JOIN public.user_roles r ON p.id = r.user_id
  WHERE r.role = 'employee'
  ORDER BY p.name;
END;
$$;

-- Test the simpler function
SELECT * FROM public.get_all_employees();

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Show all RPC functions
SELECT 
  'ALL RPC FUNCTIONS' as info,
  proname as function_name,
  prosrc as source_code
FROM pg_proc 
WHERE proname IN ('get_verified_profiles', 'get_all_employees')
ORDER BY proname;

-- ============================================================
-- FRONTEND FIX OPTION
-- ============================================================

-- If RPC functions don't work, update the frontend hook to:
-- 1. Remove the RPC call
-- 2. Use direct table queries with proper RLS
-- 3. Add role-based filtering in the frontend

-- ============================================================
-- DONE ✅
-- ============================================================
