-- Add reminder tracking columns to client_payments table
-- This prevents duplicate reminders and tracks when each type was sent

ALTER TABLE client_payments 
ADD COLUMN last_72h_reminder_sent TIMESTAMP NULL,
ADD COLUMN last_24h_reminder_sent TIMESTAMP NULL,
ADD COLUMN last_overdue_reminder_sent TIMESTAMP NULL;

-- Add index for better performance on reminder queries
CREATE INDEX idx_client_payments_due_date_status ON client_payments(due_date, status);
CREATE INDEX idx_client_payments_reminder_tracking ON client_payments(
  last_72h_reminder_sent, 
  last_24h_reminder_sent, 
  last_overdue_reminder_sent
);

-- Add comments for documentation
COMMENT ON COLUMN client_payments.last_72h_reminder_sent IS 'Timestamp when 72-hour reminder was last sent';
COMMENT ON COLUMN client_payments.last_24h_reminder_sent IS 'Timestamp when 24-hour reminder was last sent';
COMMENT ON COLUMN client_payments.last_overdue_reminder_sent IS 'Timestamp when overdue reminder was last sent';
