-- Fix assignment delete policies to allow users to delete their own or assigned assignments
-- This restores proper delete permissions for regular users

-- Drop the restrictive policy that only allows directors to delete
DROP POLICY IF EXISTS "Only directors can delete assignments" ON public.assignments;

-- Create proper delete policies
-- Directors can delete any assignment
CREATE POLICY "Directors can delete any assignment" ON public.assignments 
FOR DELETE USING (public.has_role(auth.uid(), 'director'::public.app_role));

-- Users can delete assignments they created
CREATE POLICY "Users can delete their own assignments" ON public.assignments 
FOR DELETE USING (auth.uid() = creator_id);

-- Users can delete assignments assigned to them
CREATE POLICY "Assignees can delete their assigned assignments" ON public.assignments 
FOR DELETE USING (auth.uid() = assignee_id);

-- Add a comment to document this fix
COMMENT ON POLICY "Users can delete their own assignments" ON public.assignments IS 'Allows users to delete assignments they created (fixed on 2026-01-03)';
COMMENT ON POLICY "Assignees can delete their assigned assignments" ON public.assignments IS 'Allows users to delete assignments assigned to them (fixed on 2026-01-03)';
