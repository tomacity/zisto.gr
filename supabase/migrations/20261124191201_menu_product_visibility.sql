-- A missing flag keeps legacy products visible. Existing catalog rows need no rewrite.
alter table public.business_menu_catalogs
  add constraint business_menu_catalogs_product_hidden_boolean
  check (not jsonb_path_exists(
    catalog,
    'strict $.products[*] ? (exists(@.hidden)).hidden ? (@.type() != "boolean")',
    '{}'::jsonb,
    true
  )) not valid;

alter table public.business_menu_catalogs
  validate constraint business_menu_catalogs_product_hidden_boolean;
