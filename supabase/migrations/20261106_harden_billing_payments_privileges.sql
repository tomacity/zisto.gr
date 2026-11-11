-- Harden public.billing_payments access.
-- Payment ledger writes are performed server-side by the verified Stripe
-- webhook using privileged credentials. Client roles do not need direct access.

revoke truncate, references, trigger
on table public.billing_payments
from anon, authenticated;
