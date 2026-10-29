-- Zisto appointment production hardening
-- Prevent double bookings at the database layer and add persistent public-booking throttling.

create extension if not exists btree_gist;

alter table public.appointments
  drop constraint if exists appointments_no_overlapping_active_slots;

alter table public.appointments
  add constraint appointments_no_overlapping_active_slots
  exclude using gist (
    business_id with =,
    (coalesce(staff_id, '00000000-0000-0000-0000-000000000000'::uuid)) with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status <> 'cancelled');

create table if not exists public.appointment_rate_limits (
  rate_key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.appointment_rate_limits enable row level security;

grant select, insert, update, delete
  on table public.appointment_rate_limits
  to service_role;

create or replace function public.check_appointment_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.appointment_rate_limits%rowtype;
  now_value timestamptz := now();
begin
  if p_key is null or length(trim(p_key)) = 0 then
    return false;
  end if;

  if p_limit < 1 or p_window_seconds < 1 then
    return false;
  end if;

  insert into public.appointment_rate_limits (
    rate_key,
    window_started_at,
    request_count,
    updated_at
  )
  values (
    p_key,
    now_value,
    1,
    now_value
  )
  on conflict (rate_key)
  do update
  set
    window_started_at =
      case
        when appointment_rate_limits.window_started_at
          <= now_value - make_interval(secs => p_window_seconds)
          then now_value
        else appointment_rate_limits.window_started_at
      end,
    request_count =
      case
        when appointment_rate_limits.window_started_at
          <= now_value - make_interval(secs => p_window_seconds)
          then 1
        else appointment_rate_limits.request_count + 1
      end,
    updated_at = now_value
  returning * into current_row;

  -- Opportunistic cleanup so the table cannot grow forever.
  delete from public.appointment_rate_limits
  where updated_at < now_value - interval '2 days';

  return current_row.request_count <= p_limit;
end;
$$;

revoke all on function public.check_appointment_rate_limit(text, integer, integer)
  from public;

grant execute on function public.check_appointment_rate_limit(text, integer, integer)
  to service_role;

comment on constraint appointments_no_overlapping_active_slots
  on public.appointments is
  'Guarantees that active appointments for the same business/staff resource cannot overlap.';

comment on table public.appointment_rate_limits is
  'Server-only counters used to throttle anonymous Smart Link booking attempts.';
