-- ============================================================
-- EWPM SAFE MODE FIXES - AUTH, RLS, AND UI PERMISSIONS
-- Zero Data Loss • Targeted Fixes Only
-- ============================================================

-- ============================================================
-- 1️⃣ AUTH SIGNUP FIX (CRITICAL)
-- ============================================================

-- Update handle_new_user function with ON CONFLICT DO NOTHING
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
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Recreate ONLY the auth.users trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 3️⃣ ASSIGNMENTS DUPLICATE DATA BUG (RLS FIX)
-- ============================================================

-- Remove ALL existing SELECT policies on assignments
DROP POLICY IF EXISTS "assignments_select" ON public.assignments;
DROP POLICY IF EXISTS "assignments_read" ON public.assignments;
DROP POLICY IF EXISTS "assignments_view" ON public.assignments;
DROP POLICY IF EXISTS "Users can view assignments they created or are assigned to" ON public.assignments;
DROP POLICY IF EXISTS "Directors can view all assignments" ON public.assignments;
DROP POLICY IF EXISTS "Users can view own assignments" ON public.assignments;

-- Create ONE unified SELECT policy
CREATE POLICY "assignments_unified_select"
ON public.assignments FOR SELECT
USING (
  creator_id = (select auth.uid())
  OR assignee_id = (select auth.uid())
  OR public.has_role((select auth.uid()), 'director')
);

-- ============================================================
-- 4️⃣ ASSIGNMENTS DELETE FREEZE FIX
-- ============================================================

-- Remove ALL existing DELETE policies on assignments
DROP POLICY IF EXISTS "assignments_delete" ON public.assignments;
DROP POLICY IF EXISTS "assignments_remove" ON public.assignments;
DROP POLICY IF EXISTS "Directors can delete any assignment" ON public.assignments;
DROP POLICY IF EXISTS "Users can delete their own assignments" ON public.assignments;
DROP POLICY IF EXISTS "Assignees can delete their assigned assignments" ON public.assignments;

-- Create ONE DELETE policy
CREATE POLICY "assignments_unified_delete"
ON public.assignments FOR DELETE
USING (
  creator_id = (select auth.uid())
  OR public.has_role((select auth.uid()), 'director')
);

-- ============================================================
-- 5️⃣ ROLE-BASED UI VISIBILITY FIX (RLS Only)
-- ============================================================

-- Ensure payments policies are correct for director access
DROP POLICY IF EXISTS "payments_select" ON public.client_payments;
DROP POLICY IF EXISTS "payments_manage" ON public.client_payments;
DROP POLICY IF EXISTS "Directors can manage payments" ON public.client_payments;
DROP POLICY IF EXISTS "Users can view payments they are responsible for" ON public.client_payments;

CREATE POLICY "payments_unified_select"
ON public.client_payments FOR SELECT
USING (
  responsible_user_id = (select auth.uid())
  OR public.has_role((select auth.uid()), 'director')
);

CREATE POLICY "payments_unified_manage"
ON public.client_payments FOR ALL
USING (public.has_role((select auth.uid()), 'director'));

-- Ensure ratings policies are correct for director access
DROP POLICY IF EXISTS "ratings_select" ON public.employee_ratings;
DROP POLICY IF EXISTS "ratings_manage" ON public.employee_ratings;
DROP POLICY IF EXISTS "Directors can manage ratings" ON public.employee_ratings;
DROP POLICY IF EXISTS "Users can view own ratings" ON public.employee_ratings;

CREATE POLICY "ratings_unified_select"
ON public.employee_ratings FOR SELECT
USING (
  user_id = (select auth.uid())
  OR public.has_role((select auth.uid()), 'director')
);

CREATE POLICY "ratings_unified_manage"
ON public.employee_ratings FOR ALL
USING (public.has_role((select auth.uid()), 'director'));

-- ============================================================
-- 7️⃣ FINAL VALIDATION
-- ============================================================

-- Confirm exactly ONE SELECT policy on assignments
SELECT 
  'ASSIGNMENTS SELECT POLICIES' as check_type,
  COUNT(*) as policy_count,
  STRING_AGG(policyname, ', ' ORDER BY policyname) as policies
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'assignments' 
  AND cmd = 'SELECT';

-- Confirm exactly ONE DELETE policy on assignments
SELECT 
  'ASSIGNMENTS DELETE POLICIES' as check_type,
  COUNT(*) as policy_count,
  STRING_AGG(policyname, ', ' ORDER BY policyname) as policies
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'assignments' 
  AND cmd = 'DELETE';

-- Confirm no policy uses raw auth.uid()
SELECT 
  'RAW AUTH.UID() CHECK' as check_type,
  COUNT(*) as policies_with_raw_auth,
  'SHOULD BE 0' as expected
FROM pg_policies 
WHERE schemaname = 'public'
  AND (qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(select auth.uid())%');

-- Show all current policies for verification
SELECT 
  tablename,
  cmd,
  policyname,
  CASE 
    WHEN qual LIKE '%(select auth.uid())%' THEN 'OPTIMIZED ✅'
    WHEN qual LIKE '%auth.uid()%' THEN 'NEEDS FIX ❌'
    ELSE 'OK ✅'
  END as auth_status
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- ============================================================
-- DONE ✅
-- ============================================================
