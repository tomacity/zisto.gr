-- Zisto production-ready billing ledger
-- Keeps commercial billing history separate from fiscal issuance.
-- Fiscal documents can later be connected to an AADE-approved provider/timologio.

create table if not exists public.billing_issuer_profile (
  id smallint primary key default 1 check (id = 1),
  legal_name text,
  trade_name text default 'Zisto',
  tax_id text,
  tax_country text not null default 'GR',
  tax_office text,
  activity text,
  address_line1 text,
  address_line2 text,
  city text,
  region text,
  postal_code text,
  country_code text not null default 'GR',
  invoice_provider text not null default 'unconfigured'
    check (invoice_provider in ('unconfigured','aade_timologio','licensed_provider')),
  provider_account_id text,
  live_billing_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.billing_issuer_profile (id)
values (1)
on conflict (id) do nothing;


create table if not exists public.billing_profiles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  customer_type text not null default 'business'
    check (customer_type in ('business','individual')),
  legal_name text,
  trade_name text,
  tax_id text,
  tax_country text not null default 'GR',
  tax_office text,
  activity text,
  invoice_email text,
  address_line1 text,
  address_line2 text,
  city text,
  region text,
  postal_code text,
  country_code text not null default 'GR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billing_profiles_tax_id_idx
  on public.billing_profiles (tax_country, tax_id)
  where tax_id is not null;


create table if not exists public.billing_documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  document_type text not null default 'invoice'
    check (document_type in ('invoice','credit_note','receipt')),
  status text not null default 'draft'
    check (status in ('draft','open','paid','void','uncollectible','refunded')),
  source text not null default 'stripe'
    check (source in ('stripe','aade_timologio','licensed_provider','manual')),
  currency text not null default 'EUR',
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  vat_cents integer not null default 0 check (vat_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  document_number text,
  stripe_invoice_id text,
  stripe_payment_intent_id text,
  provider_name text,
  provider_document_id text,
  provider_mark text,
  provider_uid text,
  hosted_url text,
  pdf_url text,
  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.billing_documents
  add constraint billing_documents_stripe_invoice_unique
  unique (stripe_invoice_id);

create index if not exists billing_documents_business_date_idx
  on public.billing_documents (business_id, issued_at desc);

create index if not exists billing_documents_subscription_idx
  on public.billing_documents (subscription_id, created_at desc);

create index if not exists billing_documents_provider_mark_idx
  on public.billing_documents (provider_mark)
  where provider_mark is not null;


create table if not exists public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  billing_document_id uuid references public.billing_documents(id) on delete set null,
  provider text not null default 'stripe',
  external_payment_id text,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  amount_cents integer not null default 0 check (amount_cents >= 0),
  currency text not null default 'EUR',
  status text not null default 'pending'
    check (status in ('pending','succeeded','failed','refunded','partially_refunded')),
  failure_code text,
  failure_message text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.billing_payments
  add constraint billing_payments_provider_external_unique
  unique (provider, external_payment_id);

create index if not exists billing_payments_business_date_idx
  on public.billing_payments (business_id, created_at desc);


create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'stripe',
  external_event_id text not null,
  event_type text not null,
  object_id text,
  business_id uuid references public.businesses(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  status text not null default 'received'
    check (status in ('received','processed','ignored','failed')),
  payload_hash text,
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create unique index if not exists billing_events_provider_event_idx
  on public.billing_events (provider, external_event_id);

create index if not exists billing_events_status_idx
  on public.billing_events (status, received_at desc);


alter table public.billing_issuer_profile enable row level security;
alter table public.billing_profiles enable row level security;
alter table public.billing_documents enable row level security;
alter table public.billing_payments enable row level security;
alter table public.billing_events enable row level security;

grant select, insert, update, delete
  on public.billing_issuer_profile,
     public.billing_profiles,
     public.billing_documents,
     public.billing_payments,
     public.billing_events
  to service_role;

comment on table public.billing_issuer_profile is
  'Zisto legal/fiscal issuer identity. Populate only after the company/tax registration is ready.';

comment on table public.billing_profiles is
  'Invoice recipient details for each Zisto customer business.';

comment on table public.billing_documents is
  'Commercial billing document ledger. Fiscal provider identifiers such as MARK/UID are stored when available.';

comment on table public.billing_payments is
  'Payment attempt and settlement ledger, independent from the current subscription state.';

comment on table public.billing_events is
  'Idempotent billing/webhook event log. One row per external provider event.';
