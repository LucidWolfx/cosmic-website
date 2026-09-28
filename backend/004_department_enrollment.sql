-- Apply after 003. Department approval creates a verified, linked roster entry.
begin;
alter table public.cosmic_applications add column department_id text references public.cosmic_departments(id);
alter table public.cosmic_department_roster
  add column user_id uuid references auth.users(id) on delete set null,
  add column discord_id text check(discord_id ~ '^[0-9]{17,20}$'),
  add column discord_name text,
  add column application_id uuid references public.cosmic_applications(id) on delete set null,
  add column approved_by_discord text,
  add column archive_reason text,
  add column membership_checked_at timestamptz,
  add column next_membership_check timestamptz not null default now(),
  add column check_lease uuid,
  add column check_lease_until timestamptz,
  add constraint cosmic_roster_department_discord unique(department_id,discord_id);
create index cosmic_roster_membership_due on public.cosmic_department_roster(next_membership_check) where not archived and discord_id is not null;

create function public.cosmic_department_application_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.kind='department' then
    new.department_id:=nullif(new.answers->>'department','');
    if new.status in ('submitted','under_review','approved') and not exists(
      select 1 from public.cosmic_departments where id=new.department_id and enabled
    ) then raise exception 'Select an available department before submitting.'; end if;
    if new.status='approved' and (tg_op='INSERT' or old.status is distinct from 'approved') and not exists(
      select 1 from public.cosmic_department_roster where application_id=new.id and user_id=new.user_id and not archived
    ) then raise exception 'Department approval requires character, call sign and rank details. Use the department approval form.'; end if;
  else new.department_id:=null; end if;
  return new;
end;$$;
create trigger cosmic_department_application_guard before insert or update on public.cosmic_applications
for each row execute function public.cosmic_department_application_guard();

create function public.cosmic_department_approval_context(p_id uuid,p_user uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a public.cosmic_applications; d public.cosmic_departments;
begin
  if p_user is not null and not exists(select 1 from public.cosmic_access where user_id=p_user and role in ('staff','admin') and not suspended) then
    raise exception 'Staff review access is required.' using errcode='42501';
  end if;
  select * into a from public.cosmic_applications where id=p_id and kind='department';
  if not found then raise exception 'Department application not found.'; end if;
  if a.user_id=p_user then raise exception 'You cannot review your own application.' using errcode='42501'; end if;
  select * into d from public.cosmic_departments where id=a.department_id and enabled;
  if not found then raise exception 'The applicant must select an available department and resubmit.'; end if;
  return jsonb_build_object('department_id',d.id,'viewer_roles',d.viewer_roles,'editor_roles',d.editor_roles,
    'discord_id',public.cosmic_department_identity(a.user_id),'status',a.status);
end;$$;

create function public.cosmic_approve_department_application(
  p_id uuid,p_reviewer text,p_roles text[],p_member_id text,p_member_name text,p_roster jsonb,p_feedback text,
  p_portal_user uuid default null,p_revision integer default null,p_interaction text default null,
  p_channel text default null,p_message text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.cosmic_applications; d public.cosmic_departments; member_id text; reviewer_id uuid;
  r public.cosmic_department_roster; previous jsonb; result jsonb;
begin
  if p_reviewer is null or p_reviewer !~ '^[0-9]{17,20}$' then raise exception 'Invalid reviewer identity.'; end if;
  select * into a from public.cosmic_applications where id=p_id for update;
  if not found or a.kind<>'department' then raise exception 'Department application not found.'; end if;
  select * into d from public.cosmic_departments where id=a.department_id and enabled;
  if not found or not coalesce(d.viewer_roles && p_roles,false) or not coalesce(d.editor_roles && p_roles,false) then
    raise exception 'The department access and command roles are required to approve its roster.' using errcode='42501';
  end if;
  member_id:=public.cosmic_department_identity(a.user_id);
  if member_id is distinct from p_member_id then raise exception 'Applicant Discord membership must be verified.' using errcode='42501'; end if;
  if member_id=p_reviewer then raise exception 'You cannot review your own application.' using errcode='42501'; end if;
  select user_id into reviewer_id from auth.identities where provider='discord' and provider_id=p_reviewer limit 1;
  if exists(select 1 from public.cosmic_access where user_id=reviewer_id and suspended) then raise exception 'Your portal account is suspended.' using errcode='42501'; end if;
  if p_portal_user is not null then
    if reviewer_id is distinct from p_portal_user or not exists(select 1 from public.cosmic_access where user_id=p_portal_user and role in ('staff','admin') and not suspended) then
      raise exception 'Staff review access is required.' using errcode='42501';
    end if;
  elsif p_interaction is null then raise exception 'A verified review context is required.' using errcode='42501'; end if;
  if p_interaction is not null and exists(select 1 from public.cosmic_discord_decisions where interaction_id=p_interaction) then
    return public.cosmic_discord_review_application(p_id,p_revision,p_interaction,p_reviewer,p_channel,p_message,'approved',p_feedback);
  end if;
  if a.status not in ('submitted','under_review') then raise exception 'This application is no longer awaiting review.'; end if;
  if p_feedback is null or char_length(p_feedback)>4000 then raise exception 'Invalid feedback.'; end if;
  if jsonb_typeof(p_roster) is distinct from 'object' or char_length(btrim(coalesce(p_roster->>'name',''))) not between 2 and 80
    or char_length(btrim(coalesce(p_roster->>'callsign',''))) not between 1 and 24
    or char_length(btrim(coalesce(p_roster->>'rank',''))) not between 1 and 60
    or char_length(coalesce(p_roster->>'division',''))>80
    or coalesce(p_roster->>'status','training') not in ('active','training','reserve','leave') then
    raise exception 'Enter a character name, call sign and rank within the field limits.';
  end if;
  select * into r from public.cosmic_department_roster where department_id=d.id and discord_id=member_id for update;
  if found then
    if not r.archived then raise exception 'This Discord member is already on the department roster. Edit their existing entry.'; end if;
    previous:=to_jsonb(r);
  end if;
  insert into public.cosmic_department_roster(department_id,name,rank,callsign,division,status,user_id,discord_id,discord_name,application_id,approved_by_discord,updated_by,membership_checked_at)
  values(d.id,btrim(p_roster->>'name'),btrim(p_roster->>'rank'),btrim(p_roster->>'callsign'),btrim(coalesce(p_roster->>'division','')),
    coalesce(p_roster->>'status','training'),a.user_id,member_id,left(p_member_name,100),a.id,p_reviewer,reviewer_id,now())
  on conflict(department_id,discord_id) do update set name=excluded.name,rank=excluded.rank,callsign=excluded.callsign,
    division=excluded.division,status=excluded.status,user_id=excluded.user_id,discord_name=excluded.discord_name,
    application_id=excluded.application_id,approved_by_discord=excluded.approved_by_discord,updated_by=excluded.updated_by,
    archived=false,archive_reason=null,revision=public.cosmic_department_roster.revision+1,updated_at=now(),
    membership_checked_at=now(),next_membership_check=now(),check_lease=null,check_lease_until=null
  returning * into r;
  if p_portal_user is not null then
    update public.cosmic_applications set status='approved',feedback=btrim(p_feedback),reviewed_by=reviewer_id,
      reviewed_by_discord=p_reviewer,reviewed_at=now(),updated_at=now() where id=p_id;
    insert into public.cosmic_application_events(application_id,actor_id,actor_discord_id,action) values(p_id,reviewer_id,p_reviewer,'approved');
    result:=jsonb_build_object('status','approved','already_recorded',false);
  else
    result:=public.cosmic_discord_review_application(p_id,p_revision,p_interaction,p_reviewer,p_channel,p_message,'approved',p_feedback);
  end if;
  insert into public.cosmic_department_audit(department_id,actor_id,action,record_id,before_value,after_value)
    values(d.id,reviewer_id,'application_approved',r.id,previous,to_jsonb(r));
  return result||jsonb_build_object('roster_id',r.id);
end;$$;

-- Preserve existing notice logic and checked edits; block new unlinked employees.
alter function public.cosmic_department_request(uuid,text[],text,text,jsonb) rename to cosmic_department_request_v1;
revoke all on function public.cosmic_department_request_v1(uuid,text[],text,text,jsonb) from public,anon,authenticated,service_role;
create function public.cosmic_department_request(p_user uuid,p_roles text[],p_action text,p_department text default null,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if p_action='roster_save' and p_payload->>'id' is null then raise exception 'New employees are added when a department application is approved.'; end if;
  if p_action='roster_archive' and p_payload->>'archived'='false' and exists(
    select 1 from public.cosmic_department_roster where id=(p_payload->>'id')::uuid and department_id=p_department and archive_reason='discord_left'
  ) then raise exception 'This member left Discord. A new department approval is required before restoring their roster entry.'; end if;
  result:=public.cosmic_department_request_v1(p_user,p_roles,p_action,p_department,p_payload);
  if p_action='read' then
    result:=jsonb_set(result,'{roster}',coalesce((select jsonb_agg(item||jsonb_build_object('discord_id',r.discord_id,'discord_name',r.discord_name,
      'archive_reason',r.archive_reason) order by pos) from jsonb_array_elements(result->'roster') with ordinality x(item,pos)
      join public.cosmic_department_roster r on r.id=(item->>'id')::uuid and r.department_id=p_department),'[]'::jsonb));
  end if;
  return result;
end;$$;

create function public.cosmic_claim_roster_membership_check() returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.cosmic_department_roster;
begin
  select * into r from public.cosmic_department_roster where not archived and discord_id is not null
    and next_membership_check<=now() and (check_lease_until is null or check_lease_until<now())
    order by next_membership_check,id for update skip locked limit 1;
  if not found then return null; end if;
  update public.cosmic_department_roster set check_lease=gen_random_uuid(),check_lease_until=now()+interval '2 minutes' where id=r.id returning * into r;
  return jsonb_build_object('id',r.id,'discord_id',r.discord_id,'lease',r.check_lease);
end;$$;

create function public.cosmic_finish_roster_membership_check(p_id uuid,p_lease uuid,p_discord text,p_outcome text,p_name text default null,p_retry_seconds integer default 120)
returns boolean language plpgsql security definer set search_path='' as $$
declare r public.cosmic_department_roster; previous jsonb;
begin
  if p_outcome not in ('present','left','retry') then raise exception 'Invalid membership result.'; end if;
  select * into r from public.cosmic_department_roster where id=p_id and check_lease=p_lease and discord_id=p_discord and not archived for update;
  if not found then return false; end if;
  previous:=to_jsonb(r);
  update public.cosmic_department_roster set check_lease=null,check_lease_until=null,
    next_membership_check=now()+make_interval(secs=>greatest(60,least(3600,coalesce(p_retry_seconds,120)))),
    membership_checked_at=case when p_outcome in ('present','left') then now() else membership_checked_at end,
    discord_name=case when p_outcome='present' then left(p_name,100) else discord_name end,
    archived=case when p_outcome='left' then true else archived end,
    archive_reason=case when p_outcome='left' then 'discord_left' else archive_reason end,
    revision=case when p_outcome='left' then revision+1 else revision end,
    updated_at=case when p_outcome='left' then now() else updated_at end,
    updated_by=case when p_outcome='left' then null else updated_by end
    where id=r.id returning * into r;
  if p_outcome='left' then
    insert into public.cosmic_department_audit(department_id,action,record_id,before_value,after_value)
      values(r.department_id,'discord_departure',r.id,previous,to_jsonb(r));
  end if;
  return true;
end;$$;

revoke all on function public.cosmic_department_application_guard(),public.cosmic_department_approval_context(uuid,uuid),
  public.cosmic_approve_department_application(uuid,text,text[],text,text,jsonb,text,uuid,integer,text,text,text),
  public.cosmic_department_request(uuid,text[],text,text,jsonb),public.cosmic_claim_roster_membership_check(),
  public.cosmic_finish_roster_membership_check(uuid,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.cosmic_department_approval_context(uuid,uuid),
  public.cosmic_approve_department_application(uuid,text,text[],text,text,jsonb,text,uuid,integer,text,text,text),
  public.cosmic_department_request(uuid,text[],text,text,jsonb),public.cosmic_claim_roster_membership_check(),
  public.cosmic_finish_roster_membership_check(uuid,uuid,text,text,text,integer) to service_role;
update public.cosmic_discord_reviews q set version=version+1,next_attempt_at=now()
  from public.cosmic_applications a where a.id=q.application_id and a.kind='department' and a.status in ('submitted','under_review');
commit;
