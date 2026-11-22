-- HealthyLife v2.0.0: persist onboarding deferral separately from completion.
-- This migration adds metadata only; it does not modify or delete user measurements.
alter table public.profiles
  add column if not exists onboarding_skipped_at timestamptz;

comment on column public.profiles.onboarding_skipped_at is
  'When the user deferred the initial profile setup. Does not imply completion.';
