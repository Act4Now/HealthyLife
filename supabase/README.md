# Supabase setup — HealthyLife AI 1.0.2

Supabase provides authentication, PostgreSQL and private photo storage. Apply all migrations in filename order. GitHub Pages remains a static frontend.

## 1. Create a Supabase project
Create a project in the Supabase dashboard and keep the project URL and publishable/anon key available. Never use the `service_role` key in this frontend.

## 2. Apply the database migration
In Supabase, open **SQL Editor → New query**, paste the contents of:
`migrations/202611220001_profiles.sql`, then `migrations/202611220002_meal_logs.sql`, then `migrations/202611220003_wellness_trackers.sql`
and run it.

The migration creates `public.profiles`, creates a profile for each new Auth user, and enables Row Level Security. A signed-in user can select and update only the row whose ID equals `auth.uid()`.

## 3. Configure local development
Copy `.env.example` to `.env.local` and set:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

These are browser-side project settings. RLS is the security boundary. Never place a database password, service-role key, or other privileged secret in a `VITE_*` variable.

## 4. Configure GitHub Pages build
In the repository, open **Settings → Secrets and variables → Actions → New repository secret** and add:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Then add an Actions variable or secret for the same values as needed by the Pages build workflow. The deployment workflow must pass only the public URL and anon/publishable key at build time. Do not add a service-role key.

## 5. Configure Auth URLs
In Supabase, open **Authentication → URL Configuration**:
- Set the Site URL to `https://act4now.github.io/HealthyLife/`.
- Add the same URL to Redirect URLs.
- Add the local Vite URL (usually `http://localhost:5173/**`) for local testing.

## Current scope and limitations
- Email/password sign-up and sign-in are wired to Supabase Auth when environment variables are configured.
- Profile creation is performed by a database trigger.
- The meal and wellness migrations create owner-scoped meal logs, hydration logs, medication schedules and administration logs, weight logs, personal goals, and the private meal photo bucket. Each table has Row Level Security policies. Verify each migration in the Supabase SQL Editor before using real data.
- Do not use real health data until the remaining data model, retention, export/deletion, privacy and security review are complete.
