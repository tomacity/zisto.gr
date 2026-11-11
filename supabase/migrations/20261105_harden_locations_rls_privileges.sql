-- Harden public.locations access.
-- Location provisioning currently runs server-side with the service role.
-- Keep RLS policies as defense in depth, but remove table capabilities
-- that client roles do not need and that RLS does not protect (TRUNCATE).

revoke truncate, references, trigger
on table public.locations
from anon, authenticated;
