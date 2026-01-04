-- ============================================================
-- EWMP MEETINGS & MESSAGES RLS FIX
-- Fix RLS policies so employees can see other users for meetings and messages
-- ============================================================

-- First, let's see current RLS policies for meetings
SELECT 
  'MEETINGS POLICIES' as info,
  policyname,
  cmd,
  qual,
  CASE 
    WHEN qual LIKE '%(select auth.uid())%' THEN 'OPTIMIZED ✅'
    ELSE 'NEEDS FIX ❌'
  END as auth_status
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'meetings'
ORDER BY cmd, policyname;

-- Check current RLS policies for meeting_participants
SELECT 
  'MEETING_PARTICIPANTS POLICIES' as info,
  policyname,
  cmd,
  qual,
  CASE 
    WHEN qual LIKE '%(select auth.uid())%' THEN 'OPTIMIZED ✅'
    ELSE 'NEEDS FIX ❌'
  END as auth_status
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'meeting_participants'
ORDER BY cmd, policyname;

-- Check current RLS policies for messages
SELECT 
  'MESSAGES POLICIES' as info,
  policyname,
  cmd,
  qual,
  CASE 
    WHEN qual LIKE '%(select auth.uid())%' THEN 'OPTIMIZED ✅'
    ELSE 'NEEDS FIX ❌'
  END as auth_status
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'messages'
ORDER BY cmd, policyname;

-- ============================================================
-- FIX MEETINGS POLICIES
-- ============================================================

-- Drop existing meetings policies
DROP POLICY IF EXISTS "meetings_manage" ON public.meetings;
DROP POLICY IF EXISTS "meetings_select" ON public.meetings;
DROP POLICY IF EXISTS "meetings_insert" ON public.meetings;
DROP POLICY IF EXISTS "meetings_update" ON public.meetings;
DROP POLICY IF EXISTS "meetings_delete" ON public.meetings;

-- Create new policies that allow employees to see meetings they're in
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
-- FIX MEETING_PARTICIPANTS POLICIES
-- ============================================================

-- Drop existing meeting_participants policies
DROP POLICY IF EXISTS "meeting_participants_select" ON public.meeting_participants;
DROP POLICY IF EXISTS "meeting_participants_insert" ON public.meeting_participants;
DROP POLICY IF EXISTS "meeting_participants_delete" ON public.meeting_participants;

-- Create new policies
CREATE POLICY "meeting_participants_select"
ON public.meeting_participants FOR SELECT
USING (
  user_id = (select auth.uid())
  OR public.has_role((select auth.uid()), 'director')
);

CREATE POLICY "meeting_participants_insert"
ON public.meeting_participants FOR INSERT
WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "meeting_participants_delete"
ON public.meeting_participants FOR DELETE
USING (
  user_id = (select auth.uid())
  OR public.has_role((select auth.uid()), 'director')
);

-- ============================================================
-- FIX MESSAGES POLICIES
-- ============================================================

-- Drop existing messages policies
DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
DROP POLICY IF EXISTS "messages_update" ON public.messages;

-- Create new policies that allow users to see messages they send/receive
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
-- CREATE HELPER FUNCTIONS FOR FRONTEND
-- ============================================================

-- Function to get all users for meeting creation
CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  role TEXT
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
    p.email,
    r.role::text
  FROM public.profiles p
  INNER JOIN public.user_roles r ON p.id = r.user_id
  ORDER BY p.name;
END;
$$;

-- Function to get user's meetings
CREATE OR REPLACE FUNCTION public.get_user_meetings()
RETURNS TABLE (
  id UUID,
  title TEXT,
  meeting_date DATE,
  meeting_time TIME,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT m.*
  FROM public.meetings m
  WHERE 
    m.created_by = (select auth.uid())
    OR public.has_role((select auth.uid()), 'director')
    OR m.id IN (
      SELECT meeting_id FROM public.meeting_participants 
      WHERE user_id = (select auth.uid())
    )
  ORDER BY m.meeting_date, m.meeting_time;
END;
$$;

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Test the functions
SELECT * FROM public.get_all_users() LIMIT 5;

SELECT * FROM public.get_user_meetings() LIMIT 5;

-- Show final policy state
SELECT 
  'FINAL POLICIES' as info,
  tablename,
  cmd,
  policyname,
  CASE 
    WHEN qual LIKE '%(select auth.uid())%' THEN 'OPTIMIZED ✅'
    ELSE 'NEEDS FIX ❌'
  END as auth_status
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('meetings', 'meeting_participants', 'messages')
ORDER BY tablename, cmd, policyname;

-- ============================================================
-- FRONTEND HOOKS NEEDED
-- ============================================================

-- You'll need to create/update these frontend hooks:
-- 1. useAllUsers() - calls get_all_users()
-- 2. useUserMeetings() - calls get_user_meetings()
-- 3. useMessages() - uses direct table query with proper RLS

-- ============================================================
-- DONE ✅
-- ============================================================
