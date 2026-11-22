# HealthyLife AI — Architecture

## Demo
- React + TypeScript + Vite static frontend.
- GitHub Actions builds the site and deploys `dist/` to GitHub Pages.
- UI data is illustrative and held in component state only.
- No real authentication, backend, database, push delivery or AI calls are present.

## Production target
- Authentication provider with verified email/session handling.
- PostgreSQL with row-level security on every user-owned table.
- Server-side API or serverless functions for privileged operations.
- Server-side Web Push subscription storage and delivery.
- AI provider adapter; credentials stored only as server-side secrets.
- Audit logging that excludes sensitive health payloads.
- Data export/deletion workflows and GDPR review.

## AI Free Forever integration gate
Before integration, verify official API documentation, endpoint, authentication, rate limits, permitted use, retention, subprocessors and health-data handling. Do not reverse-engineer the website UI or reuse browser session tokens. If there is no documented and authorized API, leave AI disabled or use a separately approved provider.

## Health-data safety
This public demo is not suitable for real medication, diagnosis, treatment, weight or other health data. Production requires a privacy and security review, an appropriate legal basis for special-category data, and an assessment of whether a DPIA is required.
