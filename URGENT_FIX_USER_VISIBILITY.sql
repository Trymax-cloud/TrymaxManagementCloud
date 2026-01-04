-- ============================================================
-- EWMP URGENT FIX - USER VISIBILITY & TASK ASSIGNMENT
-- Fix immediate issues: no users visible, no creator info
-- ============================================================

-- ============================================================
-- 1️⃣ URGENT FIX - ALLOW EMPLOYEES TO SEE ALL USERS
-- ============================================================

-- Drop existing profiles policies
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;

-- Create new profiles policy - EMPLOYEES CAN SEE ALL USERS
CREATE POLICY "profiles_select"
ON public.profiles FOR SELECT
USING (
  -- Everyone can see all profiles (for meeting creation, messaging, etc.)
  true
);

CREATE POLICY "profiles_insert"
ON public.profiles FOR INSERT
WITH CHECK (id = (select auth.uid()));

CREATE POLICY "profiles_update"
ON public.profiles FOR UPDATE
USING (id = (select auth.uid()));

-- ============================================================
-- 2️⃣ FIX ASSIGNMENTS TO SHOW CREATOR INFO
-- ============================================================

-- Drop existing assignment policies
DROP POLICY IF EXISTS "assignments_select" ON public.assignments;
DROP POLICY IF EXISTS "assignments_insert" ON public.assignments;
DROP POLICY IF EXISTS "assignments_update" ON public.assignments;
DROP POLICY IF EXISTS "assignments_unified_delete" ON public.assignments;

-- Create new assignment policies
CREATE POLICY "assignments_select"
ON public.assignments FOR SELECT
USING (
  creator_id = (select auth.uid())
  OR assignee_id = (select auth.uid())
  OR public.has_role((select auth.uid()), 'director')
);

CREATE POLICY "assignments_insert"
ON public.assignments FOR INSERT
WITH CHECK (creator_id = (select auth.uid()));

CREATE POLICY "assignments_update"
ON public.assignments FOR UPDATE
USING (
  creator_id = (select auth.uid())
  OR assignee_id = (select auth.uid())
  OR public.has_role((select auth.uid()), 'director')
);

CREATE POLICY "assignments_delete"
ON public.assignments FOR DELETE
USING (
  creator_id = (select auth.uid())
  OR public.has_role((select auth.uid()), 'director')
);

-- ============================================================
-- 3️⃣ CREATE SIMPLE USER LIST FUNCTION
-- ============================================================

-- Simple function to get all users (no role restrictions)
CREATE OR REPLACE FUNCTION public.get_simple_users()
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.email
  FROM public.profiles p
  WHERE p.id IS NOT NULL
  ORDER BY p.name;
END;
$$;

-- ============================================================
-- 4️⃣ CREATE TASK WITH CREATOR FUNCTION
-- ============================================================

-- Function to get assignments with creator info
CREATE OR REPLACE FUNCTION public.get_assignments_with_creator()
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  status TEXT,
  priority TEXT,
  creator_id UUID,
  assignee_id UUID,
  created_date TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  completion_date TIMESTAMPTZ,
  creator_name TEXT,
  creator_email TEXT,
  assignee_name TEXT,
  assignee_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.title,
    a.description,
    a.status,
    a.priority,
    a.creator_id,
    a.assignee_id,
    a.created_date,
    a.due_date,
    a.completion_date,
    creator.name as creator_name,
    creator.email as creator_email,
    assignee.name as assignee_name,
    assignee.email as assignee_email
  FROM public.assignments a
  LEFT JOIN public.profiles creator ON a.creator_id = creator.id
  LEFT JOIN public.profiles assignee ON a.assignee_id = assignee.id
  WHERE 
    a.creator_id = (select auth.uid())
    OR a.assignee_id = (select auth.uid())
    OR public.has_role((select auth.uid()), 'director')
  ORDER BY a.created_date DESC;
END;
$$;

-- ============================================================
-- 5️⃣ FIX MEETINGS POLICIES
-- ============================================================

-- Drop existing meetings policies
DROP POLICY IF EXISTS "meetings_select" ON public.meetings;
DROP POLICY IF EXISTS "meetings_insert" ON public.meetings;
DROP POLICY IF EXISTS "meetings_update" ON public.meetings;
DROP POLICY IF EXISTS "meetings_delete" ON public.meetings;

-- Create new meetings policies
CREATE POLICY "meetings_select"
ON public.meetings FOR SELECT
USING (
  created_by = (select auth.uid())
  OR public.has_role((select auth.uid()), 'director')
  OR id IN (
    SELECT meeting_id FROM public.meeting_participants 
    WHERE user_id = (select auth.uid())
  )
);

CREATE POLICY "meetings_insert"
ON public.meetings FOR INSERT
WITH CHECK (created_by = (select auth.uid()));

CREATE POLICY "meetings_update"
ON public.meetings FOR UPDATE
USING (
  created_by = (select auth.uid())
  OR public.has_role((select auth.uid()), 'director')
);

CREATE POLICY "meetings_delete"
ON public.meetings FOR DELETE
USING (
  created_by = (select auth.uid())
  OR public.has_role((select auth.uid()), 'director')
);

-- ============================================================
-- 6️⃣ FIX MESSAGES POLICIES
-- ============================================================

-- Drop existing messages policies
DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
DROP POLICY IF EXISTS "messages_update" ON public.messages;

-- Create new messages policies
CREATE POLICY "messages_select"
ON public.messages FOR SELECT
USING (
  sender_id = (select auth.uid())
  OR receiver_id = (select auth.uid())
  OR public.has_role((select auth.uid()), 'director')
);

CREATE POLICY "messages_insert"
ON public.messages FOR INSERT
WITH CHECK (
  sender_id = (select auth.uid())
  OR public.has_role((select auth.uid()), 'director')
);

CREATE POLICY "messages_update"
ON public.messages FOR UPDATE
USING (
  sender_id = (select auth.uid())
  OR receiver_id = (select auth.uid())
  OR public.has_role((select auth.uid()), 'director')
);

-- ============================================================
-- 7️⃣ VERIFICATION TESTS
-- ============================================================

-- Test user visibility
SELECT 
  'USER VISIBILITY TEST' as test,
  COUNT(*) as total_users,
  STRING_AGG(name, ', ' LIMIT 5) as sample_users
FROM public.get_simple_users();

-- Test assignments with creator info
SELECT 
  'ASSIGNMENT WITH CREATOR TEST' as test,
  COUNT(*) as total_assignments,
  COUNT(CASE WHEN creator_name IS NOT NULL THEN 1 END) as with_creator,
  COUNT(CASE WHEN assignee_name IS NOT NULL THEN 1 END) as with_assignee
FROM public.get_assignments_with_creator();

-- Test meeting visibility
SELECT 
  'MEETING VISIBILITY TEST' as test,
  COUNT(*) as total_meetings
FROM public.meetings
WHERE 
  created_by = (select auth.uid())
  OR public.has_role((select auth.uid()), 'director')
  OR id IN (
    SELECT meeting_id FROM public.meeting_participants 
    WHERE user_id = (select auth.uid())
  );

-- ============================================================
-- 8️⃣ FRONTEND HOOK UPDATES NEEDED
-- ============================================================

-- Update useAllUsers hook to use get_simple_users()
-- Update useAssignments hook to use get_assignments_with_creator()
-- Update CreateMeetingModal to use get_simple_users()
-- Update Messages to use get_simple_users()

-- ============================================================
-- DONE ✅ - RUN THIS NOW!
-- ============================================================
