-- EMERGENCY DATABASE RESTORATION
-- This will restore all essential tables for the EWPM system

-- First, let's check what's left
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Create essential types if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM (
            'employee',
            'director'
        );
        RAISE NOTICE 'Created app_role type';
    END IF;
END $$;

-- Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, role)
);

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email text UNIQUE,
    full_name text,
    avatar_url text,
    role public.app_role DEFAULT 'employee',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold', 'cancelled')),
    start_date date,
    end_date date,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create assignments table
CREATE TABLE IF NOT EXISTS public.assignments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    description text,
    creator_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    assignee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'emergency')),
    due_date timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create client_payments table
CREATE TABLE IF NOT EXISTS public.client_payments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    client_name text NOT NULL,
    project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
    invoice_amount numeric(10,2) NOT NULL,
    amount_paid numeric(10,2) DEFAULT 0,
    invoice_date date NOT NULL,
    due_date date NOT NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'partially_paid', 'paid')),
    responsible_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    remarks text,
    last_72h_reminder_sent TIMESTAMP NULL,
    last_24h_reminder_sent TIMESTAMP NULL,
    last_overdue_reminder_sent TIMESTAMP NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create meetings table
CREATE TABLE IF NOT EXISTS public.meetings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    description text,
    start_time timestamptz NOT NULL,
    end_time timestamptz NOT NULL,
    location text,
    created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create meeting_participants table
CREATE TABLE IF NOT EXISTS public.meeting_participants (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    meeting_id uuid REFERENCES public.meetings(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    status text DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined', 'tentative')),
    created_at timestamptz DEFAULT now(),
    UNIQUE(meeting_id, user_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id uuid NOT NULL,
    sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    receiver_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    content text NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title text NOT NULL,
    message text,
    type text DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
    is_read boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Create attendance table
CREATE TABLE IF NOT EXISTS public.attendance (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    date date NOT NULL,
    check_in timestamptz,
    check_out timestamptz,
    status text DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'half_day')),
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, date)
);

-- Create daily_summaries table
CREATE TABLE IF NOT EXISTS public.daily_summaries (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    date date NOT NULL,
    summary text,
    tasks_completed integer DEFAULT 0,
    tasks_pending integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, date)
);

-- Create employee_ratings table
CREATE TABLE IF NOT EXISTS public.employee_ratings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    rating numeric(3,2) CHECK (rating >= 0 AND rating <= 5),
    feedback text,
    rated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    period date NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(employee_id, period)
);

-- Create assignment_status_history table
CREATE TABLE IF NOT EXISTS public.assignment_status_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    assignment_id uuid REFERENCES public.assignments(id) ON DELETE CASCADE NOT NULL,
    old_status text,
    new_status text NOT NULL,
    changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    changed_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_status_history ENABLE ROW LEVEL SECURITY;

-- Create essential indexes
CREATE INDEX IF NOT EXISTS idx_assignments_assignee_id ON public.assignments(assignee_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON public.assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON public.assignments(due_date);
CREATE INDEX IF NOT EXISTS idx_client_payments_due_date ON public.client_payments(due_date);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

-- Show what tables we have now
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

RAISE NOTICE 'Database restoration completed! All essential tables have been recreated.';
