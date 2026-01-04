-- ============================================================
-- EWPM USER SETUP FIX
-- This will set up your user as a director so you can access all features
-- ============================================================

-- First, check your current user ID
SELECT auth.uid() as your_user_id;

-- Check if you have a user role
SELECT * FROM public.user_roles WHERE user_id = auth.uid();

-- Check if you have a profile
SELECT * FROM public.profiles WHERE id = auth.uid();

-- If you need to set yourself as director, run this:
-- (Replace 'your-user-id' with the ID from the first query)

-- Insert/update your role to director
INSERT INTO public.user_roles (user_id, role) 
VALUES (auth.uid(), 'director') 
ON CONFLICT (user_id) 
DO UPDATE SET role = 'director';

-- Verify the role was set
SELECT * FROM public.user_roles WHERE user_id = auth.uid();

-- Also update your profile if needed
INSERT INTO public.profiles (id, name, email) 
VALUES (
  auth.uid(), 
  COALESCE((SELECT raw_user_meta_data->>'name' FROM auth.users WHERE id = auth.uid()), 'Admin'),
  COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'admin@example.com')
) 
ON CONFLICT (id) 
DO UPDATE SET 
  name = COALESCE((SELECT raw_user_meta_data->>'name' FROM auth.users WHERE id = auth.uid()), 'Admin'),
  email = COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'admin@example.com');

-- Final verification
SELECT 
  p.id,
  p.name,
  p.email,
  r.role,
  'SETUP COMPLETE' as status
FROM public.profiles p
LEFT JOIN public.user_roles r ON p.id = r.user_id
WHERE p.id = auth.uid();
