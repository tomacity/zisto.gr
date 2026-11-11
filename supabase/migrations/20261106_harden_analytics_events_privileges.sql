-- Harden public.analytics_events access.
-- Smart Link analytics are recorded and read through server endpoints using
-- privileged credentials. Client roles do not need direct table privileges.

revoke truncate, references, trigger
on table public.analytics_events
from anon, authenticated;
