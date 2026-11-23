-- HealthyLife 2.1.0 — non-destructive. Safe to run more than once. Does not delete or rewrite user records.
-- Prerequisite: migrations 202611220001 … 202611230002 (or run verify.sql first to see what is already applied).

-- 1) Make sure the voice-assistant columns exist (same as 202611230002; harmless if already applied).
alter table public.wellness_goals
  add column if not exists glass_size_ml integer not null default 250
    check (glass_size_ml between 50 and 2000);
alter table public.medications
  add column if not exists starts_on date not null default current_date,
  add column if not exists ends_on date;

-- 2) Indexes for the dashboard, recent-meals shortcuts, history and suggestions.
create index if not exists meal_logs_user_created_idx on public.meal_logs(user_id, created_at desc);
create index if not exists weight_logs_user_measured_idx on public.weight_logs(user_id, measured_at desc);
create index if not exists daily_targets_user_date_idx on public.daily_targets(user_id, target_date desc, created_at desc);
create index if not exists medications_user_active_ends_idx on public.medications(user_id, active, ends_on);
create index if not exists meal_slot_settings_user_order_idx on public.meal_slot_settings(user_id, sort_order, slot_time);

-- 3) One water goal. Until 2.0.0 the daily-target water value and the Hydration screen's goal were stored
--    separately. Copy the latest daily-target water value into the Hydration goal, but only where the
--    daily target is newer than the existing Hydration goal (a goal you set later is never overwritten).
insert into public.wellness_goals (user_id, hydration_goal_ml, updated_at)
select t.user_id, t.water_ml, t.created_at
from (
  select distinct on (user_id) user_id, water_ml, created_at
  from public.daily_targets
  where water_ml between 250 and 10000
  order by user_id, target_date desc, created_at desc
) t
on conflict (user_id) do update
  set hydration_goal_ml = excluded.hydration_goal_ml,
      updated_at = excluded.updated_at
  where public.wellness_goals.updated_at < excluded.updated_at;

-- 4) Re-assert owner-only access and no anonymous access on the tables the 2.1.0 screens use.
--    (Policies already exist from earlier migrations; these statements only confirm the grants.)
revoke all on public.meal_slot_settings, public.progress_suggestions, public.daily_targets from anon;
grant select, insert, update, delete on public.meal_slot_settings, public.progress_suggestions, public.daily_targets to authenticated;

-- 5) Hardening found by the Supabase security advisor on 2026-11-23.
--    * anon had table-level grants on profiles and meal_logs (Row Level Security already blocked it; remove the grants too).
--    * handle_new_user() is a trigger function and must not be callable through /rest/v1/rpc.
--      Revoking EXECUTE does not stop the auth.users trigger from firing.
revoke all on public.profiles, public.meal_logs from anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
