-- Fix meeting deletion by ensuring proper cascade deletion
-- This migration ensures meeting participants are automatically deleted when a meeting is deleted

-- Drop existing foreign key constraint if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'meeting_participants_meeting_id_fkey' 
        AND table_name = 'meeting_participants'
    ) THEN
        ALTER TABLE meeting_participants DROP CONSTRAINT meeting_participants_meeting_id_fkey;
    END IF;
END $$;

-- Recreate foreign key constraint with proper cascade deletion
ALTER TABLE meeting_participants 
ADD CONSTRAINT meeting_participants_meeting_id_fkey 
FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE;

-- Add comment to document the fix
COMMENT ON CONSTRAINT meeting_participants_meeting_id_fkey ON meeting_participants IS 'Ensures participants are deleted when meeting is deleted (fixed on 2026-01-03)';
