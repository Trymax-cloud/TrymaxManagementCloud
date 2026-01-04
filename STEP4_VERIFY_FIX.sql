-- STEP 4: Check for Remaining RLS Issues
-- Run this after all previous steps

-- Check for any remaining policies that use direct auth calls
SELECT 
  tablename,
  policyname,
  cmd,
  qual,
  CASE 
    WHEN qual LIKE '%auth.uid()%' THEN 'NEEDS_FIX ❌'
    WHEN qual LIKE '%(select auth.uid())%' THEN 'OPTIMIZED ✅'
    ELSE 'OK ✅'
  END as status
FROM pg_policies 
WHERE schemaname = 'public'
  AND (qual LIKE '%auth.uid()%' OR qual LIKE '%(select auth.uid())%')
ORDER BY tablename, policyname;

-- Check for multiple permissive policies (performance issue)
SELECT 
  tablename,
  cmd,
  COUNT(*) as policy_count,
  STRING_AGG(policyname, ', ') as policies,
  CASE 
    WHEN COUNT(*) > 1 THEN 'MULTIPLE POLICIES ⚠️'
    ELSE 'OK ✅'
  END as status
FROM pg_policies 
WHERE schemaname = 'public' AND permissive = true
GROUP BY tablename, cmd
HAVING COUNT(*) >= 1
ORDER BY tablename, cmd;

-- Summary report
SELECT 
  'RLS Performance Status' as metric,
  CASE 
    WHEN COUNT(*) = 0 THEN 'ALL FIXED ✅'
    ELSE FORMAT('%s issues remaining', COUNT(*))
  END as status
FROM pg_policies 
WHERE schemaname = 'public'
  AND qual LIKE '%auth.uid()%'
