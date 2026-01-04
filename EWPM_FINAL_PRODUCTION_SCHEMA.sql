-- ============================================================
-- EWPM FINAL SAFE PRODUCTION SCHEMA
-- Zero-Risk • Clean • Optimized • Electron-Ready
-- ============================================================

-- ============================================================
-- 0. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. ENUMS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('employee', 'director');
  END IF;
END $$;

-- ============================================================
-- 2. TABLES
-- ============================================================

-- PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- USER ROLES
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'employee',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id)
);

-- PROJECTS
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  client_name TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  stage TEXT DEFAULT 'order_received',
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ASSIGNMENTS (NO TIME TRACKING)
CREATE TABLE IF NOT EXISTS public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'not_started',
  priority TEXT DEFAULT 'medium',
  category TEXT DEFAULT 'general',
  assignee_id UUID REFERENCES auth.users(id),
  creator_id UUID REFERENCES auth.users(id),
  project_id UUID REFERENCES public.projects(id),
  created_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  completion_date DATE,
  remark TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- CLIENT PAYMENTS
CREATE TABLE IF NOT EXISTS public.client_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  project_id UUID REFERENCES public.projects(id),
  invoice_amount NUMERIC NOT NULL,
  amount_paid NUMERIC DEFAULT 0,
  invoice_date DATE DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  status TEXT DEFAULT 'pending',
  responsible_user_id UUID REFERENCES auth.users(id),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- DAILY SUMMARIES
CREATE TABLE IF NOT EXISTS public.daily_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  date DATE NOT NULL,
  tasks_completed INT DEFAULT 0,
  tasks_pending INT DEFAULT 0,
  tasks_in_progress INT DEFAULT 0,
  emergency_tasks INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, date)
);

-- EMPLOYEE RATINGS
CREATE TABLE IF NOT EXISTS public.employee_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  period_type TEXT,
  period_value TEXT,
  score NUMERIC,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- MEETINGS
CREATE TABLE IF NOT EXISTS public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  meeting_time TIME NOT NULL,
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- MEETING PARTICIPANTS
CREATE TABLE IF NOT EXISTS public.meeting_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (meeting_id, user_id)
);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. SECURITY FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_role(uid UUID, r app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = uid AND role = r
  )
$$;

-- ============================================================
-- 4. UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 5. AUTH SIGNUP TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name','User'), NEW.email);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 6. ENABLE RLS
-- ============================================================
ALTER TABLE ALL IN SCHEMA public ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. RLS POLICIES (OPTIMIZED)
-- ============================================================

-- PROFILES
DROP POLICY IF EXISTS "profile_self" ON public.profiles;
DROP POLICY IF EXISTS "profile_director" ON public.profiles;

CREATE POLICY "profile_self"
ON public.profiles FOR ALL
USING ((select auth.uid()) = id);

CREATE POLICY "profile_director"
ON public.profiles FOR SELECT
USING (public.has_role((select auth.uid()), 'director'));

-- USER ROLES
DROP POLICY IF EXISTS "roles_self" ON public.user_roles;

CREATE POLICY "roles_self"
ON public.user_roles FOR SELECT
USING ((select auth.uid()) = user_id);

-- PROJECTS
DROP POLICY IF EXISTS "projects_read" ON public.projects;
DROP POLICY IF EXISTS "projects_director" ON public.projects;

CREATE POLICY "projects_read"
ON public.projects FOR SELECT USING (true);

CREATE POLICY "projects_director"
ON public.projects FOR ALL
USING (public.has_role((select auth.uid()), 'director'));

-- ASSIGNMENTS
DROP POLICY IF EXISTS "assignments_read" ON public.assignments;
DROP POLICY IF EXISTS "assignments_write" ON public.assignments;
DROP POLICY IF EXISTS "assignments_update" ON public.assignments;

CREATE POLICY "assignments_read"
ON public.assignments FOR SELECT
USING (
  creator_id = (select auth.uid()) OR
  assignee_id = (select auth.uid()) OR
  public.has_role((select auth.uid()), 'director')
);

CREATE POLICY "assignments_write"
ON public.assignments FOR INSERT
WITH CHECK (creator_id = (select auth.uid()));

CREATE POLICY "assignments_update"
ON public.assignments FOR UPDATE
USING (
  creator_id = (select auth.uid()) OR
  assignee_id = (select auth.uid()) OR
  public.has_role((select auth.uid()), 'director')
);

-- PAYMENTS
DROP POLICY IF EXISTS "payments_read" ON public.client_payments;
DROP POLICY IF EXISTS "payments_manage" ON public.client_payments;

CREATE POLICY "payments_read"
ON public.client_payments FOR SELECT
USING (
  responsible_user_id = (select auth.uid()) OR
  public.has_role((select auth.uid()), 'director')
);

CREATE POLICY "payments_manage"
ON public.client_payments FOR ALL
USING (public.has_role((select auth.uid()), 'director'));

-- DAILY SUMMARY
DROP POLICY IF EXISTS "daily_self" ON public.daily_summaries;

CREATE POLICY "daily_self"
ON public.daily_summaries FOR ALL
USING ((select auth.uid()) = user_id);

-- MEETINGS
DROP POLICY IF EXISTS "meetings_manage" ON public.meetings;

CREATE POLICY "meetings_manage"
ON public.meetings FOR ALL
USING (
  created_by = (select auth.uid()) OR
  public.has_role((select auth.uid()), 'director')
);

-- NOTIFICATIONS
DROP POLICY IF EXISTS "notifications_self" ON public.notifications;

CREATE POLICY "notifications_self"
ON public.notifications FOR ALL
USING ((select auth.uid()) = user_id);

-- ============================================================
-- 8. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_assignments_assignee ON public.assignments(assignee_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON public.assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON public.assignments(due_date);
CREATE INDEX IF NOT EXISTS idx_assignments_creator ON public.assignments(creator_id);
CREATE INDEX IF NOT EXISTS idx_payments_due ON public.client_payments(due_date);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.client_payments(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_user_date ON public.daily_summaries(user_id, date);

-- ============================================================
-- 9. UPDATED_AT TRIGGERS
-- ============================================================

CREATE TRIGGER IF NOT EXISTS update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER IF NOT EXISTS update_user_roles_updated_at
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER IF NOT EXISTS update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER IF NOT EXISTS update_assignments_updated_at
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER IF NOT EXISTS update_client_payments_updated_at
  BEFORE UPDATE ON public.client_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER IF NOT EXISTS update_daily_summaries_updated_at
  BEFORE UPDATE ON public.daily_summaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER IF NOT EXISTS update_employee_ratings_updated_at
  BEFORE UPDATE ON public.employee_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER IF NOT EXISTS update_meetings_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER IF NOT EXISTS update_meeting_participants_updated_at
  BEFORE UPDATE ON public.meeting_participants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER IF NOT EXISTS update_notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 10. REALTIME (SAFE)
-- ============================================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.assignments;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 11. VERIFICATION
-- ============================================================

-- Check all tables exist
SELECT 'TABLES CREATED' as status, COUNT(*) as count
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'profiles', 'user_roles', 'projects', 'assignments', 
  'client_payments', 'daily_summaries', 'employee_ratings', 
  'meets', 'meeting_participants', 'notifications'
);

-- Check RLS is enabled
SELECT 'RLS ENABLED' as status, COUNT(*) as count
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = true;

-- Check optimized policies
SELECT 'POLICIES OPTIMIZED' as status, 
  COUNT(*) FILTER (WHERE qual LIKE '%(select auth.uid())%') as optimized,
  COUNT(*) FILTER (WHERE qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(select auth.uid())%') as needs_fix
FROM pg_policies 
WHERE schemaname = 'public';

-- ============================================================
-- DONE ✅
-- ============================================================
