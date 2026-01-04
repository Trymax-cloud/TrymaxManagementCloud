-- Skip conflicting migrations and apply basic RLS fixes
-- This migration handles the basic auth optimization for critical tables

-- Since policies already exist, we'll just update them directly
-- Update ASSIGNMENTS policies to use optimized auth calls

-- Drop existing assignment policies that need fixing
DROP POLICY IF EXISTS "Directors can delete any assignment" ON public.assignments;
DROP POLICY IF EXISTS "Users can delete their own assignments" ON public.assignments;
DROP POLICY IF EXISTS "Assignees can delete their assigned assignments" ON public.assignments;
DROP POLICY IF EXISTS "Directors can update all assignments" ON public.assignments;
DROP POLICY IF EXISTS "Users can create assignments" ON public.assignments;

-- Recreate with optimized auth calls
CREATE POLICY "Directors can delete any assignment" ON public.assignments 
FOR DELETE USING (public.has_role((select auth.uid()), 'director'::public.app_role));

CREATE POLICY "Users can delete their own assignments" ON public.assignments 
FOR DELETE USING ((select auth.uid()) = creator_id);

CREATE POLICY "Assignees can delete their assigned assignments" ON public.assignments 
FOR DELETE USING ((select auth.uid()) = assignee_id);

CREATE POLICY "Directors can update all assignments" ON public.assignments 
FOR UPDATE USING (public.has_role((select auth.uid()), 'director'::public.app_role));

CREATE POLICY "Users can create assignments" ON public.assignments 
FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = creator_id);

-- Show results
SELECT 
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%(select auth.uid())%' THEN 'OPTIMIZED'
    ELSE 'NEEDS_FIX'
  END as auth_status
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename = 'assignments'
ORDER BY policyname;