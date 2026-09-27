-- Apply after 001_cosmic_portal.sql. Only trusted Edge Functions use these RPCs.
begin;

alter table public.cosmic_applications add column reviewed_by_discord text;
alter table public.cosmic_application_events add column actor_discord_id text;

create table public.cosmic_discord_reviews (
  application_id uuid primary key references public.cosmic_applications(id) on delete cascade,
  revision integer not null default 1,
  version bigint not null default 1,
  delivered_version bigint not null default 0,
  channel_id text,
  message_id text,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_id uuid,
  lease_until timestamptz,
  last_error text,
  check (revision > 0 and delivered_version <= version)
);
create table public.cosmic_discord_decisions (
  interaction_id text primary key check (interaction_id ~ '^[0-9]{17,20}$'),
  application_id uuid not null references public.cosmic_applications(id) on delete cascade,
  revision integer not null,
  reviewer_discord_id text not null,
  decision text not null,
  created_at timestamptz not null default now()
);
alter table public.cosmic_discord_reviews enable row level security;
alter table public.cosmic_discord_decisions enable row level security;
revoke all on public.cosmic_discord_reviews,public.cosmic_discord_decisions from public,anon,authenticated;

create function public.cosmic_queue_discord_review() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status='submitted' then
    insert into public.cosmic_discord_reviews(application_id) values(new.id)
    on conflict(application_id) do update set
      revision=public.cosmic_discord_reviews.revision+1,
      version=public.cosmic_discord_reviews.version+1,
      attempts=0,next_attempt_at=now(),last_error=null;
  else
    update public.cosmic_discord_reviews set version=version+1,attempts=0,
      next_attempt_at=now(),last_error=null where application_id=new.id;
  end if;
  return new;
end;$$;
create trigger cosmic_application_discord_update after update of status
on public.cosmic_applications for each row execute function public.cosmic_queue_discord_review();

-- Pick up applications submitted before this integration was installed.
insert into public.cosmic_discord_reviews(application_id)
select id from public.cosmic_applications where status in ('submitted','under_review');

create function public.cosmic_claim_discord_review() returns jsonb
language plpgsql security definer set search_path='' as $$
declare q public.cosmic_discord_reviews; a public.cosmic_applications;
  display_name text; discord_id text;
begin
  select * into q from public.cosmic_discord_reviews
  where version>delivered_version and next_attempt_at<=now()
    and (lease_until is null or lease_until<now())
  order by next_attempt_at,application_id for update skip locked limit 1;
  if not found then return null; end if;
  update public.cosmic_discord_reviews set lease_id=gen_random_uuid(),
    lease_until=now()+interval '2 minutes',attempts=attempts+1
  where application_id=q.application_id returning * into q;
  select * into a from public.cosmic_applications where id=q.application_id;
  select p.display_name into display_name from public.cosmic_profiles p where p.user_id=a.user_id;
  select i.provider_id into discord_id from auth.identities i
    where i.user_id=a.user_id and i.provider='discord' limit 1;
  return to_jsonb(q)||jsonb_build_object('application',to_jsonb(a),
    'display_name',display_name,'discord_id',discord_id);
end;$$;

create function public.cosmic_finish_discord_review(
  p_id uuid,p_lease uuid,p_version bigint,p_channel text,p_message text,
  p_error text default null,p_retry_seconds integer default 60
) returns boolean language plpgsql security definer set search_path='' as $$
begin
  if p_error is null and (p_channel is null or p_message is null or
     p_channel !~ '^[0-9]{17,20}$' or p_message !~ '^[0-9]{17,20}$') then
    raise exception 'Invalid Discord message reference.';
  end if;
  update public.cosmic_discord_reviews set lease_id=null,lease_until=null,
    delivered_version=case when p_error is null then greatest(delivered_version,p_version) else delivered_version end,
    channel_id=case when p_error is null then p_channel else channel_id end,
    message_id=case when p_error is null then p_message else message_id end,
    next_attempt_at=case when p_error is null then now() else now()+make_interval(secs=>greatest(5,least(3600,p_retry_seconds))) end,
    last_error=left(p_error,500)
  where application_id=p_id and lease_id=p_lease and p_version<=version;
  return found;
end;$$;

create function public.cosmic_discord_review_application(
  p_id uuid,p_revision integer,p_interaction text,p_reviewer text,
  p_channel text,p_message text,p_decision text,p_feedback text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.cosmic_applications; q public.cosmic_discord_reviews;
  reviewer_id uuid; previous public.cosmic_discord_decisions;
begin
  if p_reviewer is null or p_reviewer !~ '^[0-9]{17,20}$' or
     p_interaction is null or p_interaction !~ '^[0-9]{17,20}$' then
    raise exception 'Invalid Discord identity.';
  end if;
  if p_decision is null or p_decision not in ('approved','denied','changes_requested') then
    raise exception 'Unknown review decision.';
  end if;
  if p_feedback is null or char_length(p_feedback)>4000 then raise exception 'Invalid feedback.'; end if;
  if p_decision in ('denied','changes_requested') and char_length(btrim(p_feedback))<5 then
    raise exception 'Explain the requested changes or denial for the applicant.';
  end if;
  -- Lock the application before the delivery row, matching the status trigger.
  select * into a from public.cosmic_applications where id=p_id for update;
  if not found then raise exception 'Application not found.'; end if;
  select * into q from public.cosmic_discord_reviews where application_id=p_id for update;
  if not found or q.revision is distinct from p_revision or
     q.channel_id is distinct from p_channel or q.message_id is distinct from p_message or
     p_message is null then
    raise exception 'This review message is out of date. Use the latest application message.';
  end if;
  select * into previous from public.cosmic_discord_decisions where interaction_id=p_interaction;
  if found then
    if previous.application_id<>p_id or previous.reviewer_discord_id<>p_reviewer or previous.decision<>p_decision then
      raise exception 'Interaction does not match the recorded decision.';
    end if;
    return jsonb_build_object('status',a.status,'already_recorded',true);
  end if;
  if exists(select 1 from auth.identities where user_id=a.user_id and provider='discord' and provider_id=p_reviewer) then
    raise exception 'You cannot review your own application.' using errcode='42501';
  end if;
  select user_id into reviewer_id from auth.identities where provider='discord' and provider_id=p_reviewer limit 1;
  if exists(select 1 from public.cosmic_access where user_id=reviewer_id and suspended) then
    raise exception 'Your portal account is suspended.' using errcode='42501';
  end if;
  if a.status not in ('submitted','under_review') then raise exception 'This application is no longer awaiting review.'; end if;
  if a.kind='whitelist' and p_decision='approved' then
    perform 1 from public.cosmic_access where user_id=a.user_id and not suspended for update;
    if not found then raise exception 'This account is suspended. Resolve access before approving.'; end if;
    update public.cosmic_access set role='member',updated_at=now()
      where user_id=a.user_id and role='applicant' and not suspended;
  end if;
  update public.cosmic_applications set status=p_decision,feedback=btrim(p_feedback),
    reviewed_by=reviewer_id,reviewed_by_discord=p_reviewer,reviewed_at=now(),updated_at=now() where id=p_id;
  insert into public.cosmic_application_events(application_id,actor_id,actor_discord_id,action)
    values(p_id,reviewer_id,p_reviewer,p_decision);
  insert into public.cosmic_discord_decisions(interaction_id,application_id,revision,reviewer_discord_id,decision)
    values(p_interaction,p_id,p_revision,p_reviewer,p_decision);
  return jsonb_build_object('status',p_decision,'already_recorded',false);
end;$$;

revoke all on function public.cosmic_queue_discord_review() from public,anon,authenticated;
revoke all on function public.cosmic_claim_discord_review() from public,anon,authenticated;
revoke all on function public.cosmic_finish_discord_review(uuid,uuid,bigint,text,text,text,integer) from public,anon,authenticated;
revoke all on function public.cosmic_discord_review_application(uuid,integer,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.cosmic_claim_discord_review(),
  public.cosmic_finish_discord_review(uuid,uuid,bigint,text,text,text,integer),
  public.cosmic_discord_review_application(uuid,integer,text,text,text,text,text,text) to service_role;
commit;
