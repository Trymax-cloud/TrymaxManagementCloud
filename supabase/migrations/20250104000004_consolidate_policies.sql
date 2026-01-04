-- Consolidate Multiple Permissive Policies for Better Performance
-- This migration combines multiple permissive policies into single, optimized policies

-- Drop all existing policies that will be consolidated
-- ASSIGNMENTS - Consolidate all permissive policies
DROP POLICY IF EXISTS "Directors can delete any assignment" ON public.assignments;
DROP POLICY IF EXISTS "Users can delete their own assignments" ON public.assignments;
DROP POLICY IF EXISTS "Assignees can delete their assigned assignments" ON public.assignments;
DROP POLICY IF EXISTS "Directors can update all assignments" ON public.assignments;
DROP POLICY IF EXISTS "Users can update own assignments" ON public.assignments;
DROP POLICY IF EXISTS "Directors can view all assignments" ON public.assignments;
DROP POLICY IF EXISTS "Users can view own assignments" ON public.assignments;
DROP POLICY IF EXISTS "Users can create assignments" ON public.assignments;
DROP POLICY IF EXISTS "Directors can manage assignments" ON public.assignments;

-- ATTENDANCE - Consolidate all permissive policies
DROP POLICY IF EXISTS "Employees can insert own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Employees can update own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Employees can view own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Directors can view all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Directors can update any attendance" ON public.attendance;

-- DAILY_SUMMARIES - Consolidate all permissive policies
DROP POLICY IF EXISTS "Users can view own daily summaries" ON public.daily_summaries;
DROP POLICY IF EXISTS "Users can manage own daily summaries" ON public.daily_summaries;
DROP POLICY IF EXISTS "Directors can view all daily summaries" ON public.daily_summaries;

-- MEETINGS - Consolidate all permissive policies
DROP POLICY IF EXISTS "Users can create meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users can delete their own meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users can manage own meetings" ON public.meetings;
DROP POLICY IF EXISTS "Directors can manage all meetings" ON public.meetings;

-- MESSAGES - Consolidate all permissive policies
DROP POLICY IF EXISTS "Users can view messages they sent or received" ON public.messages;
DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can mark their received messages as read" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;

-- NOTIFICATIONS - Consolidate all permissive policies
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can manage own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;

-- PROJECTS - Consolidate all permissive policies
DROP POLICY IF EXISTS "Authenticated users can insert projects" ON public.projects;
DROP POLICY IF EXISTS "All authenticated users can view projects" ON public.projects;
DROP POLICY IF EXISTS "Users can read projects" ON public.projects;
DROP POLICY IF EXISTS "Directors can manage projects" ON public.projects;

-- PROFILES - Consolidate all permissive policies
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Directors can view all profiles" ON public.profiles;

-- USER_ROLES - Consolidate all permissive policies
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Directors can view all roles" ON public.user_roles;

-- Now create consolidated, optimized policies

-- ASSIGNMENTS - Single consolidated policies per action
CREATE POLICY "Assignments Management Policy" ON public.assignments 
FOR ALL USING (
  -- Directors can do everything
  public.has_role((select auth.uid()), 'director'::public.app_role) OR
  -- Users can view their own assignments (created or assigned)
  ((select auth.uid()) = creator_id OR (select auth.uid()) = assignee_id) OR
  -- Users can create assignments
  (cmd = 'INSERT' AND (select auth.uid()) = creator_id)
) WITH CHECK (
  -- Directors can do everything
  public.has_role((select auth.uid()), 'director'::public.app_role) OR
  -- Users can create their own assignments
  (cmd = 'INSERT' AND (select auth.uid()) = creator_id) OR
  -- Users can update their own assignments
  (cmd = 'UPDATE' AND ((select auth.uid()) = creator_id OR (select auth.uid()) = assignee_id))
);

-- ATTENDANCE - Single consolidated policies per action
CREATE POLICY "Attendance Management Policy" ON public.attendance 
FOR ALL USING (
  -- Directors can do everything
  public.has_role((select auth.uid()), 'director'::public.app_role) OR
  -- Employees can manage their own attendance
  (select auth.uid()) = user_id
) WITH CHECK (
  -- Directors can do everything
  public.has_role((select auth.uid()), 'director'::public.app_role) OR
  -- Employees can manage their own attendance
  (select auth.uid()) = user_id
);

-- DAILY_SUMMARIES - Single consolidated policies per action
CREATE POLICY "Daily Summaries Management Policy" ON public.daily_summaries 
FOR ALL USING (
  -- Directors can view all summaries
  public.has_role((select auth.uid()), 'director'::public.app_role) OR
  -- Users can view their own summaries
  (select auth.uid()) = user_id
) WITH CHECK (
  -- Directors can do everything
  public.has_role((select auth.uid()), 'director'::public.app_role) OR
  -- Users can manage their own summaries
  (select auth.uid()) = user_id
);

-- MEETINGS - Single consolidated policies per action
CREATE POLICY "Meetings Management Policy" ON public.meetings 
FOR ALL USING (
  -- Directors can do everything
  public.has_role((select auth.uid()), 'director'::public.app_role) OR
  -- Users can manage their own meetings
  (select auth.uid()) = created_by
) WITH CHECK (
  -- Directors can do everything
  public.has_role((select auth.uid()), 'director'::public.app_role) OR
  -- Users can create their own meetings
  (cmd = 'INSERT' AND (select auth.uid()) = created_by) OR
  -- Users can update their own meetings
  (cmd = 'UPDATE' AND (select auth.uid()) = created_by)
);

-- MESSAGES - Single consolidated policies per action
CREATE POLICY "Messages Management Policy" ON public.messages 
FOR ALL USING (
  -- Users can view messages they sent or received
  (select auth.uid()) = sender_id OR (select auth.uid()) = receiver_id
) WITH CHECK (
  -- Users can send messages
  (cmd = 'INSERT' AND (select auth.uid()) = sender_id) OR
  -- Users can mark their received messages as read
  (cmd = 'UPDATE' AND (select auth.uid()) = receiver_id)
);

-- NOTIFICATIONS - Single consolidated policies per action
CREATE POLICY "Notifications Management Policy" ON public.notifications 
FOR ALL USING (
  -- System can insert notifications
  (cmd = 'INSERT' AND true) OR
  -- Users can view their own notifications
  (select auth.uid()) = user_id
) WITH CHECK (
  -- System can insert notifications
  (cmd = 'INSERT' AND true) OR
  -- Users can manage their own notifications
  (cmd != 'INSERT' AND (select auth.uid()) = user_id)
);

-- PROJECTS - Single consolidated policies per action
CREATE POLICY "Projects Management Policy" ON public.projects 
FOR ALL USING (
  -- Directors can do everything
  public.has_role((select auth.uid()), 'director'::public.app_role) OR
  -- Authenticated users can view projects
  (cmd = 'SELECT' AND true) OR
  -- Authenticated users can create projects
  (cmd = 'INSERT' AND true)
) WITH CHECK (
  -- Directors can do everything
  public.has_role((select auth.uid()), 'director'::public.app_role) OR
  -- Authenticated users can create projects
  (cmd = 'INSERT' AND true)
);

-- PROFILES - Single consolidated policies per action
CREATE POLICY "Profiles Management Policy" ON public.profiles 
FOR ALL USING (
  -- Directors can view all profiles
  public.has_role((select auth.uid()), 'director'::public.app_role) OR
  -- Users can view their own profile
  (select auth.uid()) = id
) WITH CHECK (
  -- Directors can do everything
  public.has_role((select auth.uid()), 'director'::public.app_role) OR
  -- Users can manage their own profile
  (cmd != 'SELECT' AND (select auth.uid()) = id)
);

-- USER_ROLES - Single consolidated policies per action
CREATE POLICY "User Roles Management Policy" ON public.user_roles 
FOR SELECT USING (
  -- Directors can view all roles
  public.has_role((select auth.uid()), 'director'::public.app_role) OR
  -- Users can view their own role
  (select auth.uid()) = user_id
);

-- Ensure RLS is enabled on all tables
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Verify no multiple permissive policies exist
SELECT 
  schemaname,
  tablename,
  cmd,
  COUNT(*) as policy_count,
  STRING_AGG(policyname, ', ') as policies
FROM pg_policies 
WHERE permissive = true
GROUP BY schemaname, tablename, cmd
HAVING COUNT(*) > 1
ORDER BY tablename, cmd;

-- This should return no rows if all policies are consolidated
