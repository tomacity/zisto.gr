create table public.business_menu_catalogs (
 business_id uuid primary key references public.businesses(id) on delete cascade,
 catalog jsonb not null check(jsonb_typeof(catalog)='object'),
 revision integer not null default 1 check(revision>0),
 updated_at timestamptz not null default now()
);
alter table public.business_menu_catalogs enable row level security;
revoke all on public.business_menu_catalogs from public,anon,authenticated;
grant select,insert,update,delete on public.business_menu_catalogs to service_role;
comment on table public.business_menu_catalogs is 'Shared Smart Link catalog. Access exclusively through authenticated menu API; public API exposes active project menus only.';
