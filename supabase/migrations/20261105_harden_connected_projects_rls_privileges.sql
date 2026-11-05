-- Harden public.connected_projects access.
-- Smart Link project access is handled server-side with service-role queries.
-- Client roles do not need direct table privileges.

revoke truncate, references, trigger
on table public.connected_projects
from anon, authenticated;
