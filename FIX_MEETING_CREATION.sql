-- ============================================================
-- EWMP MEETING CREATION FIX
-- Fix meeting creation issues and partial meeting creation
-- ============================================================

-- ============================================================
-- 1️⃣ DIAGNOSE CURRENT MEETING ISSUES
-- ============================================================

-- Check for partial meetings (meetings without participants)
SELECT 
  'PARTIAL MEETINGS' as issue_type,
  COUNT(*) as count,
  STRING_AGG(id::text, ', ') as problematic_meeting_ids
FROM public.meetings
WHERE id NOT IN (
  SELECT DISTINCT meeting_id FROM public.meeting_participants
);

-- Check meeting_participants table structure
SELECT 
  'MEETING_PARTICIPANTS STRUCTURE' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'meeting_participants'
ORDER BY ordinal_position;

-- Check for orphaned participants (participants without meetings)
SELECT 
  'ORPHANED PARTICIPANTS' as issue_type,
  COUNT(*) as count,
  STRING_AGG(id::text, ', ') as orphaned_participant_ids
FROM public.meeting_participants
WHERE meeting_id NOT IN (SELECT id FROM public.meetings);

-- ============================================================
-- 2️⃣ FIX MEETING CREATION POLICIES
-- ============================================================

-- Drop all existing meeting policies
DROP POLICY IF EXISTS "meetings_select" ON public.meetings;
DROP POLICY IF EXISTS "meetings_insert" ON public.meetings;
DROP POLICY IF EXISTS "meetings_update" ON public.meetings;
DROP POLICY IF EXISTS "meetings_delete" ON public.meetings;
DROP POLICY IF EXISTS "meetings_manage" ON public.meetings;

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

-- ============================================================
-- 3️⃣ FIX MEETING_PARTICIPANTS POLICIES
-- ============================================================

-- Drop all existing meeting_participants policies
DROP POLICY IF EXISTS "meeting_participants_select" ON public.meeting_participants;
DROP POLICY IF EXISTS "meeting_participants_insert" ON public.meeting_participants;
DROP POLICY IF EXISTS "meeting_participants_delete" ON public.meeting_participants;
DROP POLICY IF EXISTS "meeting_participants_manage" ON public.meeting_participants;

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
-- 4️⃣ CREATE MEETING CREATION FUNCTION
-- ============================================================

-- Drop function if exists
DROP FUNCTION IF EXISTS public.create_meeting_with_participants();

-- Function to safely create meeting with participants
CREATE OR REPLACE FUNCTION public.create_meeting_with_participants(
  meeting_title TEXT,
  meeting_note TEXT DEFAULT NULL,
  meeting_date DATE,
  meeting_time TIME,
  participant_ids UUID[] DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_meeting_id UUID;
  participant_id UUID;
BEGIN
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
    (select auth.uid())
  ) RETURNING id INTO new_meeting_id;
  
  -- Add participants if provided
  IF participant_ids IS NOT NULL THEN
    FOREACH participant_id IN ARRAY participant_ids
    LOOP
      -- Skip if participant is the creator (they're automatically included)
      IF participant_id != (select auth.uid()) THEN
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
    (select auth.uid())
  ) ON CONFLICT (meeting_id, user_id) DO NOTHING;
  
  RETURN new_meeting_id;
END;
$$;

-- ============================================================
-- 5️⃣ CLEAN UP PARTIAL MEETINGS
-- ============================================================

-- Remove meetings without participants (they're incomplete)
DELETE FROM public.meetings
WHERE id NOT IN (
  SELECT DISTINCT meeting_id FROM public.meeting_participants
);

-- Remove orphaned participants (participants without meetings)
DELETE FROM public.meeting_participants
WHERE meeting_id NOT IN (SELECT id FROM public.meetings);

-- ============================================================
-- 6️⃣ ADD MEETING VALIDATION
-- ============================================================

-- Add check constraint to prevent invalid meeting data
ALTER TABLE public.meetings 
ADD CONSTRAINT IF NOT EXISTS meetings_valid_dates 
CHECK (
  meeting_date IS NOT NULL 
  AND meeting_time IS NOT NULL
  AND created_by IS NOT NULL
);

-- Add check constraint for meeting_participants
ALTER TABLE public.meeting_participants 
ADD CONSTRAINT IF NOT EXISTS meeting_participants_valid 
CHECK (
  meeting_id IS NOT NULL 
  AND user_id IS NOT NULL
);

-- ============================================================
-- 7️⃣ VERIFICATION TESTS
-- ============================================================

-- Test meeting creation function
SELECT 
  'MEETING CREATION TEST' as test,
  public.create_meeting_with_participants(
    'Test Meeting',
    'This is a test meeting',
    CURRENT_DATE + INTERVAL '1 day',
    '10:00:00',
    ARRAY[(SELECT id FROM public.profiles WHERE id != (select auth.uid()) LIMIT 1)]
  ) as created_meeting_id;

-- Verify meeting was created with participants
SELECT 
  'MEETING VERIFICATION' as test,
  m.id,
  m.title,
  m.meeting_date,
  m.meeting_time,
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
GROUP BY m.id, m.title, m.meeting_date, m.meeting_time;

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
-- 8️⃣ FRONTEND FIXES NEEDED
-- ============================================================

-- Update CreateMeetingModal to:
-- 1. Use the create_meeting_with_participants function
-- 2. Handle errors properly
-- 3. Show proper loading states
-- 4. Validate form data before submission

-- ============================================================
-- DONE ✅
-- ============================================================
