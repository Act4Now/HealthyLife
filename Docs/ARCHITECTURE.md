# HealthyLife AI — Architecture

## Version 1.0.2 — Phase 2
- Static frontend: React + TypeScript + Vite on GitHub Pages.
- Authentication: Supabase Auth email/password.
- Profile store: Supabase PostgreSQL `public.profiles`.
- Row Level Security restricts profile reads and updates to `auth.uid() = profiles.id`.
- A database trigger creates a profile row after Auth user creation.
- Browser uses only Supabase URL and anon/publishable key. Never ship the service-role key.

## Deployment boundaries
GitHub Pages is a static host and cannot keep server secrets or run a private backend. Supabase provides managed Auth and Postgres. Privileged operations must be implemented in trusted server-side functions, not in the browser.

## Phase 2 limitations
- Requires a Supabase project, migration application, Auth URL configuration and public frontend env values.
- Until those steps are complete, the UI remains in demo mode.
- This release does not yet persist medication schedules, hydration logs, meal plans, weight entries or history.
- No push notification delivery or AI provider calls are enabled.

## AI Free Forever integration gate
Before integration, verify official API documentation, endpoint, authentication, rate limits, permitted use, retention, subprocessors and health-data handling. Do not reverse-engineer the website UI or reuse browser session tokens. If there is no documented and authorized API, leave AI disabled or use a separately approved provider.

## Health-data safety
This public demo is not suitable for real medication, diagnosis, treatment, weight or other health data. Production requires a privacy and security review, an appropriate legal basis for special-category data, and an assessment of whether a DPIA is required.
