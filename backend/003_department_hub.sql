-- Department content is served only after a fresh Discord membership check.
-- Browser roles have no table or RPC access, including website staff/admin.
begin;

create table public.cosmic_departments (
  id text primary key check(id ~ '^[a-z0-9-]{1,40}$'),
  name text not null check(char_length(name) between 1 and 100),
  viewer_roles text[] not null default '{}',
  editor_roles text[] not null default '{}',
  enabled boolean not null default false
);
insert into public.cosmic_departments(id,name,viewer_roles,editor_roles,enabled)
values('lspd','Los Santos Police Department',array['1449442096955002982'],array['1449494268329852938'],true);

create table public.cosmic_department_notices (
  id uuid primary key default gen_random_uuid(),
  department_id text not null references public.cosmic_departments(id),
  title text not null check(char_length(btrim(title)) between 3 and 120),
  body text not null check(char_length(btrim(body)) between 1 and 8000),
  pinned boolean not null default false,
  published boolean not null default false,
  archived boolean not null default false,
  revision integer not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cosmic_department_notices_order on public.cosmic_department_notices(department_id,pinned desc,created_at desc,id);

create table public.cosmic_department_roster (
  id uuid primary key default gen_random_uuid(),
  department_id text not null references public.cosmic_departments(id),
  name text not null check(char_length(btrim(name)) between 2 and 80),
  rank text not null check(char_length(btrim(rank)) between 1 and 60),
  callsign text not null default '' check(char_length(callsign)<=24),
  division text not null default '' check(char_length(division)<=80),
  status text not null default 'active' check(status in ('active','training','reserve','leave')),
  archived boolean not null default false,
  revision integer not null default 1,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cosmic_department_roster_order on public.cosmic_department_roster(department_id,name,id);

create table public.cosmic_department_audit (
  id bigint generated always as identity primary key,
  department_id text not null references public.cosmic_departments(id),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  record_id uuid not null,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);

alter table public.cosmic_departments enable row level security;
alter table public.cosmic_department_notices enable row level security;
alter table public.cosmic_department_roster enable row level security;
alter table public.cosmic_department_audit enable row level security;
revoke all on public.cosmic_departments,public.cosmic_department_notices,
  public.cosmic_department_roster,public.cosmic_department_audit from public,anon,authenticated,service_role;
revoke all on sequence public.cosmic_department_audit_id_seq from public,anon,authenticated,service_role;

create function public.cosmic_department_identity(p_user uuid) returns text
language plpgsql stable security definer set search_path='' as $$
declare discord_id text;
begin
  if not exists(select 1 from public.cosmic_access where user_id=p_user and not suspended) then
    raise exception 'Department access is unavailable for this account.' using errcode='42501';
  end if;
  select provider_id into discord_id from auth.identities where user_id=p_user and provider='discord';
  if discord_id is null or discord_id !~ '^[0-9]{17,20}$' then
    raise exception 'A verified Discord account is required.' using errcode='42501';
  end if;
  return discord_id;
end;$$;

create function public.cosmic_department_request(p_user uuid,p_roles text[],p_action text,p_department text default null,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.cosmic_departments; can_edit boolean; n public.cosmic_department_notices;
  r public.cosmic_department_roster; result jsonb; previous jsonb; record_id uuid;
  page_offset integer; notice_offset integer; include_archived boolean;
begin
  perform public.cosmic_department_identity(p_user);
  if p_roles is null then p_roles:='{}'; end if;
  if p_action='list' then
    return jsonb_build_object('departments',coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'name',name,'can_edit',editor_roles && p_roles) order by name)
      from public.cosmic_departments where enabled and viewer_roles && p_roles),'[]'::jsonb));
  end if;
  select * into d from public.cosmic_departments where id=p_department and enabled;
  if not found or not (d.viewer_roles && p_roles) then
    raise exception 'You do not have access to this department.' using errcode='42501';
  end if;
  can_edit:=d.editor_roles && p_roles;
  if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Invalid request.'; end if;
  if p_action='read' then
    page_offset:=coalesce((p_payload->>'roster_offset')::integer,0);
    notice_offset:=coalesce((p_payload->>'notice_offset')::integer,0);
    if page_offset<0 or page_offset>100000 or notice_offset<0 or notice_offset>100000 then raise exception 'Invalid page.'; end if;
    include_archived:=can_edit and coalesce((p_payload->>'archived')::boolean,false);
    select jsonb_build_object('department',jsonb_build_object('id',d.id,'name',d.name,'can_edit',can_edit),
      'notices',coalesce((select jsonb_agg(to_jsonb(x) order by x.pinned desc,x.created_at desc,x.id) from
        (select id,title,body,pinned,published,archived,revision,created_at,updated_at
         from public.cosmic_department_notices where department_id=d.id and archived=include_archived and (published or can_edit)
         order by pinned desc,created_at desc,id limit 20 offset notice_offset) x),'[]'::jsonb),
      'notices_more',(select count(*)>notice_offset+20 from public.cosmic_department_notices
        where department_id=d.id and archived=include_archived and (published or can_edit)),
      'roster',coalesce((select jsonb_agg(to_jsonb(x) order by x.name,x.id) from
        (select id,name,rank,callsign,division,status,archived,revision,updated_at from public.cosmic_department_roster
         where department_id=d.id and archived=include_archived order by name,id limit 50 offset page_offset) x),'[]'::jsonb),
      'roster_more',(select count(*)>page_offset+50 from public.cosmic_department_roster where department_id=d.id and archived=include_archived)) into result;
    return result;
  end if;
  if not can_edit then raise exception 'Department command access is required.' using errcode='42501'; end if;
  if p_action not in ('notice_save','notice_archive','roster_save','roster_archive') then raise exception 'Unknown department action.'; end if;
  if p_payload->>'id' is not null then record_id:=(p_payload->>'id')::uuid; end if;
  if p_action like 'notice_%' then
    if record_id is not null then
      select * into n from public.cosmic_department_notices where id=record_id and department_id=d.id for update;
      if not found then raise exception 'Notice not found.'; end if;
      if n.revision is distinct from (p_payload->>'revision')::integer then raise exception 'This notice changed. Refresh before editing.'; end if;
      previous:=to_jsonb(n);
    end if;
    if p_action='notice_save' then
      if record_id is null then
        insert into public.cosmic_department_notices(department_id,title,body,pinned,published,created_by,updated_by)
        values(d.id,btrim(p_payload->>'title'),btrim(p_payload->>'body'),coalesce((p_payload->>'pinned')::boolean,false),
          coalesce((p_payload->>'published')::boolean,false),p_user,p_user) returning * into n;
      else
        if n.archived then raise exception 'Restore this notice before editing.'; end if;
        update public.cosmic_department_notices set title=btrim(p_payload->>'title'),body=btrim(p_payload->>'body'),
          pinned=coalesce((p_payload->>'pinned')::boolean,false),published=coalesce((p_payload->>'published')::boolean,false),
          revision=revision+1,updated_by=p_user,updated_at=now() where id=n.id returning * into n;
      end if;
    else
      if record_id is null or jsonb_typeof(p_payload->'archived') is distinct from 'boolean' then raise exception 'Invalid archive request.'; end if;
      update public.cosmic_department_notices set archived=(p_payload->>'archived')::boolean,
        revision=revision+1,updated_by=p_user,updated_at=now() where id=n.id returning * into n;
    end if;
    result:=to_jsonb(n);record_id:=n.id;
  else
    if record_id is not null then
      select * into r from public.cosmic_department_roster where id=record_id and department_id=d.id for update;
      if not found then raise exception 'Roster entry not found.'; end if;
      if r.revision is distinct from (p_payload->>'revision')::integer then raise exception 'This roster entry changed. Refresh before editing.'; end if;
      previous:=to_jsonb(r);
    end if;
    if p_action='roster_save' then
      if record_id is null then
        insert into public.cosmic_department_roster(department_id,name,rank,callsign,division,status,updated_by)
        values(d.id,btrim(p_payload->>'name'),btrim(p_payload->>'rank'),btrim(coalesce(p_payload->>'callsign','')),
          btrim(coalesce(p_payload->>'division','')),coalesce(p_payload->>'status','active'),p_user) returning * into r;
      else
        if r.archived then raise exception 'Restore this roster entry before editing.'; end if;
        update public.cosmic_department_roster set name=btrim(p_payload->>'name'),rank=btrim(p_payload->>'rank'),
          callsign=btrim(coalesce(p_payload->>'callsign','')),division=btrim(coalesce(p_payload->>'division','')),
          status=coalesce(p_payload->>'status','active'),revision=revision+1,updated_by=p_user,updated_at=now()
          where id=r.id returning * into r;
      end if;
    else
      if record_id is null or jsonb_typeof(p_payload->'archived') is distinct from 'boolean' then raise exception 'Invalid archive request.'; end if;
      update public.cosmic_department_roster set archived=(p_payload->>'archived')::boolean,
        revision=revision+1,updated_by=p_user,updated_at=now() where id=r.id returning * into r;
    end if;
    result:=to_jsonb(r);record_id:=r.id;
  end if;
  insert into public.cosmic_department_audit(department_id,actor_id,action,record_id,before_value,after_value)
  values(d.id,p_user,p_action,record_id,previous,result);
  return jsonb_build_object('id',record_id,'revision',result->'revision');
end;$$;

revoke all on function public.cosmic_department_identity(uuid),public.cosmic_department_request(uuid,text[],text,text,jsonb) from public,anon,authenticated;
grant execute on function public.cosmic_department_identity(uuid),public.cosmic_department_request(uuid,text[],text,text,jsonb) to service_role;
commit;
