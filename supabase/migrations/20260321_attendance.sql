-- Attendance status enum
CREATE TYPE attendance_status AS ENUM ('present', 'late', 'excused', 'unexcused');

-- Attendance table
CREATE TABLE attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  date date NOT NULL,
  status attendance_status NOT NULL,
  recorded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(athlete_id, date)
);

-- Indexes
CREATE INDEX idx_attendance_athlete_id ON attendance(athlete_id);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_athlete_date ON attendance(athlete_id, date);

-- RLS
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "Authenticated users can read attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (true);

-- Admin+ can insert
CREATE POLICY "Admins can insert attendance"
  ON attendance FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Admin+ can update
CREATE POLICY "Admins can update attendance"
  ON attendance FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Admin+ can delete
CREATE POLICY "Admins can delete attendance"
  ON attendance FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );
