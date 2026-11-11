-- Appointment reminders sent through Resend, scheduled 30 minutes ahead.
-- Kept server-side: client API access remains controlled by existing appointment RLS.
alter table public.appointments
  add column if not exists reminder_email_id text,
  add column if not exists reminder_scheduled_for timestamptz;

create index if not exists appointments_pending_reminders_idx
  on public.appointments (starts_at)
  where status = 'confirmed' and reminder_email_id is null;

comment on column public.appointments.reminder_email_id is
  'Resend scheduled email id used for cancellation and deduplication.';
comment on column public.appointments.reminder_scheduled_for is
  'UTC time when the scheduled reminder is due, 30 minutes before appointment.';
