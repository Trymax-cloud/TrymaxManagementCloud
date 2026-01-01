CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'employee',
    'director'
);


--
-- Name: attendance_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.attendance_status AS ENUM (
    'present',
    'absent',
    'half_day'
);


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: is_meeting_creator(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_meeting_creator(_meeting_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.meetings
    WHERE id = _meeting_id
      AND created_by = _user_id
  )
$$;


--
-- Name: is_meeting_participant(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_meeting_participant(_meeting_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.meeting_participants
    WHERE meeting_id = _meeting_id
      AND user_id = _user_id
  )
$$;


--
-- Name: notify_meeting_participant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_meeting_participant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  meeting_title TEXT;
  meeting_datetime TEXT;
BEGIN
  SELECT title, to_char(meeting_date, 'Mon DD, YYYY') || ' at ' || to_char(meeting_time, 'HH12:MI AM')
  INTO meeting_title, meeting_datetime
  FROM public.meetings WHERE id = NEW.meeting_id;
  
  -- Only notify if participant is not the creator
  IF NEW.user_id != (SELECT created_by FROM public.meetings WHERE id = NEW.meeting_id) THEN
    INSERT INTO public.notifications (user_id, title, message, type, related_entity_type, related_entity_id, action_url)
    VALUES (
      NEW.user_id,
      'Meeting Invitation',
      'You have been invited to: ' || COALESCE(meeting_title, 'Meeting') || ' on ' || meeting_datetime,
      'meeting',
      'meeting',
      NEW.meeting_id,
      '/meetings'
    );
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: notify_new_message(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_new_message() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  sender_name TEXT;
BEGIN
  SELECT name INTO sender_name FROM public.profiles WHERE id = NEW.sender_id;
  
  INSERT INTO public.notifications (user_id, title, message, type, related_entity_type, related_entity_id, action_url)
  VALUES (
    NEW.receiver_id,
    'New Message',
    'You have a new message from ' || COALESCE(sender_name, 'Unknown'),
    'message',
    'message',
    NEW.id,
    '/messages'
  );
  
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: assignment_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assignment_status_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assignment_id uuid NOT NULL,
    old_status text NOT NULL,
    new_status text NOT NULL,
    remark text,
    changed_by uuid NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    creator_id uuid NOT NULL,
    assignee_id uuid NOT NULL,
    project_id uuid,
    created_date date DEFAULT CURRENT_DATE NOT NULL,
    due_date date,
    completion_date date,
    status text DEFAULT 'not_started'::text NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    remark text,
    start_time timestamp with time zone,
    end_time timestamp with time zone,
    total_duration_minutes integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    category text DEFAULT 'general'::text NOT NULL
);


--
-- Name: attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    check_in timestamp with time zone,
    check_out timestamp with time zone,
    status public.attendance_status DEFAULT 'present'::public.attendance_status NOT NULL,
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: client_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_name text NOT NULL,
    project_id uuid,
    invoice_amount numeric NOT NULL,
    amount_paid numeric DEFAULT 0 NOT NULL,
    invoice_date date DEFAULT CURRENT_DATE NOT NULL,
    due_date date NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    remarks text,
    responsible_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: daily_summaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_summaries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    date date NOT NULL,
    tasks_completed integer DEFAULT 0 NOT NULL,
    tasks_pending integer DEFAULT 0 NOT NULL,
    tasks_in_progress integer DEFAULT 0 NOT NULL,
    emergency_tasks integer DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: employee_ratings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_ratings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    period_type text NOT NULL,
    period_value text NOT NULL,
    score numeric NOT NULL,
    remarks text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT employee_ratings_score_check CHECK (((score >= (0)::numeric) AND (score <= (5)::numeric)))
);


--
-- Name: meeting_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meeting_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    meeting_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: meetings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meetings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    note text,
    meeting_date date NOT NULL,
    meeting_time time without time zone NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sender_id uuid NOT NULL,
    receiver_id uuid NOT NULL,
    content text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type text DEFAULT 'system'::text NOT NULL,
    priority text,
    is_read boolean DEFAULT false NOT NULL,
    related_entity_type text,
    related_entity_id uuid,
    action_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    client_name text NOT NULL,
    description text,
    start_date date DEFAULT CURRENT_DATE NOT NULL,
    end_date date,
    status text DEFAULT 'active'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    stage text DEFAULT 'order_received'::text NOT NULL,
    CONSTRAINT projects_stage_check CHECK ((stage = ANY (ARRAY['order_received'::text, 'inspection'::text, 'dispatch'::text, 'delivery'::text])))
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'employee'::public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: assignment_status_history assignment_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment_status_history
    ADD CONSTRAINT assignment_status_history_pkey PRIMARY KEY (id);


--
-- Name: assignments assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_pkey PRIMARY KEY (id);


--
-- Name: attendance attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);


--
-- Name: attendance attendance_user_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_user_id_date_key UNIQUE (user_id, date);


--
-- Name: client_payments client_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_payments
    ADD CONSTRAINT client_payments_pkey PRIMARY KEY (id);


--
-- Name: daily_summaries daily_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_summaries
    ADD CONSTRAINT daily_summaries_pkey PRIMARY KEY (id);


--
-- Name: daily_summaries daily_summaries_user_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_summaries
    ADD CONSTRAINT daily_summaries_user_id_date_key UNIQUE (user_id, date);


--
-- Name: employee_ratings employee_ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_ratings
    ADD CONSTRAINT employee_ratings_pkey PRIMARY KEY (id);


--
-- Name: employee_ratings employee_ratings_user_id_period_type_period_value_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_ratings
    ADD CONSTRAINT employee_ratings_user_id_period_type_period_value_key UNIQUE (user_id, period_type, period_value);


--
-- Name: meeting_participants meeting_participants_meeting_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_participants
    ADD CONSTRAINT meeting_participants_meeting_id_user_id_key UNIQUE (meeting_id, user_id);


--
-- Name: meeting_participants meeting_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_participants
    ADD CONSTRAINT meeting_participants_pkey PRIMARY KEY (id);


--
-- Name: meetings meetings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: meeting_participants on_meeting_participant_added; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_meeting_participant_added AFTER INSERT ON public.meeting_participants FOR EACH ROW EXECUTE FUNCTION public.notify_meeting_participant();


--
-- Name: messages on_new_message; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_new_message AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();


--
-- Name: assignments update_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: attendance update_attendance_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: client_payments update_client_payments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_client_payments_updated_at BEFORE UPDATE ON public.client_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: daily_summaries update_daily_summaries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_daily_summaries_updated_at BEFORE UPDATE ON public.daily_summaries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: employee_ratings update_employee_ratings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_employee_ratings_updated_at BEFORE UPDATE ON public.employee_ratings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: meetings update_meetings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: messages update_messages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notifications update_notifications_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: projects update_projects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: assignment_status_history assignment_status_history_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment_status_history
    ADD CONSTRAINT assignment_status_history_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;


--
-- Name: assignment_status_history assignment_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment_status_history
    ADD CONSTRAINT assignment_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id);


--
-- Name: assignments assignments_assignee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES auth.users(id);


--
-- Name: assignments assignments_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES auth.users(id);


--
-- Name: assignments assignments_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: attendance attendance_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: client_payments client_payments_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_payments
    ADD CONSTRAINT client_payments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: client_payments client_payments_responsible_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_payments
    ADD CONSTRAINT client_payments_responsible_user_id_fkey FOREIGN KEY (responsible_user_id) REFERENCES auth.users(id);


--
-- Name: daily_summaries daily_summaries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_summaries
    ADD CONSTRAINT daily_summaries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: employee_ratings employee_ratings_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_ratings
    ADD CONSTRAINT employee_ratings_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: employee_ratings employee_ratings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_ratings
    ADD CONSTRAINT employee_ratings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: meeting_participants meeting_participants_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meeting_participants
    ADD CONSTRAINT meeting_participants_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: projects projects_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: projects All authenticated users can view projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "All authenticated users can view projects" ON public.projects FOR SELECT TO authenticated USING (true);


--
-- Name: projects Authenticated users can insert projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: meetings Directors can delete any meeting; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Directors can delete any meeting" ON public.meetings FOR DELETE USING (public.has_role(auth.uid(), 'director'::public.app_role));


--
-- Name: client_payments Directors can manage payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Directors can manage payments" ON public.client_payments USING (public.has_role(auth.uid(), 'director'::public.app_role));


--
-- Name: projects Directors can manage projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Directors can manage projects" ON public.projects USING (public.has_role(auth.uid(), 'director'::public.app_role));


--
-- Name: employee_ratings Directors can manage ratings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Directors can manage ratings" ON public.employee_ratings USING (public.has_role(auth.uid(), 'director'::public.app_role));


--
-- Name: assignments Directors can update all assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Directors can update all assignments" ON public.assignments FOR UPDATE USING (public.has_role(auth.uid(), 'director'::public.app_role));


--
-- Name: attendance Directors can update any attendance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Directors can update any attendance" ON public.attendance FOR UPDATE USING (public.has_role(auth.uid(), 'director'::public.app_role));


--
-- Name: meetings Directors can update any meeting; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Directors can update any meeting" ON public.meetings FOR UPDATE USING (public.has_role(auth.uid(), 'director'::public.app_role));


--
-- Name: assignments Directors can view all assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Directors can view all assignments" ON public.assignments FOR SELECT USING (public.has_role(auth.uid(), 'director'::public.app_role));


--
-- Name: attendance Directors can view all attendance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Directors can view all attendance" ON public.attendance FOR SELECT USING (public.has_role(auth.uid(), 'director'::public.app_role));


--
-- Name: daily_summaries Directors can view all daily summaries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Directors can view all daily summaries" ON public.daily_summaries FOR SELECT USING (public.has_role(auth.uid(), 'director'::public.app_role));


--
-- Name: meetings Directors can view all meetings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Directors can view all meetings" ON public.meetings FOR SELECT USING (public.has_role(auth.uid(), 'director'::public.app_role));


--
-- Name: profiles Directors can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Directors can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'director'::public.app_role));


--
-- Name: user_roles Directors can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Directors can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'director'::public.app_role));


--
-- Name: attendance Employees can insert own attendance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can insert own attendance" ON public.attendance FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: attendance Employees can update own attendance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can update own attendance" ON public.attendance FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: attendance Employees can view own attendance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can view own attendance" ON public.attendance FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: meeting_participants Meeting creators can add participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Meeting creators can add participants" ON public.meeting_participants FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.meetings m
  WHERE ((m.id = meeting_participants.meeting_id) AND (m.created_by = auth.uid())))) OR public.has_role(auth.uid(), 'director'::public.app_role)));


--
-- Name: meeting_participants Meeting creators can remove participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Meeting creators can remove participants" ON public.meeting_participants FOR DELETE USING (((EXISTS ( SELECT 1
   FROM public.meetings m
  WHERE ((m.id = meeting_participants.meeting_id) AND (m.created_by = auth.uid())))) OR public.has_role(auth.uid(), 'director'::public.app_role)));


--
-- Name: notifications System can insert notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: assignments Users can create assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create assignments" ON public.assignments FOR INSERT TO authenticated WITH CHECK ((auth.uid() = creator_id));


--
-- Name: meetings Users can create meetings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create meetings" ON public.meetings FOR INSERT WITH CHECK ((auth.uid() = created_by));


--
-- Name: meetings Users can delete their own meetings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own meetings" ON public.meetings FOR DELETE USING ((auth.uid() = created_by));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: assignment_status_history Users can insert status history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert status history" ON public.assignment_status_history FOR INSERT TO authenticated WITH CHECK ((auth.uid() = changed_by));


--
-- Name: daily_summaries Users can manage own daily summaries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own daily summaries" ON public.daily_summaries USING ((auth.uid() = user_id));


--
-- Name: messages Users can mark their received messages as read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can mark their received messages as read" ON public.messages FOR UPDATE USING ((auth.uid() = receiver_id));


--
-- Name: messages Users can send messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK ((auth.uid() = sender_id));


--
-- Name: notifications Users can update own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: assignments Users can update their own assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own assignments" ON public.assignments FOR UPDATE USING (((auth.uid() = creator_id) OR (auth.uid() = assignee_id)));


--
-- Name: meetings Users can update their own meetings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own meetings" ON public.meetings FOR UPDATE USING ((auth.uid() = created_by));


--
-- Name: assignments Users can view assignments they created or are assigned to; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view assignments they created or are assigned to" ON public.assignments FOR SELECT USING (((auth.uid() = creator_id) OR (auth.uid() = assignee_id)));


--
-- Name: assignment_status_history Users can view history for their assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view history for their assignments" ON public.assignment_status_history FOR SELECT TO authenticated USING (true);


--
-- Name: meetings Users can view meetings they created; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view meetings they created" ON public.meetings FOR SELECT USING ((auth.uid() = created_by));


--
-- Name: meetings Users can view meetings they participate in; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view meetings they participate in" ON public.meetings FOR SELECT USING (public.is_meeting_participant(id, auth.uid()));


--
-- Name: messages Users can view messages they sent or received; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view messages they sent or received" ON public.messages FOR SELECT USING (((auth.uid() = sender_id) OR (auth.uid() = receiver_id)));


--
-- Name: daily_summaries Users can view own daily summaries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own daily summaries" ON public.daily_summaries FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: notifications Users can view own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: employee_ratings Users can view own ratings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own ratings" ON public.employee_ratings FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view own role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: meeting_participants Users can view participants for meetings they have access to; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view participants for meetings they have access to" ON public.meeting_participants FOR SELECT USING ((public.is_meeting_creator(meeting_id, auth.uid()) OR public.is_meeting_participant(meeting_id, auth.uid()) OR public.has_role(auth.uid(), 'director'::public.app_role)));


--
-- Name: client_payments Users can view payments they are responsible for; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view payments they are responsible for" ON public.client_payments FOR SELECT USING ((auth.uid() = responsible_user_id));


--
-- Name: assignment_status_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assignment_status_history ENABLE ROW LEVEL SECURITY;

--
-- Name: assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: attendance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

--
-- Name: client_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_summaries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_ratings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_ratings ENABLE ROW LEVEL SECURITY;

--
-- Name: meeting_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: meetings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;