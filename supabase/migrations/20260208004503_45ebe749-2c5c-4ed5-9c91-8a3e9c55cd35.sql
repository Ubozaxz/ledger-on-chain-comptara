-- Fix 1: Update tva_rates RLS policy to require authentication instead of public access
DROP POLICY IF EXISTS "TVA rates are viewable by authenticated users" ON public.tva_rates;

CREATE POLICY "TVA rates are viewable by authenticated users" 
  ON public.tva_rates 
  FOR SELECT 
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Fix 2: Replace is_admin() with has_role() in all RLS policies to use secure user_roles table

-- Update accounting_entries admin policy
DROP POLICY IF EXISTS "Admins can view all accounting entries" ON public.accounting_entries;

CREATE POLICY "Admins can view all accounting entries" 
  ON public.accounting_entries 
  FOR SELECT 
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Update payments admin policy
DROP POLICY IF EXISTS "Admins can view all payments" ON public.payments;

CREATE POLICY "Admins can view all payments" 
  ON public.payments 
  FOR SELECT 
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Update profiles admin policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles" 
  ON public.profiles 
  FOR SELECT 
  TO authenticated
  USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'));