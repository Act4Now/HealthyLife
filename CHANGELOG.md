# Changelog

## 2.1.0 — Dashboard, targets and offline shell
- Dashboard: new "Today" overview with calories and macros against daily targets, meals, water (quick +150/250/500 ml) and weight, plus an in-app weigh-in reminder. Widgets can be shown, hidden and reordered in Settings.
- Targets: the water goal is now one value (onboarding writes the Hydration goal too); accepting or editing a progress suggestion updates the target from today, without rewriting history; a new weight-trend calorie suggestion was added.
- Voice assistant: fixed regular-expression typos so quantities ("two glasses", "500 ml") and spoken hours are understood; English number words; bilingual reminder labels; expired medication courses no longer appear.
- Meals: "Recent and frequent" one-tap shortcuts built from the last 30 days.
- Planner: custom meal slots with times; opt-out of push notifications on this device.
- Weight: lb/kg now applied throughout, plus an on-track / behind indicator toward the goal date.
- Settings: saved theme, text size and language are re-applied when the app loads; the header language button is saved.
- PWA: app icons and a cached offline app shell (data still requires a connection; an offline banner is shown).
- Database: `202611240001_release_2_1_0.sql` (indexes, hydration-goal backfill, hardening of anon grants and `handle_new_user`) and `supabase/verify.sql` (read-only checks).
- `send-push` CORS is restricted to the app origin (set `APP_ORIGIN` to override).

## 1.0.2 — Phase 2 (release candidate)
- Add Supabase Auth client configuration through Vite environment variables.
- Add email/password sign-in and sign-up UI.
- Add profile bootstrap and owner-scoped PostgreSQL schema with Row Level Security.
- Keep GitHub Pages deployment free of privileged secrets.
- Add CI checks for pull requests and versioned release workflow.

## 1.0.1 — Baseline
- Existing HealthyLife AI React/Vite demo and GitHub Pages deployment.
- Baseline source commit: `b4a42ab8ca7ffbdbb7c3886cb00f512693ac6e10`.
- The prior package metadata reported `0.1.0`; 1.0.1 is the project release baseline label requested for controlled testing, not a previously published Git tag.
