-- Owner authorized opening whitelist and member-request applications on 28 September 2026.
-- Run in the privileged dashboard. This is an owner operation, not a schema migration.
begin;
do $$
begin
  perform 1 from public.cosmic_settings where id=true for update;
  if not found then raise exception 'Cosmic settings were not found.'; end if;
  if not exists(select 1 from public.cosmic_settings where id=true and rules_approved=true and rules_version='cosmic-rules-1.0-2026-09-28') then
    raise exception 'The published Cosmic rulebook version must be approved before opening applications.';
  end if;
  update public.cosmic_settings set whitelist_open=true,requests_open=true where id=true;
end;$$;
commit;
select whitelist_open,requests_open,rules_approved,rules_version from public.cosmic_settings where id=true;
