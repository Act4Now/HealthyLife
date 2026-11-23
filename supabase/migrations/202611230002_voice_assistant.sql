-- Voice assistant support: user-configurable glass volume and bounded medication schedules.
alter table public.wellness_goals
  add column if not exists glass_size_ml integer not null default 250
    check (glass_size_ml between 50 and 2000);

alter table public.medications
  add column if not exists starts_on date not null default current_date,
  add column if not exists ends_on date;
