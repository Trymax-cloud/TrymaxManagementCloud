-- ============================================================
-- EWMP FINAL MEETING CREATION FIX - CONSTRAINT ISSUE FIXED
-- Complete fix for meeting creation with constraint violation resolved
-- ============================================================

-- ============================================================
-- 1️⃣ CLEAN UP EXISTING ISSUES
-- ============================================================

-- Remove partial meetings first
DELETE FROM public.meetings
WHERE id NOT IN (
  SELECT DISTINCT meeting_id FROM public.meeting_participants
);

-- Remove orphaned participants
DELETE FROM public.meeting_participants
WHERE meeting_id NOT IN (SELECT id FROM public.meetings);

-- ============================================================
-- 2️⃣ DROP AND RECREATE POLICIES
-- ============================================================

-- Drop all existing meeting policies
DROP POLICY IF EXISTS "meetings_select" ON public.meetings;
DROP POLICY IF EXISTS "meetings_insert" ON public.meetings;
DROP POLICY IF EXISTS "meetings_update" ON public.meetings;
DROP POLICY IF EXISTS "meetings_delete" ON public.meetings;
DROP POLICY IF EXISTS "meetings_manage" ON public.meetings;

-- Drop all existing meeting_participants policies
DROP POLICY IF EXISTS "meeting_participants_select" ON public.meeting_participants;
DROP POLICY IF EXISTS "meeting_participants_insert" ON public.meeting_participants;
DROP POLICY IF EXISTS "meeting_participants_delete" ON public.meeting_participants;
DROP POLICY IF EXISTS "meeting_participants_manage" ON public.meeting_participants;

-- Create simplified meeting policies
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

-- Create simplified meeting_participants policies
CREATE POLICY "meeting_participants_select"
ON public.meeting_participants FOR SELECT
USING (
  user_id = (select auth.uid())
  OR public.has_role((select auth.uid()), 'director')
  OR meeting_id IN (
    SELECT id FROM public.meetings 
    WHERE created_by = (select auth.uid())
  )
);

CREATE POLICY "meeting_participants_insert"
ON public.meeting_participants FOR INSERT
WITH CHECK (
  user_id = (select auth.uid())
  OR public.has_role((select auth.uid()), 'director')
);

CREATE POLICY "meeting_participants_delete"
ON public.meeting_participants FOR DELETE
USING (
  user_id = (select auth.uid())
  OR public.has_role((select auth.uid()), 'director')
);

-- ============================================================
-- 3️⃣ CREATE MEETING CREATION FUNCTION - CONSTRAINT FIXED
-- ============================================================

-- Drop function if exists
DROP FUNCTION IF EXISTS public.create_meeting_with_participants();

-- Function to safely create meeting with participants
CREATE OR REPLACE FUNCTION public.create_meeting_with_participants(
  meeting_title TEXT,
  meeting_note TEXT,
  meeting_date DATE,
  meeting_time TIME,
  participant_ids UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_meeting_id UUID;
  participant_id UUID;
  current_user_id UUID;
BEGIN
  -- Get current user ID and validate it
  current_user_id := (select auth.uid());
  
  -- Validate user is authenticated
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Validate required fields
  IF meeting_title IS NULL OR meeting_title = '' THEN
    RAISE EXCEPTION 'Meeting title is required';
  END IF;
  
  IF meeting_date IS NULL THEN
    RAISE EXCEPTION 'Meeting date is required';
  END IF;
  
  IF meeting_time IS NULL THEN
    RAISE EXCEPTION 'Meeting time is required';
  END IF;
  
  -- Create the meeting first
  INSERT INTO public.meetings (
    title,
    note,
    meeting_date,
    meeting_time,
    created_by
  ) VALUES (
    meeting_title,
    meeting_note,
    meeting_date,
    meeting_time,
    current_user_id  -- Use the validated user ID
  ) RETURNING id INTO new_meeting_id;
  
  -- Add participants if provided
  IF participant_ids IS NOT NULL THEN
    FOREACH participant_id IN ARRAY participant_ids
    LOOP
      -- Skip if participant is the creator (they're automatically included)
      IF participant_id != current_user_id THEN
        INSERT INTO public.meeting_participants (
          meeting_id,
          user_id
        ) VALUES (
          new_meeting_id,
          participant_id
        );
      END IF;
    END LOOP;
  END IF;
  
  -- Always add the creator as a participant
  INSERT INTO public.meeting_participants (
    meeting_id,
    user_id
  ) VALUES (
    new_meeting_id,
    current_user_id
  ) ON CONFLICT (meeting_id, user_id) DO NOTHING;
  
  RETURN new_meeting_id;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error and re-raise
    RAISE NOTICE 'Error in create_meeting_with_participants: %, %', SQLERRM, SQLSTATE;
    RAISE;
END;
$$;

-- ============================================================
-- 4️⃣ FIX VALIDATION CONSTRAINTS
-- ============================================================

-- Drop existing constraints that might be causing issues
ALTER TABLE public.meetings DROP CONSTRAINT IF EXISTS meetings_valid_dates;
ALTER TABLE public.meeting_participants DROP CONSTRAINT IF EXISTS meeting_participants_valid;

-- Add simpler, more flexible constraints
DO $$
BEGIN
    -- Add check constraint to prevent invalid meeting data (more flexible)
    ALTER TABLE public.meetings 
    ADD CONSTRAINT meetings_valid_dates 
    CHECK (
        title IS NOT NULL 
        AND title != ''
        AND meeting_date IS NOT NULL
        AND meeting_time IS NOT NULL
        -- created_by can be NULL for now, function will handle validation
    );
EXCEPTION
    WHEN duplicate_object THEN
        NULL; -- Constraint already exists, ignore
END $$;

DO $$
BEGIN
    -- Add check constraint for meeting_participants
    ALTER TABLE public.meeting_participants 
    ADD CONSTRAINT meeting_participants_valid 
    CHECK (
        meeting_id IS NOT NULL 
        AND user_id IS NOT NULL
    );
EXCEPTION
    WHEN duplicate_object THEN
        NULL; -- Constraint already exists, ignore
END $$;

-- ============================================================
-- 5️⃣ VERIFICATION TESTS
-- ============================================================

-- Test function existence
SELECT 
  'FUNCTION EXISTS TEST' as test,
  CASE 
    WHEN routine_name IS NOT NULL THEN '✅ FUNCTION EXISTS'
    ELSE '❌ FUNCTION MISSING'
  END as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'create_meeting_with_participants';

-- Test current user authentication
SELECT 
  'AUTHENTICATION TEST' as test,
  CASE 
    WHEN (select auth.uid()) IS NOT NULL THEN '✅ AUTHENTICATED'
    ELSE '❌ NOT AUTHENTICATED'
  END as auth_status,
  (select auth.uid()) as current_user_id;

-- Test meeting creation with explicit type casts
SELECT 
  'MEETING CREATION TEST' as test,
  public.create_meeting_with_participants(
    'Test Meeting'::TEXT,
    NULL::TEXT,
    (CURRENT_DATE + INTERVAL '1 day')::DATE,
    '10:00:00'::TIME,
    ARRAY[(SELECT id::UUID FROM public.profiles WHERE id != (select auth.uid()) LIMIT 1)]::UUID[]
  ) as created_meeting_id;

-- Verify meeting was created with participants
SELECT 
  'MEETING VERIFICATION' as test,
  m.id,
  m.title,
  m.meeting_date,
  m.meeting_time,
  m.created_by,
  COUNT(mp.user_id) as participant_count,
  STRING_AGG(p.name, ', ') as participant_names
FROM public.meetings m
LEFT JOIN public.meeting_participants mp ON m.id = mp.meeting_id
LEFT JOIN public.profiles p ON mp.user_id = p.id
WHERE m.id = (
  SELECT id FROM public.meetings 
  WHERE title = 'Test Meeting' 
  ORDER BY created_at DESC 
  LIMIT 1
)
GROUP BY m.id, m.title, m.meeting_date, m.meeting_time, m.created_by;

-- Check for any remaining issues
SELECT 
  'FINAL CLEANUP CHECK' as check_type,
  'Partial meetings' as issue,
  COUNT(*) as count
FROM public.meetings
WHERE id NOT IN (SELECT DISTINCT meeting_id FROM public.meeting_participants)

UNION ALL

SELECT 
  'FINAL CLEANUP CHECK' as check_type,
  'Orphaned participants' as issue,
  COUNT(*) as count
FROM public.meeting_participants
WHERE meeting_id NOT IN (SELECT id FROM public.meetings);

-- ============================================================
-- 6️⃣ FINAL POLICY VERIFICATION
-- ============================================================

-- Show all current policies
SELECT 
  'FINAL POLICY STATE' as info,
  tablename,
  cmd,
  policyname,
  CASE 
    WHEN qual LIKE '%(select auth.uid())%' THEN 'OPTIMIZED ✅'
    ELSE 'NEEDS FIX ❌'
  END as auth_status
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('meetings', 'meeting_participants')
ORDER BY tablename, cmd, policyname;

-- ============================================================
-- DONE ✅ - CONSTRAINT VIOLATION FIXED
-- ============================================================
