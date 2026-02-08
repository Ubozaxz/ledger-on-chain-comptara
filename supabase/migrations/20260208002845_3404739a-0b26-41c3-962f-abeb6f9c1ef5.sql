-- Fix RLS policies: Remove NULL user_id bypass vulnerability
-- This migration removes the vulnerable "OR user_id IS NULL" conditions

-- =============================================
-- ACCOUNTING_ENTRIES TABLE - Fix policies
-- =============================================

-- Drop existing vulnerable policies
DROP POLICY IF EXISTS "Users can insert own accounting_entries" ON public.accounting_entries;
DROP POLICY IF EXISTS "Users can update own accounting_entries" ON public.accounting_entries;
DROP POLICY IF EXISTS "Users can delete own accounting_entries" ON public.accounting_entries;
DROP POLICY IF EXISTS "Authenticated users can view their entries" ON public.accounting_entries;
DROP POLICY IF EXISTS "Authenticated users can create entries" ON public.accounting_entries;
DROP POLICY IF EXISTS "Authenticated users can update their entries" ON public.accounting_entries;
DROP POLICY IF EXISTS "Authenticated users can delete their entries" ON public.accounting_entries;

-- Create secure policies (strict user_id matching only)
CREATE POLICY "Users can view own entries" 
  ON public.accounting_entries 
  FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own entries" 
  ON public.accounting_entries 
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own entries" 
  ON public.accounting_entries 
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own entries" 
  ON public.accounting_entries 
  FOR DELETE 
  TO authenticated
  USING (auth.uid() = user_id);

-- =============================================
-- PAYMENTS TABLE - Fix policies
-- =============================================

-- Drop existing vulnerable policies
DROP POLICY IF EXISTS "Users can insert own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can update own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can delete own payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can view their payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can create payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can update their payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can delete their payments" ON public.payments;

-- Create secure policies (strict user_id matching only)
CREATE POLICY "Users can view own payments" 
  ON public.payments 
  FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payments" 
  ON public.payments 
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payments" 
  ON public.payments 
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own payments" 
  ON public.payments 
  FOR DELETE 
  TO authenticated
  USING (auth.uid() = user_id);

-- =============================================
-- Update existing NULL user_id records to prevent orphaned data
-- =============================================

-- Note: This will make orphaned records inaccessible
-- In production, you may want to review these records first
-- SELECT * FROM accounting_entries WHERE user_id IS NULL;
-- SELECT * FROM payments WHERE user_id IS NULL;