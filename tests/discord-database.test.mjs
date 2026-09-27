import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('PostgreSQL application permissions and Discord review lifecycle',async t=>{
  const db=new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
      create table auth.identities(user_id uuid references auth.users(id),provider text,provider_id text);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to anon,authenticated,service_role;`);
    for(const file of ['001_cosmic_portal.sql','002_discord_reviews.sql'])await db.exec(await readFile(new URL('../backend/'+file,import.meta.url),'utf8'));
    await t.test('existing cross-account and staff permission checks pass',async()=>{
      await db.exec(await readFile(new URL('../backend/test_permissions.sql',import.meta.url),'utf8'));
    });
    const applicant='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const reviewer='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const applicantDiscord='100000000000000004',reviewerDiscord='100000000000000002';
    const channel='1449966265195171892',message='100000000000000003';
    await db.query(`insert into auth.users(id) values($1),($2)`,[applicant,reviewer]);
    await db.query(`insert into auth.identities values($1,'discord',$2),($3,'discord',$4)`,[applicant,applicantDiscord,reviewer,reviewerDiscord]);
    await db.exec(`update public.cosmic_settings set whitelist_open=true,rules_approved=true,rules_version='v1';`);
    const answers={character:'Character answer with enough detail to be a valid application.',motivation:'Motivation answer with enough detail to be a valid application.',scenario:'Scenario answer with enough detail to be a valid application.',teamwork:'Teamwork answer with enough detail to be a valid application.',rules_ack:true,rules_version_ack:'v1'};
    await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[applicant]);
    const app=(await db.query(`select public.cosmic_save_application(null,'whitelist',$1::jsonb) id`,[JSON.stringify(answers)])).rows[0].id;
    await t.test('drafts are not sent; submissions are queued with verified Discord identity',async()=>{
      assert.equal((await db.query('select public.cosmic_claim_discord_review() job')).rows[0].job,null);
      await db.query('select public.cosmic_submit_application($1)',[app]);
      const job=(await db.query('select public.cosmic_claim_discord_review() job')).rows[0].job;
      assert.equal(job.discord_id,applicantDiscord);assert.equal(job.revision,1);
      assert.equal((await db.query('select public.cosmic_claim_discord_review() job')).rows[0].job,null);
      assert.equal((await db.query(`select public.cosmic_finish_discord_review($1,$2,1,$3,$4) ok`,[app,job.lease_id,channel,message])).rows[0].ok,true);
    });
    const decide=(revision,interaction,actor,decision,feedback='',msg=message)=>db.query(`select public.cosmic_discord_review_application($1,$2,$3,$4,$5,$6,$7,$8) result`,[app,revision,interaction,actor,channel,msg,decision,feedback]);
    await t.test('browser users cannot call service review or read private queue',async()=>{
      await db.exec('set role authenticated');
      try {
        await assert.rejects(()=>decide(1,'100000000000000010',reviewerDiscord,'approved'),/permission denied/);
        await assert.rejects(()=>db.query('select * from public.cosmic_discord_reviews'),/permission denied/);
        await assert.rejects(()=>db.query('select public.cosmic_claim_discord_review()'),/permission denied/);
      } finally {await db.exec('reset role');}
    });
    await t.test('self-review and wrong messages are refused',async()=>{
      await assert.rejects(()=>decide(1,'100000000000000011',applicantDiscord,'approved'),/own application/);
      await assert.rejects(()=>decide(1,'100000000000000012',reviewerDiscord,'approved','','100000000000000099'),/out of date/);
    });
    await t.test('requested changes are visible; a duplicate interaction is idempotent',async()=>{
      const first=(await decide(1,'100000000000000013',reviewerDiscord,'changes_requested','Please explain the scenario in more detail.')).rows[0].result;
      assert.equal(first.status,'changes_requested');
      assert.equal((await decide(1,'100000000000000013',reviewerDiscord,'changes_requested','Please explain the scenario in more detail.')).rows[0].result.already_recorded,true);
      assert.equal((await db.query('select count(*)::int n from public.cosmic_discord_decisions')).rows[0].n,1);
    });
    await t.test('resubmission invalidates old buttons and cannot be approved by suspended reviewers',async()=>{
      await db.query('select public.cosmic_submit_application($1)',[app]);
      await assert.rejects(()=>decide(1,'100000000000000014',reviewerDiscord,'approved'),/out of date/);
      await db.query('update public.cosmic_access set suspended=true where user_id=$1',[reviewer]);
      await assert.rejects(()=>decide(2,'100000000000000015',reviewerDiscord,'approved'),/suspended/);
      await db.query('update public.cosmic_access set suspended=false where user_id=$1',[reviewer]);
    });
    await t.test('approval grants portal membership and locks out subsequent decisions',async()=>{
      await db.query('update public.cosmic_access set suspended=true where user_id=$1',[applicant]);
      await assert.rejects(()=>decide(2,'100000000000000016',reviewerDiscord,'approved'),/suspended/);
      await db.query('update public.cosmic_access set suspended=false where user_id=$1',[applicant]);
      assert.equal((await decide(2,'100000000000000017',reviewerDiscord,'approved','Welcome to Cosmic.')).rows[0].result.status,'approved');
      assert.equal((await db.query('select role from public.cosmic_access where user_id=$1',[applicant])).rows[0].role,'member');
      await assert.rejects(()=>decide(2,'100000000000000018',reviewerDiscord,'denied','A conflicting decision.'),/no longer awaiting/);
      assert.equal((await db.query('select reviewed_by_discord from public.cosmic_applications where id=$1',[app])).rows[0].reviewed_by_discord,reviewerDiscord);
    });
    await t.test('delivery completion cannot erase a newer pending update',async()=>{
      const job=(await db.query('select public.cosmic_claim_discord_review() job')).rows[0].job;
      await db.query(`update public.cosmic_discord_reviews set version=version+1 where application_id=$1`,[app]);
      await db.query(`select public.cosmic_finish_discord_review($1,$2,$3,$4,$5)`,[app,job.lease_id,job.version,channel,message]);
      const next=(await db.query('select public.cosmic_claim_discord_review() job')).rows[0].job;
      assert.ok(next.version>job.version);
      assert.equal((await db.query(`select public.cosmic_finish_discord_review($1,$2,$3,$4,$5) ok`,[app,job.lease_id,job.version,channel,message])).rows[0].ok,false);
    });
  } finally {await db.close();}
});
