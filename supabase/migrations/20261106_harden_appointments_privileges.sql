-- Harden public.appointments access.
-- Appointment booking, public token management and dashboard access are all
-- mediated by server endpoints using privileged credentials and explicit
-- business/token scoping. Client roles do not need direct table privileges.

revoke truncate, references, trigger
on table public.appointments
from anon, authenticated;
