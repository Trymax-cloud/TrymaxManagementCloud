-- Fix meeting notifications RLS policy
-- Allow users to insert notifications for other users when creating meetings

DROP POLICY IF EXISTS "notifications_self" ON public.notifications;

-- Policy for viewing and updating own notifications
CREATE POLICY "notifications_self_view_update" 
ON public.notifications FOR SELECT, UPDATE 
USING ((select auth.uid()) = user_id);

-- Policy for inserting notifications (allow inserting for other users)
CREATE POLICY "notifications_insert" 
ON public.notifications FOR INSERT 
WITH CHECK (true);
