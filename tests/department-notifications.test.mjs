import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('department notification permissions, revisions and concurrent status updates',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
    create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create table auth.identities(user_id uuid references auth.users(id),provider text,provider_id text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated,service_role;`);
  for(const file of ['001_cosmic_portal.sql','002_discord_reviews.sql','003_department_hub.sql','004_department_enrollment.sql','005_department_notifications.sql'])await db.exec(await readFile(new URL('../backend/'+file,import.meta.url),'utf8'));
  const user='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  await db.query('insert into auth.users(id) values($1)',[user]);
  await db.query(`insert into auth.identities values($1,'discord','100000000000000001')`,[user]);
  await db.exec(`update public.cosmic_access set role='member';update public.cosmic_settings set requests_open=true;`);
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[user]);
  const id=(await db.query(`select public.cosmic_save_application(null,'department','{"department":"lspd","title":"Fictional application","details":"Fictional department request used only in automated tests."}') id`)).rows[0].id;
  await db.query('select public.cosmic_submit_application($1)',[id]);
  const claim=async()=>(await db.query('select public.cosmic_claim_discord_review() result')).rows[0].result;
  const row=async()=>(await db.query('select * from public.cosmic_discord_reviews where application_id=$1',[id])).rows[0];
  const finish=(job,message='100000000000000003')=>db.query(`select public.cosmic_finish_department_notification($1,$2,$3,$4,$5,$6) done`,[id,job.lease_id,job.version,job.revision,message?'1449966318072627362':null,message]);
  const first=await claim();assert.equal(first.notified_revision,0);
  for(const role of ['anon','authenticated']){
    await db.exec('set role '+role);try{await assert.rejects(()=>finish(first),/permission denied/);}finally{await db.exec('reset role');}
  }
  await db.query(`update public.cosmic_applications set status='under_review' where id=$1`,[id]);
  assert.equal((await finish(first)).rows[0].done,true);
  let current=await row();assert.equal(current.notified_revision,1);assert.equal(current.delivered_version,1);assert.equal(current.version,2);
  assert.equal((await finish(first)).rows[0].done,false);
  const statusUpdate=await claim();assert.equal(statusUpdate.notified_revision,statusUpdate.revision);
  await finish(statusUpdate,null);assert.equal((await row()).message_id,'100000000000000003');assert.equal(await claim(),null);
  await assert.rejects(()=>db.query(`select public.cosmic_discord_review_application($1,1,'100000000000000004','100000000000000002','1449966318072627362','100000000000000003','denied','Fictional feedback')`,[id]),/Cosmic website/);
  await db.query(`update public.cosmic_applications set status='changes_requested' where id=$1`,[id]);
  await finish(await claim(),null);
  await db.query('select public.cosmic_submit_application($1)',[id]);
  const resubmission=await claim();assert.equal(resubmission.revision,2);assert.equal(resubmission.notified_revision,1);
  await finish(resubmission,'100000000000000005');assert.equal((await row()).notified_revision,2);
  await db.exec('set role service_role');try{
    await assert.rejects(()=>db.query(`select public.cosmic_discord_review_application_v1($1,1,'100000000000000004','100000000000000002','1449966318072627362','100000000000000003','denied','Fictional feedback')`,[id]),/permission denied/);
  }finally{await db.exec('reset role');}
 }finally{await db.close();}
});
