-- Fix Business Center avatar Storage policies without exposing business_members.

create or replace function public.can_manage_business_avatar(
  target_business_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.user_id = auth.uid()
      and bm.business_id = target_business_id
      and bm.role in ('owner', 'manager')
  );
$$;

revoke all on function public.can_manage_business_avatar(uuid) from public;
grant execute on function public.can_manage_business_avatar(uuid) to authenticated;

drop policy if exists "business members can upload avatars"
  on storage.objects;

create policy "business members can upload avatars"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'business-avatars'
  and public.can_manage_business_avatar(
    ((storage.foldername(name))[1])::uuid
  )
);

drop policy if exists "business members can update avatars"
  on storage.objects;

create policy "business members can update avatars"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'business-avatars'
  and public.can_manage_business_avatar(
    ((storage.foldername(name))[1])::uuid
  )
)
with check (
  bucket_id = 'business-avatars'
  and public.can_manage_business_avatar(
    ((storage.foldername(name))[1])::uuid
  )
);

drop policy if exists "business members can delete avatars"
  on storage.objects;

create policy "business members can delete avatars"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'business-avatars'
  and public.can_manage_business_avatar(
    ((storage.foldername(name))[1])::uuid
  )
);
