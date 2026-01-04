-- ============================================================
-- EWPM ROLE DUPLICATION FIX - CORRECTED
-- Fix the handle_new_user trigger to prevent duplicate roles
-- ============================================================

-- First, let's see what's currently happening
SELECT 
  'CURRENT USER ROLES' as info,
  u.id as user_id,
  u.email,
  p.name,
  r.role::text as role_text,
  r.created_at as role_created_at,
  p.created_at as profile_created_at
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
LEFT JOIN public.user_roles r ON u.id = r.user_id
ORDER BY u.created_at DESC;

-- Check for duplicate roles (fixed string_agg)
SELECT 
  'DUPLICATE ROLES CHECK' as info,
  user_id,
  COUNT(*) as role_count,
  STRING_AGG(role::text, ', ') as roles
FROM public.user_roles
GROUP BY user_id
HAVING COUNT(*) > 1;

-- ============================================================
-- FIX THE HANDLE_NEW_USER FUNCTION
-- ============================================================

-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create the corrected function with proper duplicate prevention
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile ONLY if it doesn't exist
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'name','User'), 
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;

  -- Insert user role ONLY if it doesn't exist
  -- This should prevent the duplication issue
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- CLEAN UP EXISTING DUPLICATE ROLES
-- ============================================================

-- Remove duplicate roles, keeping the first one
DELETE FROM public.user_roles
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id
  FROM public.user_roles
  ORDER BY user_id, created_at ASC
);

-- Verify no more duplicates (fixed string_agg)
SELECT 
  'AFTER CLEANUP' as info,
  user_id,
  COUNT(*) as role_count,
  STRING_AGG(role::text, ', ') as roles
FROM public.user_roles
GROUP BY user_id
HAVING COUNT(*) > 1;

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Show final state
SELECT 
  'FINAL STATE' as info,
  u.id as user_id,
  u.email,
  p.name,
  r.role::text as role_text,
  CASE 
    WHEN r.role = 'director' THEN '👑 DIRECTOR'
    WHEN r.role = 'employee' THEN '👤 EMPLOYEE'
    ELSE '❓ UNKNOWN'
  END as user_type
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
LEFT JOIN public.user_roles r ON u.id = r.user_id
ORDER BY u.created_at DESC;

-- ============================================================
-- DONE ✅
-- ============================================================
