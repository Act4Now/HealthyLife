-- HealthyLife 2.0.0: preferences, configurable meal slots, reminder snooze and progress suggestions.
alter table public.profiles
  add column if not exists preferences jsonb not null default '{"locale":"ro","theme":"auto","text_size":"normal","weight_unit":"kg","height_unit":"cm","dashboard_widgets":["targets","meals","water","weight","sleep","steps"]}'::jsonb;

create table if not exists public.meal_slot_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  slot_key text not null check (length(trim(slot_key)) between 1 and 40),
  slot_label text not null check (length(trim(slot_label)) between 1 and 80),
  slot_time time not null,
  reminder_enabled boolean not null default false,
  sort_order integer not null default 0,
  unique(user_id,slot_key)
);
alter table public.meal_slot_settings enable row level security;
revoke all on public.meal_slot_settings from anon;
grant select,insert,update,delete on public.meal_slot_settings to authenticated;
drop policy if exists "meal slot settings owner access" on public.meal_slot_settings;
create policy "meal slot settings owner access" on public.meal_slot_settings for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.meal_plans
  add column if not exists snoozed_until timestamptz,
  add column if not exists reminder_sent_at timestamptz;

create table if not exists public.progress_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  suggestion_type text not null check (suggestion_type in ('calories','water','steps','sleep','weight_goal')),
  current_value numeric,
  suggested_value numeric,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','accepted','edited','dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists progress_suggestions_user_created_idx on public.progress_suggestions(user_id,created_at desc);
alter table public.progress_suggestions enable row level security;
revoke all on public.progress_suggestions from anon;
grant select,insert,update,delete on public.progress_suggestions to authenticated;
drop policy if exists "progress suggestions owner access" on public.progress_suggestions;
create policy "progress suggestions owner access" on public.progress_suggestions for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Users can delete only their own account and all associated rows.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
