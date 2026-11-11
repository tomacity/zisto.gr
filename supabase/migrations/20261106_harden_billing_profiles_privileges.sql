-- Harden public.billing_profiles.
-- Billing recipient data contains tax/contact/address information and is
-- intentionally accessed only by trusted server-side service-role flows.

revoke truncate, references, trigger
on table public.billing_profiles
from anon, authenticated;
