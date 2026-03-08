-- Stations now own the metric relationship (not the other way around)
-- Add location and metric_id to stations
alter table stations add column location text not null default '';
alter table stations add column metric_id uuid references metrics(id) on delete set null;

-- Migrate existing station->metric links: for each metric that had a station, set that station's metric_id
update stations s
set metric_id = m.id
from metrics m
where m.station_id = s.id;

-- Remove station_id from metrics (relationship is now on stations)
alter table metrics drop column station_id;
