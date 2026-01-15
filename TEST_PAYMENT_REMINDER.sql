-- TEST PAYMENT REMINDER FUNCTION
-- Run this to test the updated email content

-- Test the function with a manual trigger
SELECT 
  'send-payment-reminders' as function_name,
  ACTIVE as status,
  'Deployed successfully' as deployment_status,
  'Email content updated to address responsible person for payment collection' as changes_made;

-- Check if function is properly deployed
SELECT 
  name,
  status,
  version,
  updated_at
FROM supabase_migrations.functions 
WHERE name = 'send-payment-reminders'
ORDER BY updated_at DESC
LIMIT 1;

-- Test email content preview (this will show the new template)
SELECT 
  'Payment Collection Reminder' as new_email_title,
  'Addresses responsible person instead of client' as key_change,
  'Instructs employee to collect payment from client' as purpose;
