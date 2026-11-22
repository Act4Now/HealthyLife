-- Meal nutrition logs for HealthyLife AI
create table if not exists public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  photo_path text,
  calories_kcal integer not null default 0 check (calories_kcal >= 0),
  protein_g numeric(8,2) not null default 0,
  carbohydrates_g numeric(8,2) not null default 0,
  fat_g numeric(8,2) not null default 0,
  ingredients jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.meal_logs enable row level security;
drop policy if exists "Meal logs readable by owner" on public.meal_logs;
create policy "Meal logs readable by owner" on public.meal_logs for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Meal logs insertable by owner" on public.meal_logs;
create policy "Meal logs insertable by owner" on public.meal_logs for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Meal logs deletable by owner" on public.meal_logs;
create policy "Meal logs deletable by owner" on public.meal_logs for delete to authenticated using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-photos', 'meal-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists "Meal photos upload by owner" on storage.objects;
create policy "Meal photos upload by owner" on storage.objects for insert to authenticated
with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Meal photos read by owner" on storage.objects;
create policy "Meal photos read by owner" on storage.objects for select to authenticated
using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Meal photos delete by owner" on storage.objects;
create policy "Meal photos delete by owner" on storage.objects for delete to authenticated
using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
