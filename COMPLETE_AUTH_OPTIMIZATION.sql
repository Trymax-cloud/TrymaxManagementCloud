-- ============================================================
-- EWPM COMPLETE AUTH OPTIMIZATION FIX
-- Fix ALL policies to use (select auth.uid()) for performance
-- ============================================================

-- ============================================================
-- 1️⃣ ASSIGNMENTS POLICIES OPTIMIZATION
-- ============================================================

-- Drop and recreate assignments policies with optimized auth
DROP POLICY IF EXISTS "assignments_unified_select" ON public.assignments;
DROP POLICY IF EXISTS "assignments_insert" ON public.assignments;
DROP POLICY IF EXISTS "assignments_update" ON public.assignments;
DROP POLICY IF EXISTS "assignments_unified_delete" ON public.assignments;

CREATE POLICY "assignments_unified_select"
ON public.assignments FOR SELECT
USING (
  creator_id = (select auth.uid())
  OR assignee_id = (select auth.uid())
  OR public.has_role((select auth.uid()), 'director')
);

CREATE POLICY "assignments_insert"
ON public.assignments FOR INSERT
WITH CHECK (creator_id = (select auth.uid()));

CREATE POLICY "assignments_update"
ON public.assignments FOR UPDATE
USING (
  creator_id = (select auth.uid())
  OR assignee_id = (select auth.uid())
  OR public.has_role((select auth.uid()), 'director')
);

CREATE POLICY "assignments_unified_delete"
ON public.assignments FOR DELETE
USING (
  creator_id = (select auth.uid())
  OR public.has_role((select auth.uid()), 'director')
);

-- ============================================================
-- 2️⃣ CLIENT PAYMENTS POLICIES OPTIMIZATION
-- ============================================================

DROP POLICY IF EXISTS "payments_unified_select" ON public.client_payments;
DROP POLICY IF EXISTS "payments_unified_manage" ON public.client_payments;

CREATE POLICY "payments_unified_select"
ON public.client_payments FOR SELECT
USING (
  responsible_user_id = (select auth.uid())
  OR public.has_role((select auth.uid()), 'director')
);

CREATE POLICY "payments_unified_manage"
ON public.client_payments FOR ALL
USING (public.has_role((select auth.uid()), 'director'));

-- ============================================================
-- 3️⃣ DAILY SUMMARIES POLICIES OPTIMIZATION
-- ============================================================

DROP POLICY IF EXISTS "daily_self" ON public.daily_summaries;

CREATE POLICY "daily_self"
ON public.daily_summaries FOR ALL
USING ((select auth.uid()) = user_id);

-- ============================================================
-- 4️⃣ EMPLOYEE RATINGS POLICIES OPTIMIZATION
-- ============================================================

DROP POLICY IF EXISTS "ratings_unified_select" ON public.employee_ratings;
DROP POLICY IF EXISTS "ratings_unified_manage" ON public.employee_ratings;

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
-- 5️⃣ MEETINGS POLICIES OPTIMIZATION
-- ============================================================

DROP POLICY IF EXISTS "meetings_manage" ON public.meetings;

CREATE POLICY "meetings_manage"
ON public.meetings FOR ALL
USING (
  created_by = (select auth.uid())
  OR public.has_role((select auth.uid()), 'director')
);

-- ============================================================
-- 6️⃣ NOTIFICATIONS POLICIES OPTIMIZATION
-- ============================================================

DROP POLICY IF EXISTS "notifications_self" ON public.notifications;

CREATE POLICY "notifications_self"
ON public.notifications FOR ALL
USING ((select auth.uid()) = user_id);

-- ============================================================
-- 7️⃣ PROFILES POLICIES OPTIMIZATION
-- ============================================================

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;

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
-- 8️⃣ PROJECTS POLICIES OPTIMIZATION
-- ============================================================

DROP POLICY IF EXISTS "projects_read" ON public.projects;
DROP POLICY IF EXISTS "projects_manage" ON public.projects;

CREATE POLICY "projects_read"
ON public.projects FOR SELECT USING (true);

CREATE POLICY "projects_manage"
ON public.projects FOR ALL
USING (public.has_role((select auth.uid()), 'director'));

-- ============================================================
-- 9️⃣ USER ROLES POLICIES OPTIMIZATION
-- ============================================================

DROP POLICY IF EXISTS "roles_select" ON public.user_roles;

CREATE POLICY "roles_select"
ON public.user_roles FOR SELECT
USING ((select auth.uid()) = user_id);

-- ============================================================
-- 🔟 FINAL VERIFICATION
-- ============================================================

-- Check all policies are now optimized
SELECT 
  tablename,
  cmd,
  policyname,
  CASE 
    WHEN qual LIKE '%(select auth.uid())%' THEN 'OPTIMIZED ✅'
    WHEN qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(select auth.uid())%' THEN 'NEEDS FIX ❌'
    ELSE 'OK ✅'
  END as auth_status,
  qual
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- Count optimized vs non-optimized policies
SELECT 
  'POLICY OPTIMIZATION SUMMARY' as summary_type,
  COUNT(*) FILTER (WHERE qual LIKE '%(select auth.uid())%') as optimized_policies,
  COUNT(*) FILTER (WHERE qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(select auth.uid())%') as needs_fix,
  COUNT(*) FILTER (WHERE qual NOT LIKE '%auth.uid()%') as ok_policies,
  CASE 
    WHEN COUNT(*) FILTER (WHERE qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(select auth.uid())%') = 0 
    THEN '✅ ALL POLICIES OPTIMIZED'
    ELSE '❌ SOME POLICIES NEED FIX'
  END as overall_status
FROM pg_policies 
WHERE schemaname = 'public';

-- ============================================================
-- DONE ✅
-- ============================================================
