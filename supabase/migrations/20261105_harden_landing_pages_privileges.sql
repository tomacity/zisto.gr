-- Harden public.landing_pages access.
-- This table is intentionally server-only today. RLS is enabled and no client
-- CRUD privileges are granted; provisioning and card flows use server-side
-- service-role access.

revoke truncate, references, trigger
on table public.landing_pages
from anon, authenticated;
