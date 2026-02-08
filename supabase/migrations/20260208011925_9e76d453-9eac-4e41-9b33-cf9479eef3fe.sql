-- Drop and recreate the profiles_public view with security_invoker = true
-- This ensures the view inherits RLS from the underlying profiles table
DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public
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
-- Access will be controlled by the underlying profiles table RLS policies
GRANT SELECT ON public.profiles_public TO authenticated;

-- Revoke access from anon role for extra security
REVOKE ALL ON public.profiles_public FROM anon;