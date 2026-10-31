-- Zisto subscriptions foundation
-- Stores the current custom commercial agreement for each business.
-- Stripe identifiers are nullable until Stripe Billing is connected.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  billing_email text,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'EUR',
  vat_rate numeric(5,2) not null default 24 check (vat_rate >= 0 and vat_rate <= 100),
  billing_interval_months integer not null default 1 check (billing_interval_months between 1 and 60),
  billing_status text not null default 'draft'
    check (billing_status in ('draft','active','past_due','cancelled')),
  access_status text not null default 'active'
    check (access_status in ('active','grace_period','suspended')),
  starts_at timestamptz not null default now(),
  next_billing_at timestamptz,
  payment_due_at timestamptz,
  grace_until timestamptz,
  last_paid_at timestamptz,
  notes text,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_billing_status_idx
  on public.subscriptions (billing_status, next_billing_at);

create index if not exists subscriptions_access_status_idx
  on public.subscriptions (access_status, grace_until);

create unique index if not exists subscriptions_stripe_subscription_idx
  on public.subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

alter table public.subscriptions enable row level security;

grant usage on schema public to service_role;

grant select, insert, update, delete
  on table public.subscriptions
  to service_role;

comment on table public.subscriptions is
  'Current custom Zisto subscription agreement and billing/access state per business.';
