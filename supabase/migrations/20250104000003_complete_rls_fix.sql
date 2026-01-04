-- Complete RLS Performance Fix - Address ALL remaining auth re-evaluation warnings
-- This migration fixes all remaining policies that use direct auth.uid() calls

-- Drop ALL existing policies that need optimization
-- PROFILES
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Directors can view all profiles" ON public.profiles;

-- ASSIGNMENTS (additional policies not covered in previous migration)
DROP POLICY IF EXISTS "Users can create assignments" ON public.assignments;
DROP POLICY IF EXISTS "Users can update own assignments" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own assignments" ON public.assignments;
DROP POLICY IF EXISTS "Directors can manage assignments" ON public.assignments;

-- EMPLOYEE_RATINGS
DROP POLICY IF EXISTS "Users can view own ratings" ON public.employee_ratings;
DROP POLICY IF EXISTS "Directors can manage ratings" ON public.employee_ratings;

-- ASSIGNMENT_STATUS_HISTORY
DROP POLICY IF EXISTS "Users can insert status history" ON public.assignment_status_history;

-- ATTENDANCE (all policies)
DROP POLICY IF EXISTS "Employees can insert own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Employees can update own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Employees can view own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Directors can view all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Directors can update any attendance" ON public.attendance;

-- DAILY_SUMMARIES (all policies)
DROP POLICY IF EXISTS "Users can view own daily summaries" ON public.daily_summaries;
DROP POLICY IF EXISTS "Users can manage own daily summaries" ON public.daily_summaries;
DROP POLICY IF EXISTS "Directors can view all daily summaries" ON public.daily_summaries;

-- MEETINGS (all policies)
DROP POLICY IF EXISTS "Users can create meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users can delete their own meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users can manage own meetings" ON public.meetings;
DROP POLICY IF EXISTS "Directors can manage all meetings" ON public.meetings;

-- MEETING_PARTICIPANTS (all policies)
DROP POLICY IF EXISTS "Users can view participants for meetings they have access to" ON public.meeting_participants;
DROP POLICY IF EXISTS "Meeting creators can add participants" ON public.meeting_participants;
DROP POLICY IF EXISTS "Meeting creators can remove participants" ON public.meeting_participants;

-- MESSAGES (all policies)
DROP POLICY IF EXISTS "Users can view messages they sent or received" ON public.messages;
DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can mark their received messages as read" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;

-- NOTIFICATIONS (all policies)
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can manage own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;

-- PROJECTS (all policies)
DROP POLICY IF EXISTS "Authenticated users can insert projects" ON public.projects;
DROP POLICY IF EXISTS "All authenticated users can view projects" ON public.projects;
DROP POLICY IF EXISTS "Users can read projects" ON public.projects;
DROP POLICY IF EXISTS "Directors can manage projects" ON public.projects;

-- USER_ROLES (all policies)
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Directors can view all roles" ON public.user_roles;

-- Now recreate ALL policies with optimized auth evaluation

-- PROFILES - Optimized policies
CREATE POLICY "Users can insert own profile" ON public.profiles 
FOR INSERT WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Users can update own profile" ON public.profiles 
FOR UPDATE USING ((select auth.uid()) = id);

CREATE POLICY "Users can view own profile" ON public.profiles 
FOR SELECT USING ((select auth.uid()) = id);

CREATE POLICY "Directors can view all profiles" ON public.profiles 
FOR SELECT USING (public.has_role((select auth.uid()), 'director'::public.app_role));

-- ASSIGNMENTS - Complete optimized policies
CREATE POLICY "Users can create assignments" ON public.assignments 
FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = creator_id);

CREATE POLICY "Users can update own assignments" ON public.assignments 
FOR UPDATE USING ((select auth.uid()) = creator_id OR (select auth.uid()) = assignee_id);

CREATE POLICY "Users can view own assignments" ON public.assignments 
FOR SELECT USING (
  (select auth.uid()) = creator_id OR 
  (select auth.uid()) = assignee_id OR
  public.has_role((select auth.uid()), 'director'::public.app_role)
);

CREATE POLICY "Directors can manage assignments" ON public.assignments 
USING (public.has_role((select auth.uid()), 'director'::public.app_role));

-- EMPLOYEE_RATINGS - Optimized policies
CREATE POLICY "Users can view own ratings" ON public.employee_ratings 
FOR SELECT USING ((select auth.uid()) = employee_id);

CREATE POLICY "Directors can manage ratings" ON public.employee_ratings 
USING (public.has_role((select auth.uid()), 'director'::public.app_role));

-- ASSIGNMENT_STATUS_HISTORY - Optimized policies
CREATE POLICY "Users can insert status history" ON public.assignment_status_history 
FOR INSERT WITH CHECK (
  (select auth.uid()) = changed_by OR
  public.has_role((select auth.uid()), 'director'::public.app_role)
);

-- ATTENDANCE - Complete optimized policies
CREATE POLICY "Employees can insert own attendance" ON public.attendance 
FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Employees can update own attendance" ON public.attendance 
FOR UPDATE USING ((select auth.uid()) = user_id);

CREATE POLICY "Employees can view own attendance" ON public.attendance 
FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Directors can view all attendance" ON public.attendance 
FOR SELECT USING (public.has_role((select auth.uid()), 'director'::public.app_role));

CREATE POLICY "Directors can update any attendance" ON public.attendance 
FOR UPDATE USING (public.has_role((select auth.uid()), 'director'::public.app_role));

-- DAILY_SUMMARIES - Complete optimized policies
CREATE POLICY "Users can view own daily summaries" ON public.daily_summaries 
FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can manage own daily summaries" ON public.daily_summaries 
USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Directors can view all daily summaries" ON public.daily_summaries 
FOR SELECT USING (public.has_role((select auth.uid()), 'director'::public.app_role));

-- MEETINGS - Complete optimized policies
CREATE POLICY "Users can create meetings" ON public.meetings 
FOR INSERT WITH CHECK ((select auth.uid()) = created_by);

CREATE POLICY "Users can delete their own meetings" ON public.meetings 
FOR DELETE USING ((select auth.uid()) = created_by);

CREATE POLICY "Users can manage own meetings" ON public.meetings 
USING ((select auth.uid()) = created_by) WITH CHECK ((select auth.uid()) = created_by);

CREATE POLICY "Directors can manage all meetings" ON public.meetings 
USING (public.has_role((select auth.uid()), 'director'::public.app_role));

-- MEETING_PARTICIPANTS - Complete optimized policies
CREATE POLICY "Users can view participants for meetings they have access to" ON public.meeting_participants 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.meetings m 
    WHERE m.id = meeting_participants.meeting_id 
    AND (m.created_by = (select auth.uid()) OR public.has_role((select auth.uid()), 'director'::public.app_role))
  )
);

CREATE POLICY "Meeting creators can add participants" ON public.meeting_participants 
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.meetings m 
    WHERE m.id = meeting_participants.meeting_id 
    AND (m.created_by = (select auth.uid()))
  ) OR public.has_role((select auth.uid()), 'director'::public.app_role)
);

CREATE POLICY "Meeting creators can remove participants" ON public.meeting_participants 
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.meetings m 
    WHERE m.id = meeting_participants.meeting_id 
    AND (m.created_by = (select auth.uid()))
  ) OR public.has_role((select auth.uid()), 'director'::public.app_role)
);

-- MESSAGES - Complete optimized policies
CREATE POLICY "Users can view messages they sent or received" ON public.messages 
FOR SELECT USING (
  (select auth.uid()) = sender_id OR
  (select auth.uid()) = receiver_id
);

CREATE POLICY "Users can view own messages" ON public.messages 
FOR SELECT USING (
  (select auth.uid()) = sender_id OR
  (select auth.uid()) = receiver_id
);

CREATE POLICY "Users can mark their received messages as read" ON public.messages 
FOR UPDATE USING ((select auth.uid()) = receiver_id);

CREATE POLICY "Users can send messages" ON public.messages 
FOR INSERT WITH CHECK ((select auth.uid()) = sender_id);

-- NOTIFICATIONS - Complete optimized policies
CREATE POLICY "System can insert notifications" ON public.notifications 
FOR INSERT WITH CHECK (true); -- System notifications allowed

CREATE POLICY "Users can manage own notifications" ON public.notifications 
USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can view own notifications" ON public.notifications 
FOR SELECT USING ((select auth.uid()) = user_id);

-- PROJECTS - Complete optimized policies
CREATE POLICY "Authenticated users can insert projects" ON public.projects 
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "All authenticated users can view projects" ON public.projects 
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can read projects" ON public.projects 
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Directors can manage projects" ON public.projects 
USING (public.has_role((select auth.uid()), 'director'::public.app_role));

-- USER_ROLES - Complete optimized policies
CREATE POLICY "Users can view own role" ON public.user_roles 
FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Directors can view all roles" ON public.user_roles 
FOR SELECT USING (public.has_role((select auth.uid()), 'director'::public.app_role));

-- Ensure RLS is enabled on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Verify no policies still use direct auth calls
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE qual LIKE '%auth.uid()%' OR qual LIKE '%auth.role()%' OR qual LIKE '%current_setting%'
ORDER BY tablename, policyname;

-- This should return no rows if all policies are optimized
