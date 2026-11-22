-- HealthyLife v2.0.0: allow users to correct their own meal diary entries.
-- RLS enforces ownership both before and after the update.
grant update on public.meal_logs to authenticated;
drop policy if exists "Meal logs updatable by owner" on public.meal_logs;
create policy "Meal logs updatable by owner"
  on public.meal_logs for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
