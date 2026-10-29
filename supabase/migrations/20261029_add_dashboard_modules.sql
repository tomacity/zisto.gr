-- Zisto configurable dashboard modules
-- Existing businesses keep today's dashboard behavior by default.
alter table public.businesses
  add column if not exists dashboard_modules jsonb
  not null
  default '["analytics","reviews","menu","nfc"]'::jsonb;

alter table public.businesses
  drop constraint if exists businesses_dashboard_modules_is_array;

alter table public.businesses
  add constraint businesses_dashboard_modules_is_array
  check (jsonb_typeof(dashboard_modules) = 'array');

comment on column public.businesses.dashboard_modules is
  'Enabled client dashboard modules. Supported keys: analytics, reviews, menu, nfc, appointments.';
