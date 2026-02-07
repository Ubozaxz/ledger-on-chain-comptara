-- Create user roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table for secure role management
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create SECURITY DEFINER function to check roles safely
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger to auto-assign admin role to ubozaxz@gmail.com
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = NEW.user_id;
  
  IF user_email = 'ubozaxz@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger on profiles table to create role on profile creation
CREATE TRIGGER on_profile_created_set_role
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Grant admin to existing ubozaxz@gmail.com user
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'admin'::app_role
FROM public.profiles p
WHERE p.email = 'ubozaxz@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Create TVA rates table
CREATE TABLE public.tva_rates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    label text NOT NULL,
    rate numeric NOT NULL,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

-- Insert default French TVA rates
INSERT INTO public.tva_rates (code, label, rate, is_default) VALUES
('TVA_20', 'TVA 20% (Taux normal)', 20, true),
('TVA_10', 'TVA 10% (Taux intermédiaire)', 10, false),
('TVA_5_5', 'TVA 5.5% (Taux réduit)', 5.5, false),
('TVA_2_1', 'TVA 2.1% (Taux particulier)', 2.1, false),
('TVA_0', 'Exonéré de TVA', 0, false);

-- Enable RLS on TVA rates
ALTER TABLE public.tva_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "TVA rates are viewable by authenticated users"
ON public.tva_rates
FOR SELECT
TO authenticated
USING (true);

-- Add TVA columns to accounting_entries
ALTER TABLE public.accounting_entries 
ADD COLUMN IF NOT EXISTS tva_rate numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS montant_ht numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS montant_tva numeric DEFAULT NULL;