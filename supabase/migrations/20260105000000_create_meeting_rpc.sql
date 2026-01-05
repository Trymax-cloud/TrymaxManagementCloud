-- Create atomic meeting creation RPC function
-- This function creates a meeting and all participants in a single transaction
-- Prevents partial row creation and ensures data consistency

CREATE OR REPLACE FUNCTION create_meeting_with_participants(
  p_meeting_title TEXT,
  p_meeting_note TEXT DEFAULT NULL,
  p_meeting_date DATE,
  p_meeting_time TIME,
  p_participant_ids UUID[]
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  note TEXT,
  meeting_date DATE,
  meeting_time TIME,
  created_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
  meeting_id UUID;
  current_user_id UUID;
BEGIN
  -- Get current authenticated user
  SELECT auth.uid() INTO current_user_id;
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Create the meeting
  INSERT INTO meetings (
    title,
    note,
    meeting_date,
    meeting_time,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    p_meeting_title,
    p_meeting_note,
    p_meeting_date,
    p_meeting_time,
    current_user_id,
    NOW(),
    NOW()
  ) RETURNING id INTO meeting_id;
  
  -- Add all participants (including creator automatically)
  INSERT INTO meeting_participants (meeting_id, user_id, created_at)
  SELECT 
    meeting_id,
    user_id,
    NOW()
  FROM unnest(
    CASE 
      WHEN array_length(p_participant_ids, 1) > 0 
      THEN p_participant_ids 
      ELSE ARRAY[current_user_id]::UUID[]
    END
  ) AS user_id;
  
  -- Return the created meeting
  RETURN QUERY
  SELECT 
    m.id,
    m.title,
    m.note,
    m.meeting_date,
    m.meeting_time,
    m.created_by,
    m.created_at,
    m.updated_at
  FROM meetings m
  WHERE m.id = meeting_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_meeting_with_participants TO authenticated;
