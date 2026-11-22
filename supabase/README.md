# Supabase setup — HealthyLife AI 1.0.2

Supabase provides authentication, PostgreSQL and private photo storage. Apply all migrations in filename order. GitHub Pages remains a static frontend.

## 1. Create a Supabase project
Create a project in the Supabase dashboard and keep the project URL and publishable/anon key available. Never use the `service_role` key in this frontend.

## 2. Apply the database migration
In Supabase, open **SQL Editor → New query** and apply every migration in filename order, one at a time:

1. `migrations/202611220001_profiles.sql`
2. `migrations/202611220002_meal_logs.sql`
3. `migrations/202611220003_wellness_trackers.sql`
4. `migrations/202611220004_personalization_and_meals.sql`
5. `migrations/202611220005_v2_preferences_planner_and_suggestions.sql`
6. `migrations/202611220006_onboarding_deferral.sql`
7. `migrations/202611220007_meal_log_owner_updates.sql`

Verify each query completes successfully before deploying frontend code that references its columns, tables, or policies. These migrations add schema and owner-scoped permissions; they do not delete existing user records.

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


## 6. Transient food-photo analysis (optional)
The meal screen can send a selected JPG, PNG or WebP image to the Supabase Edge Function `analyze-food-photo`. The function forwards the image inline to the Gemini API for one analysis request. HealthyLife does **not** upload the photo to Supabase Storage, put it in the meal row, or retain it in meal history. Only the user-reviewed food names, portions and estimated nutrition values are saved when the user presses **Save meal**.

This is not zero-transfer processing: the image is transmitted to Google for inference. The app asks for explicit consent before sending it. Google's data handling depends on the API tier and terms. Google's current Gemini API pricing documentation says content from the free tier may be used to improve Google products, while paid-tier content is not used for that purpose. Do not use the free tier for sensitive images if this is unacceptable.

Deployment (requires Supabase CLI and a Gemini API key):
```sh
supabase functions deploy analyze-food-photo
supabase functions deploy generate-recipes
supabase secrets set GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```
Keep the key only as a Supabase Edge Function secret; never add it to `.env`, GitHub Pages secrets with a `VITE_` prefix, or browser code. The app's Supabase Edge Function invocation requires a signed-in user. Both photo analysis and recipe generation use this same Edge Function secret. If the secret is absent, the function returns a configuration error and no image analysis occurs.

The photo-analysis feature is not production-ready until the function is deployed, the secret is configured, and an authenticated end-to-end test succeeds.

## 7. Personalized profile and meal schema
Apply `migrations/202611220004_personalization_and_meals.sql` after the first three migrations. It adds profile measurements and preferences, dated daily targets (all days, weekdays, weekends), custom foods, custom recipes, meal plans, weight goal dates and weigh-in reminder preferences. It also grants owners update/delete access to their own weight entries under RLS.

The onboarding flow is shown automatically when a signed-in profile has not completed setup or has no daily-target records. The user can defer it; `onboarding_skipped_at` records that choice separately from `onboarding_completed_at`. Setup can be resumed under **Settings → Profil și obiective personale**. The first step stores height and weight in canonical cm/kg; the UI converts to/from decimal feet and pounds. Suggested calorie and water values are estimates, not medical recommendations, and are shown as proposed goals rather than measurements.

The meal journal supports date-based history, copying a meal or a complete previous day, and owner-only correction/deletion. Custom foods support editing, deletion and favorites. Custom recipes support per-serving nutrition calculation, editing and deletion. Migration 007 adds the owner-only `UPDATE` policy required by meal editing.

These code changes still require all seven migrations to be applied in the target Supabase project and authenticated end-to-end verification before production use. The remaining v2 requirements (weekly planner, notification delivery/snooze, 14-day progress suggestions, configurable dashboard, and complete preferences/offline/accessibility behavior) remain outside this implementation batch.
