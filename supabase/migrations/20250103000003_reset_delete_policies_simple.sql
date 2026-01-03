-- Remove all delete policies and create simple clean one
-- This will completely reset delete functionality

-- Drop ALL existing delete policies
DROP POLICY IF EXISTS "Allow creator or director to delete assignments" ON public.assignments;
DROP POLICY IF EXISTS "Assignees can delete their assigned assignments" ON public.assignments;
DROP POLICY IF EXISTS "Directors can delete any assignment" ON public.assignments;
DROP POLICY IF EXISTS "Users can delete their own assignments" ON public.assignments;

-- Create one simple delete policy: Only directors can delete
CREATE POLICY "Only directors can delete assignments" ON public.assignments 
FOR DELETE USING (public.has_role(auth.uid(), 'director'::public.app_role));

-- Verify only one policy exists
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
