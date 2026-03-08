-- Add multi-input and formula support to metrics
ALTER TABLE metrics ADD COLUMN inputs jsonb;
ALTER TABLE metrics ADD COLUMN formula text NOT NULL DEFAULT '';

-- Add sub-values storage to results
ALTER TABLE results ADD COLUMN sub_values jsonb;
