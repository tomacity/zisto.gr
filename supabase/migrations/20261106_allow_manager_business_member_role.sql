-- Align the business_members role constraint with the application role model.
-- The invitation API and authorization helpers already support manager.

alter table public.business_members
  drop constraint business_members_role_check;

alter table public.business_members
  add constraint business_members_role_check
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
