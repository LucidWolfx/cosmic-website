-- Cosmic portal, fresh Supabase project migration.
-- Run once in a staging project first. Do not run over an unrelated production schema.
-- Every browser write is mediated by an authenticated, authorization-checked RPC.
begin;

create table public.cosmic_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Cosmic applicant' check (char_length(display_name) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.cosmic_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'applicant' check (role in ('applicant','member','staff','admin')),
  suspended boolean not null default false,
  updated_at timestamptz not null default now()
);
create table public.cosmic_settings (
  id boolean primary key default true check(id),
  whitelist_open boolean not null default false,
  requests_open boolean not null default false,
  rules_approved boolean not null default false,
  rules_version text not null default 'draft' check (char_length(rules_version) between 1 and 80)
);
insert into public.cosmic_settings(id) values(true);
create table public.cosmic_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('whitelist','department','business','organization','creator','support')),
  status text not null default 'draft' check(status in ('draft','submitted','under_review','changes_requested','approved','denied','withdrawn')),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers)='object' and octet_length(answers::text)<=20000),
  feedback text not null default '' check (char_length(feedback)<=4000),
  rules_version text,
  submitted_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cosmic_applications_owner_idx on public.cosmic_applications(user_id,created_at desc);
create index cosmic_applications_queue_idx on public.cosmic_applications(status,created_at desc);
create unique index cosmic_one_active_application_per_kind on public.cosmic_applications(user_id,kind)
  where status in ('draft','submitted','under_review','changes_requested');
create table public.cosmic_application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.cosmic_applications(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  created_at timestamptz not null default now()
);
create index cosmic_events_application_idx on public.cosmic_application_events(application_id,created_at);
create table public.cosmic_resources (
  id uuid primary key default gen_random_uuid(),
  title text not null check(char_length(title) between 1 and 150),
  category text not null default 'Core Hub' check(char_length(category)<=80),
  summary text not null default '' check(char_length(summary)<=400),
  body text not null default '' check(char_length(body)<=50000),
  audience text not null default 'member' check(audience in ('member','staff')),
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Ignore user-editable metadata for roles, permissions and approval.
create function public.cosmic_bootstrap_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.cosmic_profiles(user_id,display_name)
    values(new.id,left(coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'),''),nullif(btrim(new.raw_user_meta_data->>'name'),''),'Cosmic applicant'),60));
  insert into public.cosmic_access(user_id) values(new.id);
  return new;
end;$$;
create trigger cosmic_auth_user_created after insert on auth.users for each row execute function public.cosmic_bootstrap_user();
insert into public.cosmic_profiles(user_id,display_name)
  select id,left(coalesce(nullif(btrim(raw_user_meta_data->>'full_name'),''),'Cosmic applicant'),60) from auth.users on conflict do nothing;
insert into public.cosmic_access(user_id) select id from auth.users on conflict do nothing;

-- Fixed search paths and fully qualified table references avoid schema shadowing.
create function public.cosmic_role() returns text language sql stable security definer set search_path='' as $$
  select case when suspended then 'suspended' else role end from public.cosmic_access where user_id=(select auth.uid());
$$;
create function public.cosmic_guard() returns text language plpgsql stable security definer set search_path='' as $$
declare r text;
begin
  if auth.uid() is null then raise exception 'Sign in is required.' using errcode='42501'; end if;
  select public.cosmic_role() into r;
  if r is null or r='suspended' then raise exception 'This account cannot access this feature.' using errcode='42501'; end if;
  return r;
end;$$;

-- Revoke Supabase default table grants before adding only the operations needed.
alter table public.cosmic_profiles enable row level security;
alter table public.cosmic_access enable row level security;
alter table public.cosmic_settings enable row level security;
alter table public.cosmic_applications enable row level security;
alter table public.cosmic_application_events enable row level security;
alter table public.cosmic_resources enable row level security;
revoke all on public.cosmic_profiles,public.cosmic_access,public.cosmic_settings,public.cosmic_applications,public.cosmic_application_events,public.cosmic_resources from public,anon,authenticated;
grant select on public.cosmic_profiles,public.cosmic_access,public.cosmic_settings,public.cosmic_applications,public.cosmic_application_events,public.cosmic_resources to authenticated;
create policy cosmic_profile_read on public.cosmic_profiles for select to authenticated
  using(user_id=(select auth.uid()) or (select public.cosmic_role()) in ('staff','admin'));
create policy cosmic_access_read on public.cosmic_access for select to authenticated
  using(user_id=(select auth.uid()) or (select public.cosmic_role()) in ('staff','admin'));
create policy cosmic_settings_read on public.cosmic_settings for select to authenticated using(true);
create policy cosmic_application_read on public.cosmic_applications for select to authenticated
  using((user_id=(select auth.uid()) and (select public.cosmic_role())<>'suspended') or (select public.cosmic_role()) in ('staff','admin'));
create policy cosmic_event_read on public.cosmic_application_events for select to authenticated
  using(exists(select 1 from public.cosmic_applications a where a.id=application_id));
create policy cosmic_resource_read on public.cosmic_resources for select to authenticated
  using(published and ((audience='member' and (select public.cosmic_role()) in ('member','staff','admin')) or (audience='staff' and (select public.cosmic_role()) in ('staff','admin'))));

create function public.cosmic_update_profile(p_display_name text) returns void language plpgsql security definer set search_path='' as $$
begin
  perform public.cosmic_guard();
  if p_display_name is null or char_length(btrim(p_display_name)) not between 1 and 60 then raise exception 'Display name must contain 1 to 60 characters.'; end if;
  update public.cosmic_profiles set display_name=btrim(p_display_name),updated_at=now() where user_id=auth.uid();
end;$$;

create function public.cosmic_save_application(p_id uuid,p_kind text,p_answers jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare r text; a public.cosmic_applications; new_id uuid;
begin
  r:=public.cosmic_guard();
  if p_kind is null or p_kind not in ('whitelist','department','business','organization','creator','support') then raise exception 'Unknown request type.'; end if;
  if p_answers is null or jsonb_typeof(p_answers)<>'object' or octet_length(p_answers::text)>20000 then raise exception 'Invalid or oversized application data.'; end if;
  if p_kind not in ('whitelist','support') and r not in ('member','staff','admin') then raise exception 'Approved membership is required.' using errcode='42501'; end if;
  if p_kind='whitelist' and r<>'applicant' then raise exception 'Your account already has approved portal access.'; end if;
  -- Serialize creation per user to make the per-user creation limit concurrency-safe.
  perform 1 from public.cosmic_access where user_id=auth.uid() for update;
  if p_id is null then
    if (select count(*) from public.cosmic_applications where user_id=auth.uid() and created_at>now()-interval '24 hours')>=12 then raise exception 'Too many new requests. Please try again later.'; end if;
    insert into public.cosmic_applications(user_id,kind,answers) values(auth.uid(),p_kind,p_answers) returning id into new_id;
    insert into public.cosmic_application_events(application_id,actor_id,action) values(new_id,auth.uid(),'draft_created');
    return new_id;
  end if;
  select * into a from public.cosmic_applications where id=p_id for update;
  if not found or a.user_id<>auth.uid() then raise exception 'Application not found.' using errcode='42501'; end if;
  if a.kind<>p_kind or a.status not in ('draft','changes_requested') then raise exception 'This application cannot currently be edited.'; end if;
  update public.cosmic_applications set answers=p_answers,updated_at=now() where id=p_id;
  return p_id;
end;$$;

create function public.cosmic_submit_application(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare r text; a public.cosmic_applications; settings public.cosmic_settings; k text;
begin
  r:=public.cosmic_guard();
  select * into a from public.cosmic_applications where id=p_id for update;
  if not found or a.user_id<>auth.uid() then raise exception 'Application not found.' using errcode='42501'; end if;
  if a.status not in ('draft','changes_requested') then raise exception 'Only drafts or requested revisions can be submitted.'; end if;
  select * into settings from public.cosmic_settings where id=true for share;
  if a.kind='whitelist' then
    if r<>'applicant' then raise exception 'Your account already has approved portal access.'; end if;
    if not settings.whitelist_open or not settings.rules_approved or settings.rules_version='draft' then raise exception 'Whitelist intake is not open.'; end if;
    foreach k in array array['character','motivation','scenario','teamwork'] loop
      if jsonb_typeof(a.answers->k) is distinct from 'string' or char_length(btrim(a.answers->>k))<40 then raise exception 'Complete every whitelist answer with at least 40 characters.'; end if;
    end loop;
    if a.answers->'rules_ack' is distinct from 'true'::jsonb or a.answers->>'rules_version_ack' is distinct from settings.rules_version then raise exception 'You must acknowledge the current approved rules. Refresh and read the current version.'; end if;
  else
    if not settings.requests_open then raise exception 'Member request intake is not open.'; end if;
    if a.kind<>'support' and r not in ('member','staff','admin') then raise exception 'Approved membership is required.' using errcode='42501'; end if;
    if jsonb_typeof(a.answers->'title') is distinct from 'string' or char_length(btrim(a.answers->>'title')) not between 5 and 150 then raise exception 'Add a request title of 5 to 150 characters.'; end if;
    if jsonb_typeof(a.answers->'details') is distinct from 'string' or char_length(btrim(a.answers->>'details'))<40 then raise exception 'Add at least 40 characters of details.'; end if;
  end if;
  update public.cosmic_applications set status='submitted',submitted_at=now(),updated_at=now(),rules_version=case when a.kind='whitelist' then settings.rules_version else null end where id=p_id;
  insert into public.cosmic_application_events(application_id,actor_id,action) values(p_id,auth.uid(),'submitted');
end;$$;

create function public.cosmic_withdraw_application(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare a public.cosmic_applications;
begin
  perform public.cosmic_guard();
  select * into a from public.cosmic_applications where id=p_id for update;
  if not found or a.user_id<>auth.uid() then raise exception 'Application not found.' using errcode='42501'; end if;
  if a.status not in ('draft','submitted','under_review','changes_requested') then raise exception 'This application is already closed.'; end if;
  update public.cosmic_applications set status='withdrawn',updated_at=now() where id=p_id;
  insert into public.cosmic_application_events(application_id,actor_id,action) values(p_id,auth.uid(),'withdrawn');
end;$$;

create function public.cosmic_review_application(p_id uuid,p_decision text,p_feedback text) returns void language plpgsql security definer set search_path='' as $$
declare r text; a public.cosmic_applications;
begin
  r:=public.cosmic_guard();
  if r not in ('staff','admin') then raise exception 'Staff access is required.' using errcode='42501'; end if;
  if p_decision is null or p_decision not in ('under_review','changes_requested','approved','denied') then raise exception 'Unknown review decision.'; end if;
  if p_feedback is null or char_length(p_feedback)>4000 then raise exception 'Feedback may contain at most 4000 characters.'; end if;
  if p_decision in ('denied','changes_requested') and char_length(btrim(p_feedback))<5 then raise exception 'Explain the requested changes or denial for the applicant.'; end if;
  select * into a from public.cosmic_applications where id=p_id for update;
  if not found then raise exception 'Application not found.'; end if;
  if a.user_id=auth.uid() then raise exception 'You cannot review your own application.' using errcode='42501'; end if;
  if a.status not in ('submitted','under_review') then raise exception 'This application is not awaiting review.'; end if;
  if a.kind='whitelist' and p_decision='approved' then
    perform 1 from public.cosmic_access where user_id=a.user_id and not suspended for update;
    if not found then raise exception 'This account is suspended. Resolve access before approving.'; end if;
    update public.cosmic_access set role='member',updated_at=now() where user_id=a.user_id and role='applicant' and not suspended;
  end if;
  update public.cosmic_applications set status=p_decision,feedback=btrim(p_feedback),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=p_id;
  insert into public.cosmic_application_events(application_id,actor_id,action) values(p_id,auth.uid(),p_decision);
end;$$;

-- Default function EXECUTE to PUBLIC must be removed explicitly.
revoke all on function public.cosmic_bootstrap_user() from public,anon,authenticated;
revoke all on function public.cosmic_role() from public,anon,authenticated;
revoke all on function public.cosmic_guard() from public,anon,authenticated;
revoke all on function public.cosmic_update_profile(text) from public,anon,authenticated;
revoke all on function public.cosmic_save_application(uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.cosmic_submit_application(uuid) from public,anon,authenticated;
revoke all on function public.cosmic_withdraw_application(uuid) from public,anon,authenticated;
revoke all on function public.cosmic_review_application(uuid,text,text) from public,anon,authenticated;
grant execute on function public.cosmic_role(),public.cosmic_guard(),public.cosmic_update_profile(text),public.cosmic_save_application(uuid,text,jsonb),public.cosmic_submit_application(uuid),public.cosmic_withdraw_application(uuid),public.cosmic_review_application(uuid,text,text) to authenticated;
commit;
