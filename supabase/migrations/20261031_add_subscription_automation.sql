-- Zisto subscription automation state
-- Tracks one-time overdue/suspension notifications so the daily billing job is idempotent.

alter table public.subscriptions
  add column if not exists overdue_email_sent_at timestamptz,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspension_email_sent_at timestamptz;

comment on column public.subscriptions.overdue_email_sent_at is
  'When the first late-payment reminder was successfully sent.';

comment on column public.subscriptions.suspended_at is
  'When access was automatically suspended after the grace period.';

comment on column public.subscriptions.suspension_email_sent_at is
  'When the suspension notice was successfully sent.';
