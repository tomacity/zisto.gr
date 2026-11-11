-- Harden public.appointment_availability access.
-- Availability is consumed and managed only through server-side appointment
-- flows with explicit business scoping. Client roles do not need direct access.

revoke truncate, references, trigger
on table public.appointment_availability
from anon, authenticated;
