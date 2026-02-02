-- Fix infinite recursion in profiles RLS policies
-- The "Admins can view all profiles" policy causes recursion because it queries profiles table

-- Drop problematic admin policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Create a simpler admin check using a security definer function to avoid recursion
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = check_user_id AND role = 'admin'
  );
$$;

-- Create non-recursive admin view policy
CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT USING (
  auth.uid() = user_id OR public.is_admin(auth.uid())
);

-- Fix overly permissive policies on accounting_entries
DROP POLICY IF EXISTS "Users can insert accounting_entries" ON public.accounting_entries;
DROP POLICY IF EXISTS "Users can update accounting_entries" ON public.accounting_entries;
DROP POLICY IF EXISTS "Users can delete accounting_entries" ON public.accounting_entries;

CREATE POLICY "Users can insert own accounting_entries" ON public.accounting_entries
FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own accounting_entries" ON public.accounting_entries
FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can delete own accounting_entries" ON public.accounting_entries
FOR DELETE USING (auth.uid() = user_id OR user_id IS NULL);

-- Fix overly permissive policies on payments
DROP POLICY IF EXISTS "Users can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Users can update payments" ON public.payments;
DROP POLICY IF EXISTS "Users can delete payments" ON public.payments;

CREATE POLICY "Users can insert own payments" ON public.payments
FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own payments" ON public.payments
FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can delete own payments" ON public.payments
FOR DELETE USING (auth.uid() = user_id OR user_id IS NULL);