-- Add DELETE policies for assignments table
-- Directors can delete any assignment
CREATE POLICY "Directors can delete any assignment" ON public.assignments 
FOR DELETE USING (public.has_role(auth.uid(), 'director'::public.app_role));

-- Users can delete assignments they created
CREATE POLICY "Users can delete their own assignments" ON public.assignments 
FOR DELETE USING (auth.uid() = creator_id);

-- Enable RLS for assignments if not already enabled
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
