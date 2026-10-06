import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createRosterSync} from '../supabase/functions/_shared/roster-sync.mjs';
import {createDepartmentHandler} from '../supabase/functions/_shared/departments.mjs';
const viewer='1449442096955002982',editor='1449494268329852938';
const applicant='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',reviewer='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const applicantDiscord='100000000000000001',reviewerDiscord='100000000000000002';
const character={name:'Fictional Officer',callsign:'TEST-01',rank:'Officer',division:'Patrol',status:'training'};
test('department approval, verified roster identity and departure lifecycle',async t=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
    create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create table auth.identities(user_id uuid references auth.users(id),provider text,provider_id text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated,service_role;`);
  for(const file of ['001_cosmic_portal.sql','002_discord_reviews.sql','003_department_hub.sql','004_department_enrollment.sql'])await db.exec(await readFile(new URL('../backend/'+file,import.meta.url),'utf8'));
  await db.query('insert into auth.users(id) values($1),($2)',[applicant,reviewer]);
  await db.query(`insert into auth.identities values($1,'discord',$2),($3,'discord',$4)`,[applicant,applicantDiscord,reviewer,reviewerDiscord]);
  await db.query(`update public.cosmic_access set role=case when user_id=$1 then 'admin' else 'member' end`,[reviewer]);
  await db.exec('update public.cosmic_settings set requests_open=true');
  async function newApplication(){
    await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[applicant]);
    const a=(await db.query(`select public.cosmic_save_application(null,'department',$1::jsonb) id`,[JSON.stringify({department:'lspd',title:'Fictional department application',details:'This is a fictional application for the automated department enrollment tests.'})])).rows[0].id;
    await db.query('select public.cosmic_submit_application($1)',[a]);
    await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[reviewer]);return a;
  }
  let id=await newApplication();
  const approve=(options={})=>db.query(`select public.cosmic_approve_department_application($1,$2,$3::text[],$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12) result`,[
    options.id||id,options.actor||reviewerDiscord,options.roles||[viewer,editor],options.member||applicantDiscord,'fixture.discord',JSON.stringify(options.roster||character),'',options.discord?null:reviewer,options.discord?1:null,options.interaction||null,options.discord?'100000000000000003':null,options.message||null]);
  const read=async(archived=false)=>(await db.query(`select public.cosmic_department_request($1,$2::text[],'read','lspd',$3::jsonb) result`,[reviewer,[viewer,editor],JSON.stringify({archived})])).rows[0].result;
  await t.test('browser clients cannot approve, run synchronization or call the old roster function',async()=>{
    for(const role of ['anon','authenticated']){await db.exec('set role '+role);try{
      await assert.rejects(()=>approve(),/permission denied/);
      await assert.rejects(()=>db.query('select public.cosmic_claim_roster_membership_check()'),/permission denied/);
      await assert.rejects(()=>db.query(`select public.cosmic_department_request_v1($1,$2::text[],'roster_save','lspd',$3::jsonb)`,[reviewer,[viewer,editor],JSON.stringify(character)]),/permission denied/);
    }finally{await db.exec('reset role');}}
  });
  await t.test('legacy approval routes cannot bypass enrollment details',async()=>{
    await assert.rejects(()=>db.query(`select public.cosmic_review_application($1,'approved','')`,[id]),/approval requires/);
    assert.equal((await read()).roster.length,0);
  });
  await t.test('command roles, applicant identity, staff access and valid fields are enforced',async()=>{
    for(const roles of [[],[viewer],[editor]])await assert.rejects(()=>approve({roles}),/command roles/);
    await assert.rejects(()=>approve({actor:applicantDiscord}),/own application/);
    await assert.rejects(()=>approve({member:'999999999999999999'}),/membership must be verified/);
    for(const roster of [{...character,callsign:''},{...character,name:'X'},{...character,rank:''},{...character,status:'invalid'}])await assert.rejects(()=>approve({roster}),/Enter a character/);
    await db.query(`update public.cosmic_access set role='member' where user_id=$1`,[reviewer]);await assert.rejects(()=>approve(),/Staff review/);
    await db.query(`update public.cosmic_access set role='admin' where user_id=$1`,[reviewer]);
  });
  let entry;
  await t.test('approval and linked roster creation commit together, ignoring spoofed identity fields',async()=>{
    const result=(await approve({roster:{...character,discord_id:'999999999999999999',user_id:reviewer}})).rows[0].result;
    entry=(await read()).roster[0];assert.equal(entry.id,result.roster_id);assert.equal(entry.discord_id,applicantDiscord);assert.equal(entry.discord_name,'fixture.discord');
    assert.equal((await db.query('select status from public.cosmic_applications where id=$1',[id])).rows[0].status,'approved');
    await assert.rejects(()=>approve(),/no longer awaiting/);assert.equal((await read()).roster.length,1);
    const audit=await db.query(`select action from public.cosmic_department_audit where record_id=$1`,[entry.id]);assert.equal(audit.rows[0].action,'application_approved');
  });
  await t.test('ordinary edits preserve Discord linkage and cannot add unlinked employees',async()=>{
    await assert.rejects(()=>db.query(`select public.cosmic_department_request($1,$2::text[],'roster_save','lspd',$3::jsonb)`,[reviewer,[viewer,editor],JSON.stringify(character)]),/added when/);
    await db.query(`select public.cosmic_department_request($1,$2::text[],'roster_save','lspd',$3::jsonb)`,[reviewer,[viewer,editor],JSON.stringify({...entry,...character,rank:'Senior Officer',discord_id:reviewerDiscord})]);
    entry=(await read()).roster[0];assert.equal(entry.discord_id,applicantDiscord);assert.equal(entry.rank,'Senior Officer');
  });
  const claim=async()=>(await db.query('select public.cosmic_claim_roster_membership_check() result')).rows[0].result;
  const finish=(job,outcome)=>db.query('select public.cosmic_finish_roster_membership_check($1,$2,$3,$4,$5) result',[job.id,job.lease,job.discord_id,outcome,'updated.discord']);
  await t.test('transient membership failures retain employees and leases prevent duplicate processing',async()=>{
    const job=await claim();assert.equal(await claim(),null);await finish(job,'retry');assert.equal((await read()).roster.length,1);
    assert.equal((await finish(job,'left')).rows[0].result,false);
  });
  let oldLease;
  await t.test('confirmed departure archives all linked details with an audit and blocks manual restoration',async()=>{
    await db.exec(`update public.cosmic_department_roster set next_membership_check=now()`);oldLease=await claim();
    assert.equal((await finish(oldLease,'left')).rows[0].result,true);assert.equal((await read()).roster.length,0);
    const archived=(await read(true)).roster[0];assert.equal(archived.archive_reason,'discord_left');assert.equal(archived.discord_id,applicantDiscord);
    await assert.rejects(()=>db.query(`select public.cosmic_department_request($1,$2::text[],'roster_archive','lspd',$3::jsonb)`,[reviewer,[viewer,editor],JSON.stringify({...archived,archived:false})]),/new department approval/);
    assert.equal((await db.query(`select count(*)::int n from public.cosmic_department_audit where action='discord_departure'`)).rows[0].n,1);
  });
  await t.test('stale Discord messages roll back enrollment; a valid approval can re-enroll without duplicates',async()=>{
    id=await newApplication();const q=(await db.query('select public.cosmic_claim_discord_review() result')).rows[0].result;
    // Select this application explicitly; older approval messages may also be queued.
    await db.query(`update public.cosmic_discord_reviews set channel_id='100000000000000003',message_id='100000000000000004' where application_id=$1`,[id]);
    await assert.rejects(()=>approve({discord:true,interaction:'100000000000000005',message:'100000000000000099'}),/out of date/);
    assert.equal((await read()).roster.length,0);
    const result=(await approve({discord:true,interaction:'100000000000000005',message:'100000000000000004'})).rows[0].result;
    assert.equal(result.roster_id,entry.id);assert.equal((await read()).roster.length,1);
    assert.equal((await approve({discord:true,interaction:'100000000000000005',message:'100000000000000004'})).rows[0].result.already_recorded,true);
    assert.equal((await finish(oldLease,'left')).rows[0].result,false);
    assert.equal((await read()).roster.length,1);
  });
 }finally{await db.close();}
});

const config={supabaseUrl:'https://test.supabase.co',serviceKey:'server-only',botToken:'bot-only',guildId:'1329107732003029093',origins:['https://cosmicrp.net','https://lucidwolfx.github.io']};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status});
test('roster synchronizer only archives confirmed Unknown Member, never errors or missing access',async()=>{
 for(const [status,body,outcome] of [[200,{user:{id:applicantDiscord,username:'fixture'}},'present'],[404,{code:10007},'left'],[404,{code:10004},'retry'],[403,{code:50001},'retry'],[401,{},'retry'],[429,{retry_after:65},'retry'],[500,{},'retry'],[200,{user:{id:reviewerDiscord}},'retry']]){
  let claimed=false,save;
  const run=createRosterSync({config,fetchImpl:async(url,options)=>{
   if(url.endsWith('cosmic_claim_roster_membership_check')){if(claimed)return reply(null);claimed=true;return reply({id:applicant,lease:reviewer,discord_id:applicantDiscord});}
   if(url.includes('/members/'))return reply(body,status);
   save=JSON.parse(options.body);return reply(true);
  }});await run();assert.equal(save.p_outcome,outcome,`HTTP ${status}`);if(status===429)assert.equal(save.p_retry_seconds,65);
 }
});
test('department website approval uses verified applicant membership and denies missing command roles',async()=>{
 for(const origin of config.origins)for(const roles of [[viewer],[viewer,editor]]){
  let approved;
  const handler=createDepartmentHandler({config,fetchImpl:async(url,options)=>{
    if(url.endsWith('/auth/v1/user'))return reply({id:reviewer});
    if(url.endsWith('/cosmic_department_identity'))return reply(reviewerDiscord);
    if(url.endsWith('/members/'+reviewerDiscord))return reply({user:{id:reviewerDiscord},roles});
    if(url.endsWith('/cosmic_department_approval_context'))return reply({department_id:'lspd',discord_id:applicantDiscord,viewer_roles:[viewer],editor_roles:[editor]});
    if(url.endsWith('/members/'+applicantDiscord))return reply({user:{id:applicantDiscord,username:'verified.account'}});
    if(url.endsWith('/cosmic_approve_department_application')){approved=JSON.parse(options.body);return reply({status:'approved'});}
    throw Error('Unexpected call');
  }});
  const response=await handler(new Request('https://test/department-hub',{method:'POST',headers:{Authorization:'Bearer session',Origin:origin},body:JSON.stringify({action:'approve',department:'lspd',payload:{application_id:applicant,roster:{...character,discord_id:reviewerDiscord}}})}));
  assert.equal(response.status,roles.length===2?200:403);assert.equal(response.headers.get('access-control-allow-origin'),origin);if(approved){assert.equal(approved.p_member_id,applicantDiscord);assert.equal(approved.p_portal_user,reviewer);assert.equal(approved.p_member_name,'verified.account');}
 }
});
