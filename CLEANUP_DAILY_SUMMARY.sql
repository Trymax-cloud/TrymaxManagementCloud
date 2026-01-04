-- ============================================================
-- EWMP DAILY SUMMARY CLEANUP
-- Remove redundant options and fix UI issues
-- ============================================================

-- First, let's see what's currently in daily_summaries table
SELECT 
  'CURRENT DAILY SUMMARIES' as info,
  id,
  user_id,
  date,
  tasks_completed,
  tasks_pending,
  tasks_in_progress,
  emergency_tasks,
  notes,
  created_at,
  updated_at
FROM public.daily_summaries
ORDER BY date DESC, user_id
LIMIT 10;

-- Check for duplicate entries
SELECT 
  'DUPLICATE ENTRIES CHECK' as info,
  user_id,
  date,
  COUNT(*) as duplicate_count,
  STRING_AGG(id::text, ', ') as entry_ids
FROM public.daily_summaries
GROUP BY user_id, date
HAVING COUNT(*) > 1;

-- ============================================================
-- CLEAN UP DUPLICATE DAILY SUMMARIES
-- ============================================================

-- Remove duplicates, keeping the most recent one
DELETE FROM public.daily_summaries
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, date) id
  FROM public.daily_summaries
  ORDER BY user_id, date, updated_at DESC
);

-- Verify no more duplicates
SELECT 
  'AFTER CLEANUP' as info,
  user_id,
  date,
  COUNT(*) as entry_count
FROM public.daily_summaries
GROUP BY user_id, date
HAVING COUNT(*) > 1;

-- ============================================================
-- OPTIMIZE DAILY SUMMARIES TABLE
-- ============================================================

-- Add unique constraint to prevent future duplicates
ALTER TABLE public.daily_summaries 
ADD CONSTRAINT daily_summaries_user_date_unique 
UNIQUE (user_id, date);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_daily_summaries_user_date 
ON public.daily_summaries(user_id, date);

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Show final state
SELECT 
  'FINAL STATE' as info,
  COUNT(*) as total_entries,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT date) as unique_dates,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM public.daily_summaries;

-- Show table structure
SELECT 
  'TABLE STRUCTURE' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'daily_summaries'
ORDER BY ordinal_position;

-- ============================================================
-- FRONTEND FIXES NEEDED
-- ============================================================

-- The frontend DailySummary.tsx has these issues:
-- 1. Redundant stats cards (lines 348-466)
-- 2. Duplicate completed/pending cards
-- 3. Time tracking references that were removed
-- 4. Emergency tasks shown twice
-- 5. Export/Print buttons that don't work
-- 6. Complex collapsible UI that's confusing

-- ============================================================
-- DONE ✅
-- ============================================================
