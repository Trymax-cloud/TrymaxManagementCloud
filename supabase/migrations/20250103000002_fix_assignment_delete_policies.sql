-- Fix assignment delete policies - ensure they are properly applied
-- This migration ensures the delete policies are correctly set up

-- First, ensure RLS is enabled
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Directors can delete any assignment" ON public.assignments;
DROP POLICY IF EXISTS "Users can delete their own assignments" ON public.assignments;

-- Create clean delete policies
CREATE POLICY "Directors can delete any assignment" ON public.assignments 
FOR DELETE USING (public.has_role(auth.uid(), 'director'::public.app_role));

CREATE POLICY "Users can delete their own assignments" ON public.assignments 
FOR DELETE USING (auth.uid() = creator_id);

-- Also add policy for assignees to delete their own assignments (if needed)
CREATE POLICY "Assignees can delete their assigned assignments" ON public.assignments 
FOR DELETE USING (auth.uid() = assignee_id);

-- Verify policies are applied
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'assignments' AND cmd = 'DELETE';
