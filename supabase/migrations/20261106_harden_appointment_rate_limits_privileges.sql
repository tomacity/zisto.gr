-- Harden public.appointment_rate_limits access.
-- The rate-limit table is only used through the server-side
-- check_appointment_rate_limit() RPC. That SECURITY DEFINER RPC is executable
-- by service_role only; anon/authenticated cannot call it directly.

revoke truncate, references, trigger
on table public.appointment_rate_limits
from anon, authenticated;
