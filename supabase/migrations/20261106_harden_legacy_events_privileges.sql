-- Harden legacy public.events access.
-- This table contains historical analytics events only (last activity July 2026)
-- and has no current application or database dependencies. Preserve the data,
-- but remove unnecessary client-role privileges.

revoke truncate, references, trigger
on table public.events
from anon, authenticated;
