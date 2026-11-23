-- HealthyLife — read-only check. Paste into Supabase → SQL Editor → New query and run.
-- Changes nothing. Rows with ok = false are missing. Fix by applying the migration named in "needed_for".
with expected_tables(name, needed_for) as (values
  ('profiles','202611220001'),('meal_logs','202611220002'),
  ('wellness_goals','202611220003'),('hydration_logs','202611220003'),('medications','202611220003'),
  ('medication_logs','202611220003'),('weight_logs','202611220003'),
  ('daily_targets','202611220004'),('custom_foods','202611220004'),('custom_recipes','202611220004'),('meal_plans','202611220004'),
  ('meal_slot_settings','202611220005'),('progress_suggestions','202611220005'),
  ('push_subscriptions','202611230001')
),
expected_columns(tbl, col, needed_for) as (values
  ('profiles','preferences','202611220005'),
  ('profiles','onboarding_skipped_at','202611220006'),
  ('profiles','height_cm','202611220004'),
  ('profiles','preferred_weight_unit','202611220004'),
  ('meal_plans','snoozed_until','202611220005'),
  ('meal_plans','reminder_sent_at','202611220005'),
  ('wellness_goals','weight_goal_date','202611220004'),
  ('wellness_goals','glass_size_ml','202611230002'),
  ('medications','starts_on','202611230002'),
  ('medications','ends_on','202611230002')
)
select 'table exists' as check_type, name as item, (to_regclass('public.'||name) is not null) as ok, needed_for
from expected_tables
union all
select 'row level security on', name,
  coalesce((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
            where n.nspname='public' and c.relname=expected_tables.name), false), needed_for
from expected_tables
union all
select 'column exists', tbl||'.'||col,
  exists (select 1 from information_schema.columns where table_schema='public' and table_name=tbl and column_name=col), needed_for
from expected_columns
union all
select 'function exists', 'delete_my_account()', (to_regprocedure('public.delete_my_account()') is not null), '202611220005'
union all
select 'index exists (2.1.0)', 'meal_logs_user_created_idx', (to_regclass('public.meal_logs_user_created_idx') is not null), '202611240001'
union all
select 'anon has no table access', name,
  not exists (select 1 from information_schema.role_table_grants g where g.table_schema='public' and g.table_name=expected_tables.name and g.grantee='anon'), 'security'
from expected_tables
order by ok, check_type, item;
