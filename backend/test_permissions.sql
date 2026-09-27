-- RUN ONLY IN A DISPOSABLE/STAGING SUPABASE PROJECT AFTER THE MIGRATION.
-- This script has NOT been executed in the generation environment.
-- Uses synthetic auth users; all test data is rolled back. Run as project owner.
-- Any exception other than an expected permission denial is a failing test.
begin;
insert into auth.users(id,raw_user_meta_data) values
 ('11111111-1111-4111-8111-111111111111','{"full_name":"Permission Test Applicant A"}'),
 ('22222222-2222-4222-8222-222222222222','{"full_name":"Permission Test Applicant B"}'),
 ('33333333-3333-4333-8333-333333333333','{"full_name":"Permission Test Reviewer"}');
update public.cosmic_access set role='staff' where user_id='33333333-3333-4333-8333-333333333333';
update public.cosmic_settings set whitelist_open=true,requests_open=true,rules_approved=true,rules_version='permission-test-v1' where id=true;
insert into public.cosmic_resources(id,title,body,audience,published) values
 ('44444444-4444-4444-8444-444444444444','TEST MEMBER RESOURCE','Member test text','member',true),
 ('55555555-5555-4555-8555-555555555555','TEST STAFF RESOURCE','Staff test text','staff',true);
insert into public.cosmic_applications(user_id,kind,answers) values('22222222-2222-4222-8222-222222222222','support','{"title":"Other user record","details":"Another user should not be able to read this test record."}');

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $$begin
 if (select count(*) from public.cosmic_applications)<>0 then raise exception 'FAIL: applicant can read other user applications'; end if;
 if (select count(*) from public.cosmic_resources)<>0 then raise exception 'FAIL: applicant can read member resources'; end if;
 begin
   update public.cosmic_access set role='admin' where user_id=auth.uid();
   raise exception 'FAIL: applicant could directly change a role';
 exception when insufficient_privilege then null; end;
 begin
   perform public.cosmic_review_application('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','approved','Bypass attempt');
   raise exception 'FAIL: applicant could call reviewer operation';
 exception when insufficient_privilege then null; end;
end;$$;
select set_config('cosmic.test_application',public.cosmic_save_application(null,'whitelist',
 '{"character":"A synthetic character answer longer than forty characters.","motivation":"A synthetic motivation answer longer than forty characters.","scenario":"A synthetic scenario answer longer than forty characters.","teamwork":"A synthetic teamwork answer longer than forty characters.","rules_ack":true,"rules_version_ack":"permission-test-v1"}')::text,true);
select public.cosmic_submit_application(current_setting('cosmic.test_application')::uuid);
do $$begin
 if (select count(*) from public.cosmic_applications)<>1 then raise exception 'FAIL: applicant cannot read exactly its own application'; end if;
end;$$;

-- Another applicant cannot see A's record or mutate it through an ownership RPC.
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
do $$begin
 if exists(select 1 from public.cosmic_applications where id=current_setting('cosmic.test_application')::uuid) then raise exception 'FAIL: cross-user read'; end if;
 begin
   perform public.cosmic_withdraw_application(current_setting('cosmic.test_application')::uuid);
   raise exception 'FAIL: cross-user withdrawal';
 exception when insufficient_privilege then null; end;
end;$$;

-- Authorized reviewer can approve A and cannot review its own support request.
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',true);
select public.cosmic_review_application(current_setting('cosmic.test_application')::uuid,'approved','Synthetic approval feedback.');
select set_config('cosmic.test_self_review',public.cosmic_save_application(null,'support','{"title":"Reviewer support test","details":"A synthetic support request long enough to validate for submission."}')::text,true);
select public.cosmic_submit_application(current_setting('cosmic.test_self_review')::uuid);
do $$begin
 begin
   perform public.cosmic_review_application(current_setting('cosmic.test_self_review')::uuid,'approved','Self approval attempt');
   raise exception 'FAIL: staff self-approval';
 exception when insufficient_privilege then null; end;
end;$$;

-- Membership unlocks only member resources.
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $$begin
 if public.cosmic_role()<>'member' then raise exception 'FAIL: whitelist approval did not grant membership'; end if;
 if not exists(select 1 from public.cosmic_resources where id='44444444-4444-4444-8444-444444444444') then raise exception 'FAIL: member resource unavailable'; end if;
 if exists(select 1 from public.cosmic_resources where id='55555555-5555-4555-8555-555555555555') then raise exception 'FAIL: member sees staff resource'; end if;
end;$$;

-- Suspension removes private access.
reset role;
update public.cosmic_access set suspended=true where user_id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
do $$begin
 if (select count(*) from public.cosmic_applications)<>0 then raise exception 'FAIL: suspended account reads applications'; end if;
 if (select count(*) from public.cosmic_resources)<>0 then raise exception 'FAIL: suspended account reads resources'; end if;
 begin
   perform public.cosmic_update_profile('Bypass attempt');
   raise exception 'FAIL: suspended account can mutate profile';
 exception when insufficient_privilege then null; end;
end;$$;

-- Anonymous credentials have no private table or write-RPC grants.
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$begin
 begin
   perform count(*) from public.cosmic_applications;
   raise exception 'FAIL: anonymous private read';
 exception when insufficient_privilege then null; end;
 begin
   perform public.cosmic_save_application(null,'support','{}');
   raise exception 'FAIL: anonymous write RPC';
 exception when insufficient_privilege then null; end;
end;$$;
reset role;
rollback;
select 'Permission test transaction completed and synthetic data rolled back.' as result;
