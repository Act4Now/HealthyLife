-- Personalized goals, daily targets, custom foods, recipes and meal planning.
-- Existing history rows are intentionally not rewritten by target changes.

alter table public.profiles
  add column if not exists height_cm numeric(6,2),
  add column if not exists current_weight_kg numeric(6,2),
  add column if not exists goal_weight_kg numeric(6,2),
  add column if not exists weight_goal text check (weight_goal is null or weight_goal in ('lose','maintain','gain')),
  add column if not exists activity_level text check (activity_level is null or activity_level in ('sedentary','light','moderate','high','very_high')),
  add column if not exists goal_pace text check (goal_pace is null or goal_pace in ('gentle','steady','ambitious')),
  add column if not exists preferred_weight_unit text not null default 'kg' check (preferred_weight_unit in ('kg','lb')),
  add column if not exists preferred_height_unit text not null default 'cm' check (preferred_height_unit in ('cm','ft')),
  add column if not exists onboarding_completed_at timestamptz;

create table if not exists public.daily_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target_date date not null default current_date,
  day_type text not null default 'all' check (day_type in ('all','weekday','weekend')),
  calories_kcal integer check (calories_kcal is null or calories_kcal between 500 and 10000),
  protein_g numeric(8,2) check (protein_g is null or protein_g between 0 and 1000),
  carbs_g numeric(8,2) check (carbs_g is null or carbs_g between 0 and 1500),
  fat_g numeric(8,2) check (fat_g is null or fat_g between 0 and 1000),
  water_ml integer check (water_ml is null or water_ml between 0 and 15000),
  steps integer check (steps is null or steps between 0 and 100000),
  sleep_hours numeric(4,2) check (sleep_hours is null or sleep_hours between 0 and 24),
  enabled jsonb not null default '{"calories":true,"protein":true,"carbs":true,"fat":true,"water":true,"steps":false,"sleep":false}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists daily_targets_user_date_idx on public.daily_targets(user_id,target_date desc);
alter table public.daily_targets enable row level security;
revoke all on public.daily_targets from anon;
grant select,insert,update,delete on public.daily_targets to authenticated;
drop policy if exists "daily targets owner access" on public.daily_targets;
create policy "daily targets owner access" on public.daily_targets for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table if not exists public.custom_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  serving_name text not null default '100 g',
  serving_grams numeric(8,2) not null default 100 check (serving_grams > 0 and serving_grams <= 10000),
  calories_kcal numeric(8,2) not null default 0 check (calories_kcal >= 0),
  protein_g numeric(8,2) not null default 0 check (protein_g >= 0),
  carbs_g numeric(8,2) not null default 0 check (carbs_g >= 0),
  fat_g numeric(8,2) not null default 0 check (fat_g >= 0),
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.custom_foods enable row level security;
revoke all on public.custom_foods from anon;
grant select,insert,update,delete on public.custom_foods to authenticated;
drop policy if exists "custom foods owner access" on public.custom_foods;
create policy "custom foods owner access" on public.custom_foods for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table if not exists public.custom_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  servings numeric(6,2) not null default 1 check (servings > 0 and servings <= 100),
  ingredients jsonb not null default '[]'::jsonb,
  calories_per_serving numeric(8,2) not null default 0,
  protein_per_serving numeric(8,2) not null default 0,
  carbs_per_serving numeric(8,2) not null default 0,
  fat_per_serving numeric(8,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.custom_recipes enable row level security;
revoke all on public.custom_recipes from anon;
grant select,insert,update,delete on public.custom_recipes to authenticated;
drop policy if exists "custom recipes owner access" on public.custom_recipes;
create policy "custom recipes owner access" on public.custom_recipes for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  planned_for timestamptz not null,
  slot_name text not null check (length(trim(slot_name)) between 1 and 80),
  meal_name text not null check (length(trim(meal_name)) between 1 and 160),
  reminder_enabled boolean not null default false,
  eaten_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists meal_plans_user_date_idx on public.meal_plans(user_id,planned_for);
alter table public.meal_plans enable row level security;
revoke all on public.meal_plans from anon;
grant select,insert,update,delete on public.meal_plans to authenticated;
drop policy if exists "meal plans owner access" on public.meal_plans;
create policy "meal plans owner access" on public.meal_plans for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Allow owners to correct or remove an existing weight entry.
drop policy if exists "weight owner update" on public.weight_logs;
create policy "weight owner update" on public.weight_logs for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "weight owner delete" on public.weight_logs;
create policy "weight owner delete" on public.weight_logs for delete to authenticated
using ((select auth.uid()) = user_id);
