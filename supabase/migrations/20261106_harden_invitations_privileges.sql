-- Harden public.invitations access.
-- Invitation records contain email/business/user metadata and are managed only
-- through admin-authenticated server endpoints. Supabase Auth generates the
-- actual invitation/recovery links server-side.

revoke truncate, references, trigger
on table public.invitations
from anon, authenticated;
