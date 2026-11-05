-- Harden public.appointment_staff access.
-- Public booking only exposes non-sensitive staff fields server-side, while
-- staff contact details are returned only through authenticated dashboard flows
-- scoped to the user's business. Client roles do not need direct table access.

revoke truncate, references, trigger
on table public.appointment_staff
from anon, authenticated;
