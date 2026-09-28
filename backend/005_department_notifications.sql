-- Department submissions notify Discord; staff review the full request on the website.
begin;
-- Only privileged operators can mark a delivery as a labeled setup test.
alter table public.cosmic_discord_reviews add column notification_test boolean not null default false;
alter table public.cosmic_discord_reviews add column notified_revision integer not null default 0
  check (notified_revision >= 0 and notified_revision <= revision);

create function public.cosmic_finish_department_notification(
  p_id uuid,p_lease uuid,p_version bigint,p_revision integer,
  p_channel text default null,p_message text default null
) returns boolean language plpgsql security definer set search_path='' as $$
begin
  if (p_channel is null) <> (p_message is null) or
    (p_channel is not null and (p_channel !~ '^[0-9]{17,20}$' or p_message !~ '^[0-9]{17,20}$')) then
    raise exception 'Invalid Discord notification reference.';
  end if;
  update public.cosmic_discord_reviews q set lease_id=null,lease_until=null,
    delivered_version=greatest(q.delivered_version,p_version),
    notified_revision=greatest(q.notified_revision,p_revision),
    channel_id=coalesce(p_channel,q.channel_id),message_id=coalesce(p_message,q.message_id),
    next_attempt_at=now(),last_error=null
  where q.application_id=p_id and q.lease_id=p_lease and p_version<=q.version
    and p_revision between 1 and q.revision
    and exists(select 1 from public.cosmic_applications a where a.id=p_id and a.kind='department');
  return found;
end;$$;
revoke all on function public.cosmic_finish_department_notification(uuid,uuid,bigint,integer,text,text) from public,anon,authenticated;
grant execute on function public.cosmic_finish_department_notification(uuid,uuid,bigint,integer,text,text) to service_role;

-- Legacy department buttons must not remain a second review path.
alter function public.cosmic_discord_review_application(uuid,integer,text,text,text,text,text,text)
  rename to cosmic_discord_review_application_v1;
revoke all on function public.cosmic_discord_review_application_v1(uuid,integer,text,text,text,text,text,text) from public,anon,authenticated,service_role;
create function public.cosmic_discord_review_application(
  p_id uuid,p_revision integer,p_interaction text,p_reviewer text,
  p_channel text,p_message text,p_decision text,p_feedback text
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.cosmic_applications where id=p_id and kind='department') then
    raise exception 'Review department applications on the Cosmic website.';
  end if;
  return public.cosmic_discord_review_application_v1(p_id,p_revision,p_interaction,p_reviewer,p_channel,p_message,p_decision,p_feedback);
end;$$;
revoke all on function public.cosmic_discord_review_application(uuid,integer,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.cosmic_discord_review_application(uuid,integer,text,text,text,text,text,text) to service_role;
commit;
