-- Service-only, atomic reset. Business configuration and identifiers remain intact.
create or replace function public.reset_business_activity(
  p_business_id uuid,
  p_confirm_slug text,
  p_actor_id uuid,
  p_cutoff timestamptz
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_slug text;
  v_analytics bigint;
  v_events bigint;
  v_appointments bigint;
begin
  if not exists (select 1 from public.zisto_admins where user_id = p_actor_id) then
    raise exception using errcode = '42501', message = 'Admin access required';
  end if;
  if p_cutoff is null or p_business_id is null then
    raise exception using errcode = '22023', message = 'Invalid reset parameters';
  end if;
  select slug into v_slug from public.businesses where id = p_business_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Business not found';
  end if;
  if p_confirm_slug is distinct from v_slug then
    raise exception using errcode = '22023', message = 'Confirmation slug does not match';
  end if;

  -- Prevent reminder scheduling from racing the final validation and deletion.
  perform id from public.appointments
    where business_id = p_business_id and created_at <= p_cutoff
    for update;
  if exists (
    select 1 from public.appointments
    where business_id = p_business_id and created_at <= p_cutoff
      and reminder_email_id is not null
      and (reminder_scheduled_for is null or reminder_scheduled_for > now())
  ) then
    raise exception using errcode = 'P0001', message = 'Pending appointment reminders';
  end if;

  delete from public.analytics_events where business_id = p_business_id and created_at <= p_cutoff;
  get diagnostics v_analytics = row_count;
  delete from public.events where business_id = p_business_id and created_at <= p_cutoff;
  get diagnostics v_events = row_count;
  delete from public.appointments where business_id = p_business_id and created_at <= p_cutoff;
  get diagnostics v_appointments = row_count;

  return jsonb_build_object(
    'business_id', p_business_id,
    'reset_at', p_cutoff,
    'deleted', jsonb_build_object(
      'analytics_events', v_analytics, 'events', v_events, 'appointments', v_appointments
    )
  );
end;
$$;
revoke all on function public.reset_business_activity(uuid, text, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.reset_business_activity(uuid, text, uuid, timestamptz) to service_role;
