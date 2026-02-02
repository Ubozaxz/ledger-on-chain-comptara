-- Clean up remaining permissive policies that use USING(true) or WITH CHECK(true)

-- Remove old permissive policies on accounting_entries
DROP POLICY IF EXISTS "Users can create entries" ON public.accounting_entries;
DROP POLICY IF EXISTS "Users can delete entries" ON public.accounting_entries;
DROP POLICY IF EXISTS "Users can update entries" ON public.accounting_entries;
DROP POLICY IF EXISTS "Users can view entries by wallet address" ON public.accounting_entries;

-- Remove old permissive policies on payments
DROP POLICY IF EXISTS "Users can create payments" ON public.payments;
DROP POLICY IF EXISTS "Users can delete payments" ON public.payments;
DROP POLICY IF EXISTS "Users can update payments" ON public.payments;
DROP POLICY IF EXISTS "Users can view payments by wallet address" ON public.payments;

-- Fix the admin policies to use the is_admin function instead of recursive query
DROP POLICY IF EXISTS "Admins can view all accounting entries" ON public.accounting_entries;
DROP POLICY IF EXISTS "Admins can view all payments" ON public.payments;

-- Recreate admin policies using the is_admin function
CREATE POLICY "Admins can view all accounting entries" ON public.accounting_entries
FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can view all payments" ON public.payments
FOR SELECT USING (public.is_admin(auth.uid()));

-- Also update the profiles admin policy to use the function
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));