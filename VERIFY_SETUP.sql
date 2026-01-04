-- ============================================================
-- EWPM POST-SETUP VERIFICATION
-- Run this after the main schema to verify everything is working
-- ============================================================

-- 1. Check all tables were created successfully
SELECT 
  'TABLES CREATED' as status,
  COUNT(*) as total_tables,
  STRING_AGG(table_name, ', ' ORDER BY table_name) as tables
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'profiles', 'user_roles', 'projects', 'assignments', 
  'client_payments', 'daily_summaries', 'employee_ratings', 
  'meets', 'meeting_participants', 'messages', 'notifications'
);

-- 2. Verify RLS is enabled on all tables
SELECT 
  'RLS ENABLED' as status,
  COUNT(*) as tables_with_rls,
  STRING_AGG(tablename, ', ' ORDER BY tablename) as rls_tables
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = true;

-- 3. Check all policies are optimized (no direct auth.uid())
SELECT 
  'POLICIES OPTIMIZED' as status,
  COUNT(*) as total_policies,
  COUNT(*) FILTER (WHERE qual LIKE '%(select auth.uid())%') as optimized_policies,
  COUNT(*) FILTER (WHERE qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(select auth.uid())%') as needs_fix
FROM pg_policies 
WHERE schemaname = 'public';

-- 4. Check indexes were created
SELECT 
  'INDEXES CREATED' as status,
  COUNT(*) as total_indexes,
  STRING_AGG(indexname, ', ' ORDER BY indexname) as indexes
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%';

-- 5. Test the has_role function
SELECT 
  'FUNCTION TEST' as status,
  public.has_role(gen_random_uuid(), 'employee'::app_role) as test_result;

-- 6. Check realtime publication
SELECT 
  'REALTIME TABLES' as status,
  COUNT(*) as realtime_tables,
  STRING_AGG(schemaname||'.'||tablename, ', ' ORDER BY tablename) as realtime_enabled
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';

-- 7. Sample data test (optional - uncomment to test)
-- INSERT INTO public.profiles (id, name, email) 
-- VALUES (gen_random_uuid(), 'Test User', 'test@example.com') 
-- ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- VERIFICATION COMPLETE
-- ============================================================
