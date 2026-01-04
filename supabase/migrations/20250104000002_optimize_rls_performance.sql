-- Performance Optimization: Fix RLS auth re-evaluation warnings
-- This migration replaces direct auth.uid() calls with cached subqueries
-- to prevent per-row re-evaluation and improve performance

-- Drop all existing policies that use auth.uid() directly
-- ASSIGNMENTS
DROP POLICY IF EXISTS "Directors can delete any assignment" ON public.assignments;
DROP POLICY IF EXISTS "Users can delete their own assignments" ON public.assignments;
DROP POLICY IF EXISTS "Assignees can delete their assigned assignments" ON public.assignments;
DROP POLICY IF EXISTS "Only directors can delete assignments" ON public.assignments;
DROP POLICY IF EXISTS "Directors can update all assignments" ON public.assignments;
DROP POLICY IF EXISTS "Directors can view all assignments" ON public.assignments;
DROP POLICY IF EXISTS "Users can create assignments" ON public.assignments;

-- MEETINGS
DROP POLICY IF EXISTS "Directors can delete any meeting" ON public.meetings;
DROP POLICY IF EXISTS "Directors can update any meeting" ON public.meetings;
DROP POLICY IF EXISTS "Directors can view all meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users can create meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users can delete their own meetings" ON public.meetings;

-- CLIENT_PAYMENTS
DROP POLICY IF EXISTS "Directors can manage payments" ON public.client_payments;

-- PROJECTS
DROP POLICY IF EXISTS "Directors can manage projects" ON public.projects;

-- EMPLOYEE_RATINGS
DROP POLICY IF EXISTS "Directors can manage ratings" ON public.employee_ratings;

-- ATTENDANCE
DROP POLICY IF EXISTS "Directors can update any attendance" ON public.attendance;
DROP POLICY IF EXISTS "Directors can view all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Employees can insert own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Employees can update own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Employees can view own attendance" ON public.attendance;

-- DAILY_SUMMARIES
DROP POLICY IF EXISTS "Directors can view all daily summaries" ON public.daily_summaries;

-- PROFILES
DROP POLICY IF EXISTS "Directors can view all profiles" ON public.profiles;

-- USER_ROLES
DROP POLICY IF EXISTS "Directors can view all roles" ON public.user_roles;

-- MEETING_PARTICIPANTS
DROP POLICY IF EXISTS "Meeting creators can add participants" ON public.meeting_participants;
DROP POLICY IF EXISTS "Meeting creators can remove participants" ON public.meeting_participants;

-- MESSAGES
DROP POLICY IF EXISTS "Users can view messages in conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;

-- NOTIFICATIONS
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;

-- Now recreate all policies with optimized auth evaluation
-- Use (select auth.uid()) instead of auth.uid() to cache the value

-- ASSIGNMENTS - Optimized policies
CREATE POLICY "Directors can delete any assignment" ON public.assignments 
FOR DELETE USING (public.has_role((select auth.uid()), 'director'::public.app_role));

CREATE POLICY "Users can delete their own assignments" ON public.assignments 
FOR DELETE USING ((select auth.uid()) = creator_id);

CREATE POLICY "Assignees can delete their assigned assignments" ON public.assignments 
FOR DELETE USING ((select auth.uid()) = assignee_id);

CREATE POLICY "Directors can update all assignments" ON public.assignments 
FOR UPDATE USING (public.has_role((select auth.uid()), 'director'::public.app_role));

CREATE POLICY "Directors can view all assignments" ON public.assignments 
FOR SELECT USING (public.has_role((select auth.uid()), 'director'::public.app_role));

CREATE POLICY "Users can create assignments" ON public.assignments 
FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = creator_id);

-- MEETINGS - Optimized policies
CREATE POLICY "Directors can delete any meeting" ON public.meetings 
FOR DELETE USING (public.has_role((select auth.uid()), 'director'::public.app_role));

CREATE POLICY "Directors can update any meeting" ON public.meetings 
FOR UPDATE USING (public.has_role((select auth.uid()), 'director'::public.app_role));

CREATE POLICY "Directors can view all meetings" ON public.meetings 
FOR SELECT USING (public.has_role((select auth.uid()), 'director'::public.app_role));

CREATE POLICY "Users can create meetings" ON public.meetings 
FOR INSERT WITH CHECK ((select auth.uid()) = created_by);

CREATE POLICY "Users can delete their own meetings" ON public.meetings 
FOR DELETE USING ((select auth.uid()) = created_by);

-- CLIENT_PAYMENTS - Optimized policies
CREATE POLICY "Directors can manage payments" ON public.client_payments 
USING (public.has_role((select auth.uid()), 'director'::public.app_role));

-- PROJECTS - Optimized policies
CREATE POLICY "Directors can manage projects" ON public.projects 
USING (public.has_role((select auth.uid()), 'director'::public.app_role));

-- EMPLOYEE_RATINGS - Optimized policies
CREATE POLICY "Directors can manage ratings" ON public.employee_ratings 
USING (public.has_role((select auth.uid()), 'director'::public.app_role));

-- ATTENDANCE - Optimized policies
CREATE POLICY "Directors can update any attendance" ON public.attendance 
FOR UPDATE USING (public.has_role((select auth.uid()), 'director'::public.app_role));

CREATE POLICY "Directors can view all attendance" ON public.attendance 
FOR SELECT USING (public.has_role((select auth.uid()), 'director'::public.app_role));

CREATE POLICY "Employees can insert own attendance" ON public.attendance 
FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Employees can update own attendance" ON public.attendance 
FOR UPDATE USING ((select auth.uid()) = user_id);

CREATE POLICY "Employees can view own attendance" ON public.attendance 
FOR SELECT USING ((select auth.uid()) = user_id);

-- DAILY_SUMMARIES - Optimized policies
CREATE POLICY "Directors can view all daily summaries" ON public.daily_summaries 
FOR SELECT USING (public.has_role((select auth.uid()), 'director'::public.app_role));

-- PROFILES - Optimized policies
CREATE POLICY "Directors can view all profiles" ON public.profiles 
FOR SELECT USING (public.has_role((select auth.uid()), 'director'::public.app_role));

-- USER_ROLES - Optimized policies
CREATE POLICY "Directors can view all roles" ON public.user_roles 
FOR SELECT USING (public.has_role((select auth.uid()), 'director'::public.app_role));

-- MEETING_PARTICIPANTS - Optimized policies
CREATE POLICY "Meeting creators can add participants" ON public.meeting_participants 
FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
  FROM public.meetings m
  WHERE ((m.id = meeting_participants.meeting_id) AND (m.created_by = (select auth.uid()))))) 
  OR public.has_role((select auth.uid()), 'director'::public.app_role)));

CREATE POLICY "Meeting creators can remove participants" ON public.meeting_participants 
FOR DELETE USING (((EXISTS ( SELECT 1
  FROM public.meetings m
  WHERE ((m.id = meeting_participants.meeting_id) AND (m.created_by = (select auth.uid()))))) 
  OR public.has_role((select auth.uid()), 'director'::public.app_role)));

-- MESSAGES - Optimized policies
CREATE POLICY "Users can view messages in conversations" ON public.messages 
FOR SELECT USING (
  (EXISTS (
    SELECT 1 FROM public.conversation_participants cp 
    WHERE cp.conversation_id = messages.conversation_id 
    AND cp.user_id = (select auth.uid())
  ))
);

CREATE POLICY "Users can send messages" ON public.messages 
FOR INSERT WITH CHECK ((select auth.uid()) = sender_id);

-- NOTIFICATIONS - Optimized policies
CREATE POLICY "Users can view own notifications" ON public.notifications 
FOR SELECT USING ((select auth.uid()) = user_id);

-- Enable RLS on all tables if not already enabled
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Add performance indexes for frequently queried columns
-- Only create if they don't already exist
DO $$
BEGIN
    -- Assignments indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'assignments' AND indexname = 'idx_assignments_assignee_id') THEN
        CREATE INDEX idx_assignments_assignee_id ON public.assignments(assignee_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'assignments' AND indexname = 'idx_assignments_status') THEN
        CREATE INDEX idx_assignments_status ON public.assignments(status);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'assignments' AND indexname = 'idx_assignments_due_date') THEN
        CREATE INDEX idx_assignments_due_date ON public.assignments(due_date);
    END IF;
    
    -- Client payments indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'client_payments' AND indexname = 'idx_client_payments_due_date') THEN
        CREATE INDEX idx_client_payments_due_date ON public.client_payments(due_date);
    END IF;
    
    -- Notifications indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'notifications' AND indexname = 'idx_notifications_user_id') THEN
        CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
    END IF;
END $$;

-- Verify policies are optimized (no direct auth.uid() calls)
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE qual LIKE '%auth.uid()%' OR qual LIKE '%current_setting%'
ORDER BY tablename, policyname;

-- This should return no rows if all policies are optimized
