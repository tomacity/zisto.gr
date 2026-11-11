-- Harden public.businesses access.
-- Client roles currently use the server API, so they do not need direct
-- table privileges. RLS policies remain in place as defense in depth.

revoke truncate, references, trigger
on table public.businesses
from anon, authenticated;
