-- ============================================================
-- EWPM SIGNUP ROLE FIX
-- Fix signup to respect user's role selection during signup
-- ============================================================

-- First, let's see what's currently happening
SELECT 
  'CURRENT USER ROLES' as info,
  u.id as user_id,
  u.email,
  u.raw_user_meta_data,
  p.name,
  r.role::text as role_text,
  r.created_at as role_created_at,
  p.created_at as profile_created_at
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
LEFT JOIN public.user_roles r ON u.id = r.user_id
ORDER BY u.created_at DESC;

-- ============================================================
-- FIX THE HANDLE_NEW_USER FUNCTION
-- ============================================================

-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create the corrected function that respects user's role selection
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
  -- Use the role from user metadata, default to 'employee' if not specified
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id, 
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::public.app_role, 
      'employee'
    )
  )
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

-- ============================================================
-- MANUAL ROLE FIX FOR EXISTING USERS
-- ============================================================

-- If you need to manually set a specific user as director, 
-- replace 'user-email@example.com' with the actual email
UPDATE public.user_roles 
SET role = 'director'
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'user-email@example.com'
);

-- Or if you know the user ID, use this directly:
-- UPDATE public.user_roles SET role = 'director' WHERE user_id = 'your-user-id-here';

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Show final state with metadata
SELECT 
  'FINAL STATE' as info,
  u.id as user_id,
  u.email,
  u.raw_user_meta_data->>'role' as selected_role_in_signup,
  p.name,
  r.role::text as actual_role_in_db,
  CASE 
    WHEN r.role = 'director' THEN '👑 DIRECTOR'
    WHEN r.role = 'employee' THEN '👤 EMPLOYEE'
    ELSE '❓ UNKNOWN'
  END as user_type,
  CASE 
    WHEN (u.raw_user_meta_data->>'role')::text = r.role::text THEN '✅ MATCH'
    ELSE '❌ MISMATCH'
  END as role_match
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
LEFT JOIN public.user_roles r ON u.id = r.user_id
ORDER BY u.created_at DESC;

-- ============================================================
-- FRONTEND SIGNUP CHECK
-- ============================================================

-- This query helps verify what role is being passed during signup
-- You can check this in the browser console during signup:
-- console.log('Signup metadata:', { name: 'John', role: 'director' });

-- ============================================================
-- DONE ✅
-- ============================================================
