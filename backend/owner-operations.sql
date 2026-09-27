-- Review and run selected statements in the privileged Supabase SQL dashboard.
-- Intentionally commented out. Never put privileged service keys in the browser.

-- Find your own verified identity after first Discord sign-in:
-- select p.user_id,p.display_name,a.role,a.suspended from public.cosmic_profiles p
-- join public.cosmic_access a using(user_id);

-- Bootstrap an owner (replace UUID only after checking the actual auth identity):
-- update public.cosmic_access set role='admin',updated_at=now()
-- where user_id='REPLACE_WITH_VERIFIED_USER_UUID'::uuid;

-- Assign or revoke staff access, after a documented owner review:
-- update public.cosmic_access set role='staff',updated_at=now()
-- where user_id='REPLACE_WITH_VERIFIED_USER_UUID'::uuid;
-- update public.cosmic_access set role='member',updated_at=now()
-- where user_id='REPLACE_WITH_VERIFIED_USER_UUID'::uuid;

-- Suspend an account. In-game and Discord access must be revoked separately.
-- update public.cosmic_access set suspended=true,updated_at=now()
-- where user_id='REPLACE_WITH_VERIFIED_USER_UUID'::uuid;

-- Publish approved protected plain-text material:
-- insert into public.cosmic_resources(title,category,summary,body,audience,published)
-- values('Approved member guide','Getting started','An approved guide summary.',
--        'Replace this text with reviewed member-only information.','member',true);

-- Open whitelist intake ONLY after the identical final rules version is published:
-- update public.cosmic_settings set rules_approved=true,
--   rules_version='REPLACE_WITH_APPROVED_VERSION',whitelist_open=true where id=true;
-- update public.cosmic_settings set requests_open=true where id=true;

-- Close intake without removing existing account data:
-- update public.cosmic_settings set whitelist_open=false,requests_open=false where id=true;

-- Account deletion must follow identity verification and the documented retention
-- policy. The migration cascades portal records when auth.users is deleted through
-- the privileged auth dashboard. Deletion is not implemented as a browser RPC.
