-- FIX EMPLOYEE PAYMENT PERMISSIONS
-- Allow employees to update payments they are responsible for
-- Run this to fix payment update permissions for employees

-- Drop existing policy
DROP POLICY IF EXISTS "Directors can manage payments" ON public.client_payments;

-- Create comprehensive policy that allows:
-- 1. Directors to manage all payments
-- 2. Employees to update payments they are responsible for
CREATE POLICY "Users can manage payments" ON public.client_payments
FOR ALL USING (
  -- Directors can access all payments
  public.has_role((select auth.uid()), 'director'::public.app_role) OR
  
  -- Employees can access payments they are responsible for
  (public.has_role((select auth.uid()), 'employee'::public.app_role) 
   AND responsible_user_id = auth.uid())
);

-- Add separate policy for inserts (directors only)
CREATE POLICY "Directors can insert payments" ON public.client_payments
FOR INSERT WITH CHECK (
  public.has_role((select auth.uid()), 'director'::public.app_role)
);

-- Verify the fix
SELECT 
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%responsible_user_id = auth.uid()%' THEN 'EMPLOYEE_ACCESS ✅'
    WHEN qual LIKE '%has_role.*director%' THEN 'DIRECTOR_ACCESS ✅'
    ELSE 'NEEDS_FIX ❌'
  END as status
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'client_payments'
ORDER BY policyname;

-- Test employee access (this should return rows for employees)
SELECT 
  'Employee can update their own payments' as test_description,
  COUNT(*) as accessible_payments
FROM client_payments 
WHERE responsible_user_id = auth.uid();

-- Test director access (this should return all rows for directors)
SELECT 
  'Director can access all payments' as test_description,
  COUNT(*) as accessible_payments
FROM client_payments 
WHERE public.has_role((select auth.uid()), 'director'::public.app_role');
