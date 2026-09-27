import test from 'node:test';
import assert from 'node:assert/strict';
import {createDepartmentHandler} from '../supabase/functions/_shared/departments.mjs';
const config={supabaseUrl:'https://test.supabase.co',serviceKey:'private-test-key',botToken:'private-test-bot',guildId:'1329107732003029093',origin:'https://lucidwolfx.github.io'};
const user='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',discord='100000000000000001',viewer='1449442096955002982';
const response=(data,status=200)=>new Response(JSON.stringify(data),{status});
const request=(body={action:'read',department:'lspd'},headers={})=>new Request('https://test.supabase.co/functions/v1/department-hub',{method:'POST',headers:{origin:config.origin,authorization:'Bearer test-user-session','content-type':'application/json',...headers},body:JSON.stringify(body)});
function fixture(options={}){
  const calls=[];let roleList=[viewer];
  const handler=createDepartmentHandler({config,fetchImpl:async(url,init)=>{
    calls.push({url,init});
    if(url.endsWith('/auth/v1/user'))return response({id:user,user_metadata:{discord_id:'999999999999999999',roles:['fake']}},options.authStatus||200);
    if(url.endsWith('/cosmic_department_identity'))return response(options.identity||discord,options.identityStatus||200);
    if(url.includes('/guilds/'))return response({user:{id:options.memberId||discord},roles:roleList,pending:options.pending||false},options.discordStatus||200);
    if(url.endsWith('/cosmic_department_request'))return response(options.dbError||{departments:[]},options.dbError?403:200);
    throw Error('Unexpected endpoint');
  }});
  return {handler,calls,setRoles:value=>{roleList=value;}};
}
test('department endpoint rejects missing/invalid sessions and wrong origins before private access',async()=>{
  const f=fixture();assert.equal((await f.handler(request({}, {authorization:''}))).status,401);assert.equal(f.calls.length,0);
  assert.equal((await f.handler(request(undefined,{origin:'https://untrusted.example'}))).status,403);assert.equal(f.calls.length,0);
  const g=fixture({authStatus:401});assert.equal((await g.handler(request())).status,401);assert.equal(g.calls.length,1);
});
test('verified identity and fresh Discord roles override client-supplied IDs, roles and metadata',async()=>{
  const f=fixture();const r=await f.handler(request({action:'read',department:'lspd',user_id:'fake',roles:['fake'],p_roles:['fake'],payload:{roles:['fake']}}));
  assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
  assert.ok(f.calls[2].url.endsWith('/members/'+discord));
  const args=JSON.parse(f.calls[3].init.body);assert.equal(args.p_user,user);assert.deepEqual(args.p_roles,[viewer]);
  f.setRoles([]);await f.handler(request());assert.deepEqual(JSON.parse(f.calls.at(-1).init.body).p_roles,[]);
  assert.equal(f.calls.filter(c=>c.url.includes('/members/')).length,2);
});
test('missing, pending and wrong Discord members never reach content RPC',async()=>{
  for(const options of [{discordStatus:404},{pending:true},{memberId:'100000000000000099'}]){
    const f=fixture(options);assert.equal((await f.handler(request())).status,403);assert.equal(f.calls.length,3);
  }
});
test('Discord outages and rate limits fail closed without cached access',async()=>{
  for(const status of [401,403,429,500]){const f=fixture({discordStatus:status});assert.equal((await f.handler(request())).status,503);assert.equal(f.calls.length,3);}
});
test('suspended or unlinked accounts stop before Discord and never expose private service errors',async()=>{
  const f=fixture({identity:{code:'42501',message:'Suspended internal account'},identityStatus:403});const r=await f.handler(request());assert.equal(r.status,403);assert.equal(f.calls.length,2);assert.ok(!(await r.text()).includes('Suspended internal'));
  const g=fixture({identity:'not-a-verified-id'});assert.equal((await g.handler(request())).status,403);assert.equal(g.calls.length,2);
});
test('invalid actions, payloads and large requests fail before authentication network calls',async()=>{
  for(const body of [{action:'delete_all'},{action:'read',department:'../../x'},{action:'read',department:'lspd',payload:[]},{action:'read',department:'lspd',payload:{body:'x'.repeat(21000)}}]){
    const f=fixture();assert.ok([400,413].includes((await f.handler(request(body))).status));assert.equal(f.calls.length,0);
  }
});
test('CORS preflight has no private content and database denials are preserved',async()=>{
  const f=fixture();const r=await f.handler(new Request('https://test.supabase.co',{method:'OPTIONS',headers:{origin:config.origin}}));assert.equal(r.status,204);assert.equal(f.calls.length,0);
  const g=fixture({dbError:{code:'42501'}});assert.equal((await g.handler(request())).status,403);
});
