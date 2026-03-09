-- Junction table for station <-> metrics (many-to-many)
CREATE TABLE station_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  metric_id uuid NOT NULL REFERENCES metrics(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  UNIQUE(station_id, metric_id)
);

-- Enable RLS
ALTER TABLE station_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "station_metrics_read" ON station_metrics FOR SELECT USING (true);
CREATE POLICY "station_metrics_write" ON station_metrics FOR ALL USING (true);

-- Migrate existing metric_id data
INSERT INTO station_metrics (station_id, metric_id, sort_order)
SELECT id, metric_id, 0 FROM stations WHERE metric_id IS NOT NULL;

-- Drop old column
ALTER TABLE stations DROP COLUMN metric_id;

-- Remove input_mode from metrics (no longer needed)
ALTER TABLE metrics DROP COLUMN input_mode;
