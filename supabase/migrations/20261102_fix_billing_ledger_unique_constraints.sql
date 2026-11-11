-- Fix billing ledger uniqueness for PostgREST/Supabase upserts.
-- PostgreSQL unique constraints allow multiple NULL values, so partial
-- indexes are not needed here and cannot be targeted by on_conflict.

drop index if exists public.billing_documents_stripe_invoice_idx;
drop index if exists public.billing_payments_provider_external_idx;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'billing_documents_stripe_invoice_unique'
      and conrelid = 'public.billing_documents'::regclass
  ) then
    alter table public.billing_documents
      add constraint billing_documents_stripe_invoice_unique
      unique (stripe_invoice_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'billing_payments_provider_external_unique'
      and conrelid = 'public.billing_payments'::regclass
  ) then
    alter table public.billing_payments
      add constraint billing_payments_provider_external_unique
      unique (provider, external_payment_id);
  end if;
end
$$;
