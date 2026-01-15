-- QUICK FIX: Allow employees to update their own payments
-- Run this in Supabase SQL Editor to fix payment update permissions

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Directors can manage payments" ON public.client_payments;

-- Create new policy that allows:
-- Directors: Full access to all payments
-- Employees: Can update payments they are responsible for
CREATE POLICY "Users can manage payments" ON public.client_payments
FOR ALL USING (
  public.has_role((select auth.uid()), 'director'::public.app_role) OR
  (public.has_role((select auth.uid()), 'employee'::public.app_role) AND responsible_user_id = auth.uid())
);

-- Verify the policy was created correctly
SELECT 
  policyname,
  cmd,
  roles,
  qual
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'client_payments';
