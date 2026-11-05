-- Harden public.appointment_services access.
-- Appointment services are consumed and managed through server-side appointment
-- flows with explicit business scoping. Client roles do not need direct access.

revoke truncate, references, trigger
on table public.appointment_services
from anon, authenticated;
