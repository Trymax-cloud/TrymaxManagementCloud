-- ============================================================
-- EWPM Clean Production Schema
-- Optimized with RLS performance fixes
-- ============================================================

-- ============================================================
-- 1. ENUMS
-- ============================================================

CREATE TYPE public.app_role AS ENUM ('employee', 'director');

-- ============================================================
-- 2. TABLES
-- ============================================================

-- Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
    id UUID NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User roles table (stores user roles separately for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role public.app_role NOT NULL DEFAULT 'employee'::app_role,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Projects table
CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    client_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'::text,
    stage TEXT NOT NULL DEFAULT 'order_received'::text,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Assignments table (cleaned up - no time tracking)
CREATE TABLE public.assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'not_started'::text,
    priority TEXT NOT NULL DEFAULT 'normal'::text,
    category TEXT NOT NULL DEFAULT 'general'::text,
    assignee_id UUID NOT NULL,
    creator_id UUID NOT NULL,
    project_id UUID REFERENCES public.projects(id),
    created_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    completion_date DATE,
    remark TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Client payments table
CREATE TABLE public.client_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name TEXT NOT NULL,
    project_id UUID REFERENCES public.projects(id),
    invoice_amount NUMERIC NOT NULL,
    amount_paid NUMERIC NOT NULL DEFAULT 0,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'::text,
    responsible_user_id UUID NOT NULL,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Daily summaries table
CREATE TABLE public.daily_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    date DATE NOT NULL,
    tasks_completed INTEGER NOT NULL DEFAULT 0,
    tasks_pending INTEGER NOT NULL DEFAULT 0,
    tasks_in_progress INTEGER NOT NULL DEFAULT 0,
    emergency_tasks INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Employee ratings table
CREATE TABLE public.employee_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    created_by UUID NOT NULL,
    period_type TEXT NOT NULL,
    period_value TEXT NOT NULL,
    score NUMERIC NOT NULL,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Meetings table
CREATE TABLE public.meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    meeting_date DATE NOT NULL,
    meeting_time TIME WITHOUT TIME ZONE NOT NULL,
    note TEXT,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Meeting participants table
CREATE TABLE public.meeting_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES public.meetings(id),
    user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Messages table
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL,
    receiver_id UUID NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Notifications table
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'system'::text,
    priority TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    related_entity_type TEXT,
    related_entity_id UUID,
    action_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. SECURITY DEFINER FUNCTIONS (for RLS)
-- ============================================================

-- Function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user is meeting creator
CREATE OR REPLACE FUNCTION public.is_meeting_creator(_meeting_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.meetings
    WHERE id = _meeting_id
      AND created_by = _user_id
  )
$$;

-- Function to check if user is meeting participant
CREATE OR REPLACE FUNCTION public.is_meeting_participant(_meeting_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.meeting_participants
    WHERE meeting_id = _meeting_id
      AND user_id = _user_id
  )
$$;

-- ============================================================
-- 4. UTILITY FUNCTIONS
-- ============================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Function to handle new user signup (creates profile and role)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', 'User'),
    NEW.email
  );
  
  -- Insert role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data ->> 'role')::public.app_role, 'employee')
  );
  
  RETURN NEW;
END;
$$;

-- ============================================================
-- 5. TRIGGERS (minimal - only handle_new_user)
-- ============================================================

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 6. ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. RLS POLICIES - PROFILES (OPTIMIZED)
-- ============================================================

CREATE POLICY "Users can view own profile" 
  ON public.profiles FOR SELECT 
  USING ((select auth.uid()) = id);

CREATE POLICY "Users can insert own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE 
  USING ((select auth.uid()) = id);

CREATE POLICY "Directors can view all profiles" 
  ON public.profiles FOR SELECT 
  USING (public.has_role((select auth.uid()), 'director'::app_role));

-- ============================================================
-- 8. RLS POLICIES - USER ROLES (OPTIMIZED)
-- ============================================================

CREATE POLICY "Users can view own role" 
  ON public.user_roles FOR SELECT 
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Directors can view all roles" 
  ON public.user_roles FOR SELECT 
  USING (public.has_role((select auth.uid()), 'director'::app_role));

-- ============================================================
-- 9. RLS POLICIES - PROJECTS (OPTIMIZED)
-- ============================================================

CREATE POLICY "All authenticated users can view projects" 
  ON public.projects FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can insert projects" 
  ON public.projects FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Directors can manage projects" 
  ON public.projects FOR ALL 
  USING (public.has_role((select auth.uid()), 'director'::app_role));

-- ============================================================
-- 10. RLS POLICIES - ASSIGNMENTS (OPTIMIZED)
-- ============================================================

CREATE POLICY "Users can view assignments they created or are assigned to" 
  ON public.assignments FOR SELECT 
  USING (((select auth.uid()) = creator_id) OR ((select auth.uid()) = assignee_id));

CREATE POLICY "Directors can view all assignments" 
  ON public.assignments FOR SELECT 
  USING (public.has_role((select auth.uid()), 'director'::app_role));

CREATE POLICY "Users can create assignments" 
  ON public.assignments FOR INSERT 
  WITH CHECK ((select auth.uid()) = creator_id);

CREATE POLICY "Users can update their own assignments" 
  ON public.assignments FOR UPDATE 
  USING (((select auth.uid()) = creator_id) OR ((select auth.uid()) = assignee_id));

CREATE POLICY "Directors can update all assignments" 
  ON public.assignments FOR UPDATE 
  USING (public.has_role((select auth.uid()), 'director'::app_role));

-- ============================================================
-- 11. RLS POLICIES - CLIENT PAYMENTS (OPTIMIZED)
-- ============================================================

CREATE POLICY "Users can view payments they are responsible for" 
  ON public.client_payments FOR SELECT 
  USING ((select auth.uid()) = responsible_user_id);

CREATE POLICY "Directors can manage payments" 
  ON public.client_payments FOR ALL 
  USING (public.has_role((select auth.uid()), 'director'::app_role));

-- ============================================================
-- 12. RLS POLICIES - DAILY SUMMARIES (OPTIMIZED)
-- ============================================================

CREATE POLICY "Users can view own daily summaries" 
  ON public.daily_summaries FOR SELECT 
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can manage own daily summaries" 
  ON public.daily_summaries FOR ALL 
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Directors can view all daily summaries" 
  ON public.daily_summaries FOR SELECT 
  USING (public.has_role((select auth.uid()), 'director'::app_role));

-- ============================================================
-- 13. RLS POLICIES - EMPLOYEE RATINGS (OPTIMIZED)
-- ============================================================

CREATE POLICY "Users can view own ratings" 
  ON public.employee_ratings FOR SELECT 
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Directors can manage ratings" 
  ON public.employee_ratings FOR ALL 
  USING (public.has_role((select auth.uid()), 'director'::app_role));

-- ============================================================
-- 14. RLS POLICIES - MEETINGS (OPTIMIZED)
-- ============================================================

CREATE POLICY "Users can create meetings" 
  ON public.meetings FOR INSERT 
  WITH CHECK ((select auth.uid()) = created_by);

CREATE POLICY "Users can view meetings they created" 
  ON public.meetings FOR SELECT 
  USING ((select auth.uid()) = created_by);

CREATE POLICY "Users can view meetings they participate in" 
  ON public.meetings FOR SELECT 
  USING (public.is_meeting_participant(id, (select auth.uid())));

CREATE POLICY "Directors can view all meetings" 
  ON public.meetings FOR SELECT 
  USING (public.has_role((select auth.uid()), 'director'::app_role));

CREATE POLICY "Users can update their own meetings" 
  ON public.meetings FOR UPDATE 
  USING ((select auth.uid()) = created_by);

CREATE POLICY "Directors can update any meeting" 
  ON public.meetings FOR UPDATE 
  USING (public.has_role((select auth.uid()), 'director'::app_role));

CREATE POLICY "Users can delete their own meetings" 
  ON public.meetings FOR DELETE 
  USING ((select auth.uid()) = created_by);

CREATE POLICY "Directors can delete any meeting" 
  ON public.meetings FOR DELETE 
  USING (public.has_role((select auth.uid()), 'director'::app_role));

-- ============================================================
-- 15. RLS POLICIES - MEETING PARTICIPANTS (OPTIMIZED)
-- ============================================================

CREATE POLICY "Users can view participants for meetings they have access to" 
  ON public.meeting_participants FOR SELECT 
  USING (
    public.is_meeting_creator(meeting_id, (select auth.uid())) OR 
    public.is_meeting_participant(meeting_id, (select auth.uid())) OR 
    public.has_role((select auth.uid()), 'director'::app_role)
  );

CREATE POLICY "Meeting creators can add participants" 
  ON public.meeting_participants FOR INSERT 
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_participants.meeting_id AND m.created_by = (select auth.uid())
    )) OR public.has_role((select auth.uid()), 'director'::app_role)
  );

CREATE POLICY "Meeting creators can remove participants" 
  ON public.meeting_participants FOR DELETE 
  USING (
    (EXISTS (
      SELECT 1 FROM meetings m
      WHERE m.id = meeting_participants.meeting_id AND m.created_by = (select auth.uid())
    )) OR public.has_role((select auth.uid()), 'director'::app_role)
  );

-- ============================================================
-- 16. RLS POLICIES - MESSAGES (OPTIMIZED)
-- ============================================================

CREATE POLICY "Users can view messages they sent or received" 
  ON public.messages FOR SELECT 
  USING (((select auth.uid()) = sender_id) OR ((select auth.uid()) = receiver_id));

CREATE POLICY "Users can send messages" 
  ON public.messages FOR INSERT 
  WITH CHECK ((select auth.uid()) = sender_id);

CREATE POLICY "Users can mark their received messages as read" 
  ON public.messages FOR UPDATE 
  USING ((select auth.uid()) = receiver_id);

-- ============================================================
-- 17. RLS POLICIES - NOTIFICATIONS (OPTIMIZED)
-- ============================================================

CREATE POLICY "Users can view own notifications" 
  ON public.notifications FOR SELECT 
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own notifications" 
  ON public.notifications FOR UPDATE 
  USING ((select auth.uid()) = user_id);

CREATE POLICY "System can insert notifications" 
  ON public.notifications FOR INSERT 
  WITH CHECK (true);

-- ============================================================
-- 18. PERFORMANCE INDEXES
-- ============================================================

-- Essential indexes for performance
CREATE INDEX idx_assignments_assignee_id ON public.assignments(assignee_id);
CREATE INDEX idx_assignments_status ON public.assignments(status);
CREATE INDEX idx_assignments_due_date ON public.assignments(due_date);
CREATE INDEX idx_client_payments_due_date ON public.client_payments(due_date);
CREATE INDEX idx_client_payments_status ON public.client_payments(status);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_meetings_date ON public.meetings(meeting_date);
CREATE INDEX idx_messages_sender_receiver ON public.messages(sender_id, receiver_id);
CREATE INDEX idx_daily_summaries_user_date ON public.daily_summaries(user_id, date);

-- ============================================================
-- 19. REALTIME (Enable for key tables)
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.assignments;

-- ============================================================
-- END OF CLEAN PRODUCTION SCHEMA
-- ============================================================
