-- HealthyLife: hydration, medication and weight tracking
create table if not exists public.wellness_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  hydration_goal_ml integer not null default 2000 check (hydration_goal_ml between 250 and 10000),
  weight_goal_kg numeric(5,2) check (weight_goal_kg is null or weight_goal_kg between 20 and 500),
  updated_at timestamptz not null default now()
);

create table if not exists public.hydration_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  amount_ml integer not null check (amount_ml between 1 and 5000),
  logged_at timestamptz not null default now()
);
create index if not exists hydration_logs_user_logged_idx on public.hydration_logs(user_id, logged_at desc);

create table if not exists public.medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  dose text not null check (length(trim(dose)) between 1 and 120),
  schedule text not null default '08:00' check (schedule ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists medications_user_active_idx on public.medications(user_id, active);

create table if not exists public.medication_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  status text not null check (status in ('taken','skipped')),
  taken_at timestamptz not null default now()
);
create index if not exists medication_logs_user_taken_idx on public.medication_logs(user_id, taken_at desc);

create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  weight_kg numeric(5,2) not null check (weight_kg between 20 and 500),
  measured_at timestamptz not null default now(),
  notes text not null default ''
);
create index if not exists weight_logs_user_measured_idx on public.weight_logs(user_id, measured_at);

alter table public.wellness_goals enable row level security;
alter table public.hydration_logs enable row level security;
alter table public.medications enable row level security;
alter table public.medication_logs enable row level security;
alter table public.weight_logs enable row level security;

revoke all on public.wellness_goals, public.hydration_logs, public.medications, public.medication_logs, public.weight_logs from anon;
grant select, insert, update, delete on public.wellness_goals, public.hydration_logs, public.medications, public.medication_logs, public.weight_logs to authenticated;

drop policy if exists "wellness goals owner access" on public.wellness_goals;
create policy "wellness goals owner access" on public.wellness_goals for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "hydration owner select" on public.hydration_logs;
create policy "hydration owner select" on public.hydration_logs for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "hydration owner insert" on public.hydration_logs;
create policy "hydration owner insert" on public.hydration_logs for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "hydration owner delete" on public.hydration_logs;
create policy "hydration owner delete" on public.hydration_logs for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "medications owner access" on public.medications;
create policy "medications owner access" on public.medications for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "medication logs owner select" on public.medication_logs;
create policy "medication logs owner select" on public.medication_logs for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "medication logs owner insert" on public.medication_logs;
create policy "medication logs owner insert" on public.medication_logs for insert to authenticated
with check (
  (select auth.uid()) = user_id and exists (
    select 1 from public.medications m where m.id = medication_id and m.user_id = (select auth.uid())
  )
);
drop policy if exists "medication logs owner delete" on public.medication_logs;
create policy "medication logs owner delete" on public.medication_logs for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "weight owner select" on public.weight_logs;
create policy "weight owner select" on public.weight_logs for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "weight owner insert" on public.weight_logs;
create policy "weight owner insert" on public.weight_logs for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "weight owner update" on public.weight_logs;
create policy "weight owner update" on public.weight_logs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "weight owner delete" on public.weight_logs;
create policy "weight owner delete" on public.weight_logs for delete to authenticated using ((select auth.uid()) = user_id);
