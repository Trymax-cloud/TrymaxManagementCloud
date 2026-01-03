-- Migrate legacy categories (admin, other) to general category
-- This ensures existing assignments don't break when we remove these categories

UPDATE assignments
SET category = 'general'
WHERE category IN ('admin', 'other');

-- Add a comment to document this migration
COMMENT ON TABLE assignments IS 'Updated category values: admin and other categories migrated to general on 2026-01-03';
