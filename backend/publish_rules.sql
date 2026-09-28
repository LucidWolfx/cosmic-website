-- Run in the privileged dashboard AFTER publishing and verifying the matching rulebook.
-- This records rule approval without opening either kind of application intake.
begin;
do $$
begin
  perform 1 from public.cosmic_settings where id=true for update;
  if not found then raise exception 'Cosmic settings were not found.'; end if;
  if exists(select 1 from public.cosmic_settings where id=true and (whitelist_open or requests_open)) then
    raise exception 'Intake changed. Review the current settings before applying this publication.';
  end if;
  if exists(select 1 from public.cosmic_settings where id=true and rules_version not in ('draft','cosmic-rules-1.0-2026-09-28')) then
    raise exception 'A different rulebook version is recorded. Review it before replacing it.';
  end if;
  update public.cosmic_settings set rules_approved=true,rules_version='cosmic-rules-1.0-2026-09-28' where id=true;
end;$$;
commit;
select rules_approved,rules_version,whitelist_open,requests_open from public.cosmic_settings where id=true;
