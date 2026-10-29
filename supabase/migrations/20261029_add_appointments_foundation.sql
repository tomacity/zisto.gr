-- Zisto appointments foundation
create table if not exists public.appointment_services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  duration_minutes integer not null default 30 check (duration_minutes between 5 and 720),
  price_cents integer check (price_cents is null or price_cents >= 0),
  currency text not null default 'EUR',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists appointment_services_business_idx
  on public.appointment_services (business_id, is_active, sort_order);

create table if not exists public.appointment_staff (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists appointment_staff_business_idx
  on public.appointment_staff (business_id, is_active, sort_order);

create table if not exists public.appointment_availability (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  staff_id uuid references public.appointment_staff(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists appointment_availability_lookup_idx
  on public.appointment_availability (business_id, staff_id, weekday, is_active);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  public_token uuid not null default gen_random_uuid() unique,
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_id uuid references public.appointment_services(id) on delete set null,
  staff_id uuid references public.appointment_staff(id) on delete set null,
  customer_name text not null,
  customer_email text,
  customer_phone text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed'
    check (status in ('pending','confirmed','completed','cancelled','no_show')),
  source text not null default 'smart_link'
    check (source in ('smart_link','admin')),
  notes text,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists appointments_business_starts_idx
  on public.appointments (business_id, starts_at);

create index if not exists appointments_staff_starts_idx
  on public.appointments (staff_id, starts_at);

alter table public.appointment_services enable row level security;
alter table public.appointment_staff enable row level security;
alter table public.appointment_availability enable row level security;
alter table public.appointments enable row level security;

grant usage on schema public to service_role;

grant select, insert, update, delete
  on table public.appointment_services
  to service_role;

grant select, insert, update, delete
  on table public.appointment_staff
  to service_role;

grant select, insert, update, delete
  on table public.appointment_availability
  to service_role;

grant select, insert, update, delete
  on table public.appointments
  to service_role;

comment on table public.appointment_services is 'Bookable services configured per business.';
comment on table public.appointment_staff is 'Team members/resources who can receive appointments.';
comment on table public.appointment_availability is 'Weekly availability windows per business or staff member.';
comment on table public.appointments is 'Appointments booked from Smart Links or created from the dashboard.';
