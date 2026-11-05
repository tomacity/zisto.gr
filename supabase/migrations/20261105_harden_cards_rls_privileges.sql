-- Harden public.cards access.
-- Cards are accessed through authenticated server endpoints and public tracking
-- resolves card tokens server-side. Client roles do not need direct table
-- privileges; RLS policies remain as defense in depth.

revoke truncate, references, trigger
on table public.cards
from anon, authenticated;
