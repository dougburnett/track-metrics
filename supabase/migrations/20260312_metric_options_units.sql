-- Add direction, min/max, and unit to metrics
ALTER TABLE metrics ADD COLUMN lower_is_better boolean NOT NULL DEFAULT false;
ALTER TABLE metrics ADD COLUMN min_value numeric;
ALTER TABLE metrics ADD COLUMN max_value numeric;
ALTER TABLE metrics ADD COLUMN unit text NOT NULL DEFAULT '';

-- Units table
CREATE TABLE units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read units"
  ON units FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin can manage units"
  ON units FOR ALL TO authenticated
  USING (public.user_role() = 'super_admin')
  WITH CHECK (public.user_role() = 'super_admin');

-- Seed common units
INSERT INTO units (name) VALUES
  ('seconds'), ('milliseconds'), ('minutes'),
  ('inches'), ('feet'), ('meters'), ('centimeters'),
  ('mph'), ('m/s'),
  ('lbs'), ('kg'),
  ('reps'), ('ratio'), ('score'), ('bpm'), ('%');
