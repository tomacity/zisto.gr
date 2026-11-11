-- Harden public.billing_events access.
-- Billing events form an internal Stripe webhook audit/idempotency log.
-- Writes happen only after Stripe signature verification and reads are
-- exposed only through the admin-only server endpoint.

revoke truncate, references, trigger
on table public.billing_events
from anon, authenticated;
