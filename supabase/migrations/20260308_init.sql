-- Categories
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

-- Stations
create table stations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  icon text not null default 'zap',
  description text not null default '',
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- Metrics
create table metrics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  acronym text not null,
  category_id uuid references categories(id) on delete set null,
  station_id uuid references stations(id) on delete set null,
  instructions text not null default '',
  measurement_rules text not null default '',
  gear text not null default '',
  drills text not null default '',
  created_at timestamptz default now()
);

-- Athletes
create table athletes (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  created_at timestamptz default now()
);

-- Results (the core data: athlete + metric + value)
create table results (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  metric_id uuid not null references metrics(id) on delete cascade,
  station_id uuid references stations(id) on delete set null,
  value numeric not null,
  unit text not null default '',
  recorded_at timestamptz default now(),
  recorded_by uuid -- future: references auth.users
);

create index idx_results_athlete on results(athlete_id);
create index idx_results_metric on results(metric_id);
create index idx_results_recorded_at on results(recorded_at desc);

-- Seed default categories
insert into categories (name) values
  ('Power'), ('Speed'), ('Stability'), ('Strength'), ('Endurance');

-- Seed default stations
insert into stations (slug, name, icon, description, sort_order) values
  ('rsi', 'RSI', 'zap', 'Reactive Strength Index', 0),
  ('sprint', 'Sprint Splits', 'timer', '10m / 20m / 40m', 1),
  ('vertical', 'Vertical Jump', 'arrow-up-right', 'Standing / Approach', 2),
  ('balance', 'Balance', 'scale', 'Single Leg Hold', 3),
  ('explosiveness', 'Explosiveness', 'dumbbell', 'Broad Jump / Bounds', 4),
  ('strength', 'Strength', 'ruler', 'Max Rep Testing', 5);

-- Seed default metrics
insert into metrics (name, acronym, category_id, station_id, instructions, measurement_rules, gear, drills)
select
  m.name, m.acronym,
  c.id as category_id,
  s.id as station_id,
  m.instructions, m.measurement_rules, m.gear, m.drills
from (values
  ('Reactive Strength Index', 'RSI', 'Power', 'rsi',
   'Athlete performs a depth jump from a 30cm box onto a contact mat. Measure flight time vs contact time.',
   'Best of 3 attempts. Rest 60s between attempts.', 'Contact mat, 30cm box', 'Depth jumps, Pogo hops'),
  ('Sprint Splits', 'Sprint', 'Speed', 'sprint',
   'Athlete sprints 40m through electronic timing gates at 10m, 20m, and 40m.',
   'Best of 2 attempts. Full recovery between runs.', 'Electronic timing gates', 'Block starts, Acceleration runs'),
  ('Vertical Jump', 'VJ', 'Power', 'vertical',
   'Athlete performs a countermovement jump reaching for Vertec vanes.',
   'Best of 3 attempts. Standing reach measured first.', 'Vertec or jump mat', 'Squat jumps, Tuck jumps'),
  ('Single Leg Balance', 'Balance', 'Stability', 'balance',
   'Athlete stands on one leg, eyes open, hands on hips. Time until loss of balance.',
   'Max 60 seconds. Both legs tested.', 'Stopwatch, flat surface', 'Single leg RDL, Bosu ball stands'),
  ('Standing Broad Jump', 'SBJ', 'Power', 'explosiveness',
   'Athlete performs a standing broad jump from behind a line. Measure from takeoff line to nearest heel landing.',
   'Best of 3 attempts.', 'Tape measure, flat surface', 'Bounds, Box jumps'),
  ('Max Rep Test', 'Strength', 'Strength', 'strength',
   'Athlete performs max reps of a given exercise in proper form.',
   'Stop at form breakdown. Spotter required.', 'Barbell, plates, spotter', 'Progressive overload sets')
) as m(name, acronym, cat_name, station_slug, instructions, measurement_rules, gear, drills)
join categories c on c.name = m.cat_name
join stations s on s.slug = m.station_slug;

-- Enable RLS (permissive for now, lock down later with auth)
alter table categories enable row level security;
alter table stations enable row level security;
alter table metrics enable row level security;
alter table athletes enable row level security;
alter table results enable row level security;

-- Allow all operations for now (replace with auth policies later)
create policy "Allow all" on categories for all using (true) with check (true);
create policy "Allow all" on stations for all using (true) with check (true);
create policy "Allow all" on metrics for all using (true) with check (true);
create policy "Allow all" on athletes for all using (true) with check (true);
create policy "Allow all" on results for all using (true) with check (true);
