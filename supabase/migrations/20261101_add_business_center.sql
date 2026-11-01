-- Business Center: profile image + subscription renewal controls

alter table public.businesses
  add column if not exists profile_image_url text;

alter table public.subscriptions
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists cancellation_requested_at timestamptz;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'business-avatars',
  'business-avatars',
  true,
  5242880,
  array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on column public.businesses.profile_image_url is
  'Public avatar/logo URL shown in the client dashboard Business Center.';

comment on column public.subscriptions.cancel_at_period_end is
  'Whether the Stripe subscription is scheduled to stop renewing at the end of the current paid period.';

comment on column public.subscriptions.cancellation_requested_at is
  'When the customer requested cancellation of automatic renewal.';


drop policy if exists "business members can upload avatars"
  on storage.objects;
create policy "business members can upload avatars"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'business-avatars'
  and exists (
    select 1
    from public.business_members bm
    where bm.user_id = auth.uid()
      and bm.business_id::text =
        (storage.foldername(name))[1]
      and bm.role in ('owner','manager')
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
  and exists (
    select 1
    from public.business_members bm
    where bm.user_id = auth.uid()
      and bm.business_id::text =
        (storage.foldername(name))[1]
      and bm.role in ('owner','manager')
  )
)
with check (
  bucket_id = 'business-avatars'
  and exists (
    select 1
    from public.business_members bm
    where bm.user_id = auth.uid()
      and bm.business_id::text =
        (storage.foldername(name))[1]
      and bm.role in ('owner','manager')
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
  and exists (
    select 1
    from public.business_members bm
    where bm.user_id = auth.uid()
      and bm.business_id::text =
        (storage.foldername(name))[1]
      and bm.role in ('owner','manager')
  )
);
