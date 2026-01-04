-- ============================================================
-- EWPM USER SETUP FIX - MANUAL VERSION
-- Run this step by step in Supabase SQL Editor
-- ============================================================

-- STEP 1: Find your user ID from auth.users
-- Look for your email in the list and copy the ID
SELECT id, email, created_at 
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 10;

-- STEP 2: Once you have your user ID, replace 'YOUR_USER_ID_HERE' below
-- and run this to set yourself as director

-- Replace YOUR_USER_ID_HERE with your actual user ID from step 1
INSERT INTO public.user_roles (user_id, role) 
VALUES ('YOUR_USER_ID_HERE', 'director') 
ON CONFLICT (user_id) 
DO UPDATE SET role = 'director';

-- STEP 3: Create/update your profile
INSERT INTO public.profiles (id, name, email) 
VALUES (
  'YOUR_USER_ID_HERE', 
  'Admin',  -- Change this to your actual name
  'admin@example.com'  -- Change this to your actual email
) 
ON CONFLICT (id) 
DO UPDATE SET 
  name = 'Admin',  -- Change this to your actual name
  email = 'admin@example.com';  -- Change this to your actual email

-- STEP 4: Verify everything is set up correctly
SELECT 
  p.id,
  p.name,
  p.email,
  r.role,
  CASE 
    WHEN r.role = 'director' THEN '✅ DIRECTOR ACCESS GRANTED'
    ELSE '❌ NOT DIRECTOR'
  END as status
FROM public.profiles p
LEFT JOIN public.user_roles r ON p.id = r.user_id
WHERE p.id = 'YOUR_USER_ID_HERE';

-- ============================================================
-- INSTRUCTIONS:
-- 1. Run STEP 1 to find your user ID
-- 2. Copy your user ID and replace 'YOUR_USER_ID_HERE' in steps 2-4
-- 3. Run steps 2-4 with your actual user ID
-- 4. Refresh your application
-- ============================================================
