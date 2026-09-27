import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('department database permissions and editable content lifecycle',async t=>{
  const db=new PGlite();
  const user='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',viewer='1449442096955002982',editor='1449494268329852938';
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
      create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
      create table auth.identities(user_id uuid references auth.users(id),provider text,provider_id text);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to anon,authenticated,service_role;`);
    for(const name of ['001_cosmic_portal.sql','002_discord_reviews.sql','003_department_hub.sql'])await db.exec(await readFile(new URL('../backend/'+name,import.meta.url),'utf8'));
    await db.query('insert into auth.users(id) values($1)',[user]);await db.query(`insert into auth.identities values($1,'discord','100000000000000001')`,[user]);
    const call=async(action,payload={},roles=[viewer,editor],department='lspd')=>(await db.query('select public.cosmic_department_request($1,$2::text[],$3,$4,$5::jsonb) result',[user,roles,action,department,JSON.stringify(payload)])).rows[0].result;
    await t.test('direct table and RPC access is forbidden even for a website admin',async()=>{
      await db.query(`update public.cosmic_access set role='admin' where user_id=$1`,[user]);
      for(const role of ['anon','authenticated']){await db.exec('set role '+role);try{
        for(const table of ['cosmic_departments','cosmic_department_notices','cosmic_department_roster','cosmic_department_audit'])await assert.rejects(()=>db.query('select * from public.'+table),/permission denied/);
        await assert.rejects(()=>call('read'),/permission denied/);await assert.rejects(()=>db.query('select public.cosmic_department_identity($1)',[user]),/permission denied/);
      }finally{await db.exec('reset role');}}
    });
    await t.test('viewer role is required; editor alone and website admin do not bypass it',async()=>{
      for(const roles of [[],[editor],['999999999999999999']]){assert.deepEqual((await call('list',{},roles)).departments,[]);await assert.rejects(()=>call('read',{},roles),/do not have access/);}
      assert.equal((await call('list',{},[viewer])).departments[0].can_edit,false);
      assert.equal((await call('list')).departments[0].can_edit,true);
      await assert.rejects(()=>call('notice_save',{title:'Valid title',body:'Valid content'},[viewer]),/command access/);
    });
    let notice,employee;
    await t.test('command can draft, publish and pin; members never receive drafts',async()=>{
      notice=await call('notice_save',{title:'Fixture notice',body:'Private test content',pinned:true,published:false});
      assert.equal((await call('read',{},[viewer])).notices.length,0);
      assert.equal((await call('read')).notices.length,1);
      notice=await call('notice_save',{...notice,title:'Fixture notice',body:'Published test content',pinned:true,published:true});
      const read=await call('read',{},[viewer]);assert.equal(read.notices[0].body,'Published test content');assert.equal(read.notices[0].pinned,true);
    });
    await t.test('stale edits and cross-department record IDs cannot overwrite content',async()=>{
      await assert.rejects(()=>call('notice_save',{id:notice.id,revision:1,title:'Stale edit',body:'Bad overwrite'}),/changed/);
      await db.query(`insert into public.cosmic_departments values('bcso','Test BCSO',array[$1],array[$2],true)`,[viewer,editor]);
      await assert.rejects(()=>call('notice_save',{...notice,title:'Other department',body:'No access'},[viewer,editor],'bcso'),/not found/);
      assert.equal((await call('read')).notices[0].body,'Published test content');
    });
    await t.test('roster updates validate fields and support archive and restoration',async()=>{
      employee=await call('roster_save',{name:'Fictional Officer',rank:'Officer',callsign:'TEST-01',division:'Training',status:'training'});
      assert.equal((await call('read',{},[viewer])).roster[0].name,'Fictional Officer');
      await assert.rejects(()=>call('roster_save',{...employee,name:'Fictional Officer',rank:'Officer',status:'invalid'}),/check constraint/);
      employee=await call('roster_archive',{...employee,archived:true});
      assert.equal((await call('read',{},[viewer])).roster.length,0);
      assert.equal((await call('read',{archived:true},[viewer])).roster.length,0);
      assert.equal((await call('read',{archived:true})).roster.length,1);
      employee=await call('roster_archive',{...employee,archived:false});assert.equal((await call('read',{},[viewer])).roster.length,1);
    });
    await t.test('archived notices stay private to command and changes retain an audit trail',async()=>{
      notice=await call('notice_archive',{...notice,archived:true});assert.equal((await call('read',{},[viewer])).notices.length,0);
      assert.equal((await call('read',{archived:true})).notices.length,1);
      notice=await call('notice_archive',{...notice,archived:false});assert.equal((await call('read',{},[viewer])).notices.length,1);
      assert.equal((await db.query('select count(*)::int n from public.cosmic_department_audit')).rows[0].n,7);
    });
    await t.test('role removal, department disabling and account suspension revoke access',async()=>{
      await assert.rejects(()=>call('read',{},[]),/do not have access/);
      await db.exec(`update public.cosmic_departments set enabled=false where id='lspd'`);await assert.rejects(()=>call('read'),/do not have access/);await db.exec(`update public.cosmic_departments set enabled=true where id='lspd'`);
      await db.query('update public.cosmic_access set suspended=true where user_id=$1',[user]);await assert.rejects(()=>call('read'),/unavailable/);await assert.rejects(()=>call('list'),/unavailable/);
    });
  }finally{await db.close();}
});
