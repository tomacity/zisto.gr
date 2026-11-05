-- Harden public.billing_issuer_profile access.
-- This table stores Zisto issuer/fiscal configuration. Provider credentials
-- remain in server environment variables and the table is consumed server-side.

revoke truncate, references, trigger
on table public.billing_issuer_profile
from anon, authenticated;
