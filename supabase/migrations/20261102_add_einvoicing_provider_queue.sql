-- Fiscal e-invoicing queue for an AADE-licensed provider.
-- Keeps Stripe payment data separate from the legally issued document.

alter table public.billing_issuer_profile
  add column if not exists address_number text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists website text,
  add column if not exists registry_number text,
  add column if not exists provider_series text not null default 'Z',
  add column if not exists live_billing_from timestamptz;

alter table public.billing_profiles
  add column if not exists address_number text,
  add column if not exists phone text;

alter table public.billing_documents
  add column if not exists fiscal_status text not null default 'not_requested'
    check (fiscal_status in ('not_requested','pending','issuing','issued','offline','failed','unknown')),
  add column if not exists provider_series text,
  add column if not exists provider_aa bigint,
  add column if not exists provider_attempts integer not null default 0,
  add column if not exists provider_last_attempt_at timestamptz,
  add column if not exists provider_last_error text;

create sequence if not exists public.billing_invoice_aa_seq
  as bigint
  start with 1
  increment by 1
  no minvalue
  no maxvalue
  cache 1;

create unique index if not exists billing_documents_provider_number_unique
  on public.billing_documents (provider_series, provider_aa)
  where provider_series is not null
    and provider_aa is not null;

create index if not exists billing_documents_fiscal_queue_idx
  on public.billing_documents (fiscal_status, paid_at)
  where status = 'paid';

create or replace function public.reserve_billing_invoice_number(
  p_document_id uuid,
  p_series text default 'Z'
)
returns table(series text, aa bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_series text;
  v_aa bigint;
begin
  select
    provider_series,
    provider_aa
  into
    v_series,
    v_aa
  from public.billing_documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'Billing document not found';
  end if;

  if v_aa is null then
    v_series := coalesce(nullif(trim(p_series), ''), 'Z');
    v_aa := nextval('public.billing_invoice_aa_seq');

    update public.billing_documents
    set
      provider_series = v_series,
      provider_aa = v_aa,
      fiscal_status = case
        when fiscal_status in ('not_requested','failed') then 'pending'
        else fiscal_status
      end,
      updated_at = now()
    where id = p_document_id;
  end if;

  return query
  select v_series, v_aa;
end;
$$;

revoke all on function public.reserve_billing_invoice_number(uuid, text)
  from public;

grant execute on function public.reserve_billing_invoice_number(uuid, text)
  to service_role;

comment on column public.billing_documents.fiscal_status is
  'State of legal e-invoice issuance, independent from Stripe payment status.';

comment on function public.reserve_billing_invoice_number(uuid, text) is
  'Atomically reserves one stable series/AA pair for a billing document so retries reuse the same legal number.';
