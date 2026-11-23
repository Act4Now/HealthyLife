# HealthyLife

HealthyLife is a bilingual (Romanian / English) wellness companion. Version **1.0.2** includes authentication, profiles, meal logging, hydration tracking, medication schedules and weight tracking.

## Version control
- Current development version: `1.0.2`
- Phase branch: `release/1.0.2-phase-2`
- Baseline label: `1.0.1` (the previous source commit is documented in `CHANGELOG.md`; it was not a published Git tag)
- Every release candidate is built and checked by GitHub Actions before promotion to `main`.

See [CHANGELOG.md](./CHANGELOG.md) and [version.json](./version.json).

## Stack
- React + TypeScript + Vite
- Supabase Auth (email/password) when configured
- Supabase PostgreSQL profile table with Row Level Security
- GitHub Actions for CI and GitHub Pages deployment

## Release 2.1.0
See `CHANGELOG.md`. After deploying, run `supabase/verify.sql` in Supabase → SQL Editor to confirm the database matches the app. The service worker caches only the app shell (never Supabase or personal data), so the app opens offline but cannot load or save data without a connection.

## Phase 2 setup
See [Supabase setup instructions](./supabase/README.md).

1. Create a Supabase project.
2. Run `supabase/migrations/202611220001_profiles.sql` in **Supabase → SQL Editor**.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in local `.env.local`.
4. Add the same public project settings as GitHub Actions repository secrets for the Pages build.
5. Configure Supabase **Authentication → URL Configuration** for `https://act4now.github.io/HealthyLife/`.

Never expose a Supabase `service_role` key, database password, or privileged token in browser code or GitHub Pages.

## Local development
Requires Node.js 20+ and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Validation
```bash
npm run typecheck
npm run build
npm run preview
```

## Hosting and limitations
GitHub Pages serves only the static frontend. Supabase supplies authentication and PostgreSQL. The current implementation includes Supabase-backed meal, hydration, medication and weight records with owner-scoped Row Level Security. Automated push notifications, complete export/deletion workflows and a full privacy/security review remain outstanding. Transient food-photo analysis is implemented behind a Supabase Edge Function but requires deployment and a Gemini API key; images are not saved by HealthyLife. See `supabase/README.md` for setup and third-party data-handling details. Do not enter sensitive real health data until these safeguards and the applicable legal review are complete.

AI Free Forever integration remains disabled pending verification of an official, authorized API and its data-handling terms.
