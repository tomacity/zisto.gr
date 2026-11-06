-- Align invitations.role with the application role model.
-- The invite API already supports manager and business_members accepts it.

alter table public.invitations
  drop constraint invitations_role_check;

alter table public.invitations
  add constraint invitations_role_check
  check (
    role = any (
      array[
        'owner'::text,
        'manager'::text,
        'member'::text,
        'staff'::text
      ]
    )
  );
