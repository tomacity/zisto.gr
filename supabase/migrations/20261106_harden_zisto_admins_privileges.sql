-- Harden public.zisto_admins access.
-- This table is the central application admin authorization registry.
-- Application code only reads it server-side; service_role has SELECT only.
-- Admin membership changes therefore remain outside normal app flows.

revoke truncate, references, trigger
on table public.zisto_admins
from anon, authenticated;
