-- Add input_mode to metrics: 'all' (fill all inputs together) or 'single' (pick one input at a time)
ALTER TABLE metrics ADD COLUMN input_mode text NOT NULL DEFAULT 'all';
