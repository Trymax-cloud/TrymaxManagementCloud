-- STEP 0: Check Database State and Recreate Missing Tables
-- Run this FIRST to check what tables exist and recreate any missing ones

-- Check what tables currently exist
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check if assignments table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'assignments'
) as assignments_exists;

-- Check if profiles table exists  
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'profiles'
) as profiles_exists;

-- Check if client_payments table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'client_payments'
) as client_payments_exists;

-- If assignments table is missing, recreate it
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables 
                   WHERE table_schema = 'public' 
                   AND table_name = 'assignments') THEN
        
        -- Create assignments table
        CREATE TABLE public.assignments (
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
        
        -- Enable RLS
        ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
        
        RAISE NOTICE 'Created assignments table';
    END IF;
END $$;

-- If profiles table is missing, recreate it
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables 
                   WHERE table_schema = 'public' 
                   AND table_name = 'profiles') THEN
        
        -- Create profiles table
        CREATE TABLE public.profiles (
            id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
            email text UNIQUE,
            full_name text,
            avatar_url text,
            role text DEFAULT 'employee' CHECK (role IN ('employee', 'director')),
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now()
        );
        
        -- Enable RLS
        ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
        
        RAISE NOTICE 'Created profiles table';
    END IF;
END $$;

-- If client_payments table is missing, recreate it
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables 
                   WHERE table_schema = 'public' 
                   AND table_name = 'client_payments') THEN
        
        -- Create client_payments table
        CREATE TABLE public.client_payments (
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
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now()
        );
        
        -- Enable RLS
        ALTER TABLE public.client_payments ENABLE ROW LEVEL SECURITY;
        
        RAISE NOTICE 'Created client_payments table';
    END IF;
END $$;

-- Show final table status
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
