-- Create meeting deletion RPC function
-- This function handles meeting deletion with proper RLS compliance

CREATE OR REPLACE FUNCTION delete_meeting(
  p_meeting_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_meeting_creator_id UUID;
  v_is_director BOOLEAN;
BEGIN
  -- Get authenticated user
  v_user_id := (select auth.uid());

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Get meeting creator
  SELECT created_by INTO v_meeting_creator_id
  FROM public.meetings
  WHERE id = p_meeting_id;

  IF v_meeting_creator_id IS NULL THEN
    RAISE EXCEPTION 'Meeting not found';
  END IF;

  -- Check if user is director or meeting creator
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles 
    WHERE user_id = v_user_id AND role = 'director'
  ) INTO v_is_director;

  IF v_user_id != v_meeting_creator_id AND NOT v_is_director THEN
    RAISE EXCEPTION 'Permission denied: Only meeting creator or director can delete meetings';
  END IF;

  -- Delete the meeting (cascade will handle participants)
  DELETE FROM public.meetings
  WHERE id = p_meeting_id;

  RETURN TRUE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_meeting TO authenticated;
