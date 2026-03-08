-- Add grade and gender to athletes
ALTER TABLE athletes ADD COLUMN grade smallint NOT NULL DEFAULT 9;
ALTER TABLE athletes ADD COLUMN gender text NOT NULL DEFAULT '';
