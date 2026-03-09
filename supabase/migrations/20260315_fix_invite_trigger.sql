-- Revert handle_new_user to original (no invite logic in trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- New function: called after login to claim any pending invite
CREATE OR REPLACE FUNCTION public.claim_invite()
RETURNS void AS $$
DECLARE
  invited_role user_role;
  user_email TEXT;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
  SELECT role INTO invited_role FROM public.invites WHERE email = user_email LIMIT 1;

  IF invited_role IS NOT NULL THEN
    UPDATE public.profiles SET role = invited_role WHERE id = auth.uid();
    DELETE FROM public.invites WHERE email = user_email;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
