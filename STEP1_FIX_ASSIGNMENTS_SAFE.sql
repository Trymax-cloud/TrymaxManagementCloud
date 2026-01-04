-- STEP 1: Fix ASSIGNMENTS RLS Performance (Safe Version)
-- Run this AFTER STEP0_CHECK_AND_RECREATE_TABLES.sql

-- First verify the table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables 
                   WHERE table_schema = 'public' 
                   AND table_name = 'assignments') THEN
        RAISE EXCEPTION 'Assignments table does not exist. Please run STEP0_CHECK_AND_RECREATE_TABLES.sql first.';
    END IF;
END $$;

-- Show current policies before fixing
SELECT 
  'BEFORE FIX' as stage,
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%auth.uid()%' THEN 'NEEDS_FIX'
    WHEN qual LIKE '%(select auth.uid())%' THEN 'OPTIMIZED'
    ELSE 'UNKNOWN'
  END as status
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'assignments'
ORDER BY policyname;

-- Fix ASSIGNMENTS policies (most critical)
-- Drop existing policies that use direct auth calls
DROP POLICY IF EXISTS "Directors can delete any assignment" ON public.assignments;
DROP POLICY IF EXISTS "Users can delete their own assignments" ON public.assignments;
DROP POLICY IF EXISTS "Assignees can delete their assigned assignments" ON public.assignments;
DROP POLICY IF EXISTS "Directors can update all assignments" ON public.assignments;
DROP POLICY IF EXISTS "Users can create assignments" ON public.assignments;
DROP POLICY IF EXISTS "Users can view own assignments" ON public.assignments;
DROP POLICY IF EXISTS "Directors can view all assignments" ON public.assignments;

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

CREATE POLICY "Users can view own assignments" ON public.assignments 
FOR SELECT USING (
  (select auth.uid()) = creator_id OR 
  (select auth.uid()) = assignee_id OR
  public.has_role((select auth.uid()), 'director'::public.app_role)
);

CREATE POLICY "Directors can view all assignments" ON public.assignments 
FOR SELECT USING (public.has_role((select auth.uid()), 'director'::public.app_role));

-- Show results after fixing
SELECT 
  'AFTER FIX' as stage,
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%(select auth.uid())%' THEN 'OPTIMIZED ✅'
    ELSE 'NEEDS_FIX ❌'
  END as status
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'assignments'
ORDER BY policyname;
