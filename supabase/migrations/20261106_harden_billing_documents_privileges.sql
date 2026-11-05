-- Harden public.billing_documents access.
-- Billing documents contain invoice identifiers, hosted/PDF URLs and fiscal
-- provider metadata. Reads/writes are handled server-side by admin, Stripe
-- webhook and e-invoicing flows. Client roles do not need direct privileges.

revoke truncate, references, trigger
on table public.billing_documents
from anon, authenticated;
