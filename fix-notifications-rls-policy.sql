-- Fix notifications RLS policy to allow meeting creators to insert notifications for participants
-- This will fix the "violates row-level security policy" error

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "notifications_self" ON public.notifications;

-- Create separate policies for different operations
-- 1. Users can view and update their own notifications
CREATE POLICY "notifications_self_view_update" 
ON public.notifications FOR SELECT, UPDATE 
USING ((select auth.uid()) = user_id);

-- 2. Users can insert notifications for other users (needed for meetings, assignments, etc.)
CREATE POLICY "notifications_insert" 
ON public.notifications FOR INSERT 
WITH CHECK (true);

-- 3. Directors can do everything (optional, for admin access)
CREATE POLICY "notifications_director" 
ON public.notifications FOR ALL 
USING (public.has_role((select auth.uid()), 'director'::public.app_role));
