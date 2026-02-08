-- Create a secure view for public profile access that excludes email addresses
-- This view is for admin access to user profiles without exposing emails
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = true) AS
SELECT 
  id,
  user_id,
  display_name,
  role,
  created_at,
  updated_at
FROM public.profiles;

-- Grant SELECT on the view to authenticated users
GRANT SELECT ON public.profiles_public TO authenticated;

-- Drop the overly permissive admin policy on profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Create a more restrictive policy - users can ONLY view their own profile
-- Admins should use the profiles_public view for viewing other users
CREATE POLICY "Users can only view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);