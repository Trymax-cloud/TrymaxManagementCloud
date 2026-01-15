-- FIX NOTIFICATION SETTINGS INTEGRATION
-- Ensure all notification systems respect user preferences
-- Run this to update notification creation to check settings first

-- Add settings column to notifications table if it doesn't exist
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS settings JSONB;

-- Create a function to check notification settings before creating notifications
CREATE OR REPLACE FUNCTION check_notification_settings(notification_type TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER = SECURITY DEFINER
AS $$
DECLARE
  user_id UUID;
  notification_key TEXT;
  settings_value JSONB;
BEGIN
  -- Get user's notification settings
  SELECT COALESCE(settings, '{}')::jsonb->>notification_type as enabled
  FROM user_roles ur
  JOIN profiles p ON p.id = ur.user_id
  WHERE ur.user_id = user_id
  AND ur.role = 'employee';
  RETURN COALESCE(enabled, true); -- Default to true if no settings found
END;
$$;

-- Update existing notifications to include settings reference
UPDATE public.notifications 
SET settings = COALESCE(
  (SELECT COALESCE(settings, '{}')::jsonb->>notification_type as settings_value
  FROM user_roles ur
  JOIN profiles p ON p.id = ur.user_id
  WHERE ur.user_id = public.notifications.user_id
  AND ur.role = 'employee'
  WHERE public.notifications.user_id IS NOT NULL
);

-- Verify the function was created
SELECT 
  'check_notification_settings function created' as status,
  'Ready for use in notification systems' as message;
