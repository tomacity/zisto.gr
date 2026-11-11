-- Allow Zisto admins to manage Business Center avatars while preserving member checks.

create or replace function public.can_manage_business_avatar(
  target_business_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    exists (
      select 1
      from public.zisto_admins za
      where za.user_id = auth.uid()
    )
    or
    exists (
      select 1
      from public.business_members bm
      where bm.user_id = auth.uid()
        and bm.business_id = target_business_id
        and bm.role in ('owner', 'manager')
    );
$$;

revoke all on function public.can_manage_business_avatar(uuid) from public;
grant execute on function public.can_manage_business_avatar(uuid) to authenticated;
