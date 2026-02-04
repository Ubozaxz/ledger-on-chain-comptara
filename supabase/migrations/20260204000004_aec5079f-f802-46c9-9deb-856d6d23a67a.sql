-- Trigger pour auto-attribuer le rôle admin à ubozaxz@gmail.com
CREATE OR REPLACE FUNCTION public.handle_admin_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Auto-attribuer le rôle admin si l'email est ubozaxz@gmail.com
  IF NEW.email = 'ubozaxz@gmail.com' THEN
    NEW.role := 'admin';
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger sur insertion dans profiles
DROP TRIGGER IF EXISTS set_admin_role ON public.profiles;
CREATE TRIGGER set_admin_role
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_admin_user();

-- Mettre à jour le rôle si le profil existe déjà
UPDATE public.profiles
SET role = 'admin', updated_at = now()
WHERE email = 'ubozaxz@gmail.com';