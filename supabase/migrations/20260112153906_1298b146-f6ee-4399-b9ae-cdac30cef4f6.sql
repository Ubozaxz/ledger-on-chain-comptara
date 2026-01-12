-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Admin policy: admins can view all data
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

-- Update accounting_entries policies for auth
DROP POLICY IF EXISTS "Users can view entries by wallet address " ON public.accounting_entries;
DROP POLICY IF EXISTS "Users can create entries " ON public.accounting_entries;
DROP POLICY IF EXISTS "Users can update entries " ON public.accounting_entries;
DROP POLICY IF EXISTS "Users can delete entries " ON public.accounting_entries;

-- Add user_id column to accounting_entries
ALTER TABLE public.accounting_entries ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

CREATE POLICY "Authenticated users can view their entries" 
ON public.accounting_entries 
FOR SELECT 
USING (auth.uid() = user_id OR auth.uid() IS NOT NULL AND user_id IS NULL);

CREATE POLICY "Authenticated users can create entries" 
ON public.accounting_entries 
FOR INSERT 
WITH CHECK (auth.uid() = user_id OR auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update their entries" 
ON public.accounting_entries 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can delete their entries" 
ON public.accounting_entries 
FOR DELETE 
USING (auth.uid() = user_id);

-- Admin policy for accounting_entries
CREATE POLICY "Admins can view all accounting entries" 
ON public.accounting_entries 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

-- Update payments policies for auth
DROP POLICY IF EXISTS "Users can view payments by wallet address " ON public.payments;
DROP POLICY IF EXISTS "Users can create payments " ON public.payments;
DROP POLICY IF EXISTS "Users can update payments " ON public.payments;
DROP POLICY IF EXISTS "Users can delete payments " ON public.payments;

-- Add user_id column to payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

CREATE POLICY "Authenticated users can view their payments" 
ON public.payments 
FOR SELECT 
USING (auth.uid() = user_id OR auth.uid() IS NOT NULL AND user_id IS NULL);

CREATE POLICY "Authenticated users can create payments" 
ON public.payments 
FOR INSERT 
WITH CHECK (auth.uid() = user_id OR auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update their payments" 
ON public.payments 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can delete their payments" 
ON public.payments 
FOR DELETE 
USING (auth.uid() = user_id);

-- Admin policy for payments
CREATE POLICY "Admins can view all payments" 
ON public.payments 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, role)
  VALUES (
    NEW.id, 
    NEW.email,
    CASE WHEN NEW.email = 'ubozaxz@gmail.com' THEN 'admin' ELSE 'user' END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add trigger for updated_at on profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();