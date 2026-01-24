-- Add manager role to user_roles table
-- This migration updates the check constraint to include 'manager' as a valid role

-- First, drop the existing check constraint
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;

-- Add the updated check constraint that includes manager role
ALTER TABLE user_roles 
ADD CONSTRAINT user_roles_role_check 
CHECK (role IN ('employee', 'manager', 'director'));

-- Optional: Update any existing users who might have manager role in metadata
-- This updates users who have manager role in their user_metadata but not in the user_roles table
INSERT INTO user_roles (user_id, role)
SELECT 
    id as user_id,
    'manager' as role
FROM auth.users
WHERE 
    raw_user_meta_data->>'role' = 'manager'
    AND id NOT IN (SELECT user_id FROM user_roles WHERE role = 'manager');

-- Grant necessary permissions for manager role
-- This ensures manager role has the same permissions as director
-- (You may need to adjust this based on your RLS policies)
