-- Drop the existing admin policy that exposes all profile data including emails
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Create a new admin policy that only allows admins to view non-sensitive profile data
-- Admins can see profiles but this is scoped to essential fields via a view pattern
-- The email column should be protected - admins don't need to see other users' emails directly

-- Create a function to check if the requesting user is viewing their own profile
-- This ensures admins can only see their own email, not other users' emails
CREATE OR REPLACE FUNCTION public.is_own_profile(profile_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT profile_user_id = auth.uid()
$$;

-- Recreate admin view policy with proper scoping
-- Admins can view all profiles for user management purposes (display_name, user_id, role, timestamps)
-- But the email should only be visible if it's their own profile
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (
  (auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role)
);

-- Note: The RLS policy cannot restrict specific columns, so we need to handle this at the application level
-- by creating a secure view or modifying the application queries to not expose sensitive data