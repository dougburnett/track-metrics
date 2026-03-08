-- User role enum and profiles table
CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'athlete');

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role user_role NOT NULL DEFAULT 'athlete',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS
CREATE POLICY "Authenticated users can read profiles"
  ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Replace "Allow all" policies with role-based policies

-- categories
DROP POLICY IF EXISTS "Allow all" ON categories;
CREATE POLICY "Authenticated can read categories"
  ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin can manage categories"
  ON categories FOR INSERT TO authenticated
  WITH CHECK (public.user_role() = 'super_admin');
CREATE POLICY "Super admin can update categories"
  ON categories FOR UPDATE TO authenticated
  USING (public.user_role() = 'super_admin')
  WITH CHECK (public.user_role() = 'super_admin');
CREATE POLICY "Super admin can delete categories"
  ON categories FOR DELETE TO authenticated
  USING (public.user_role() = 'super_admin');

-- stations
DROP POLICY IF EXISTS "Allow all" ON stations;
CREATE POLICY "Authenticated can read stations"
  ON stations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin can manage stations"
  ON stations FOR INSERT TO authenticated
  WITH CHECK (public.user_role() = 'super_admin');
CREATE POLICY "Super admin can update stations"
  ON stations FOR UPDATE TO authenticated
  USING (public.user_role() = 'super_admin')
  WITH CHECK (public.user_role() = 'super_admin');
CREATE POLICY "Super admin can delete stations"
  ON stations FOR DELETE TO authenticated
  USING (public.user_role() = 'super_admin');

-- metrics
DROP POLICY IF EXISTS "Allow all" ON metrics;
CREATE POLICY "Authenticated can read metrics"
  ON metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin can manage metrics"
  ON metrics FOR INSERT TO authenticated
  WITH CHECK (public.user_role() = 'super_admin');
CREATE POLICY "Super admin can update metrics"
  ON metrics FOR UPDATE TO authenticated
  USING (public.user_role() = 'super_admin')
  WITH CHECK (public.user_role() = 'super_admin');
CREATE POLICY "Super admin can delete metrics"
  ON metrics FOR DELETE TO authenticated
  USING (public.user_role() = 'super_admin');

-- athletes
DROP POLICY IF EXISTS "Allow all" ON athletes;
CREATE POLICY "Authenticated can read athletes"
  ON athletes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage athletes"
  ON athletes FOR INSERT TO authenticated
  WITH CHECK (public.user_role() IN ('super_admin', 'admin'));
CREATE POLICY "Admin can update athletes"
  ON athletes FOR UPDATE TO authenticated
  USING (public.user_role() IN ('super_admin', 'admin'))
  WITH CHECK (public.user_role() IN ('super_admin', 'admin'));
CREATE POLICY "Admin can delete athletes"
  ON athletes FOR DELETE TO authenticated
  USING (public.user_role() IN ('super_admin', 'admin'));

-- results
DROP POLICY IF EXISTS "Allow all" ON results;
CREATE POLICY "Authenticated can read results"
  ON results FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can insert results"
  ON results FOR INSERT TO authenticated
  WITH CHECK (public.user_role() IN ('super_admin', 'admin'));
CREATE POLICY "Admin can update results"
  ON results FOR UPDATE TO authenticated
  USING (public.user_role() IN ('super_admin', 'admin'))
  WITH CHECK (public.user_role() IN ('super_admin', 'admin'));
CREATE POLICY "Super admin can delete results"
  ON results FOR DELETE TO authenticated
  USING (public.user_role() = 'super_admin');
