import test from 'node:test';
import assert from 'node:assert/strict';
import {createDepartmentHandler,departmentConfig} from '../supabase/functions/_shared/departments.mjs';
const config=departmentConfig(name=>({SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'private-test-key',DISCORD_BOT_TOKEN:'private-test-bot',DISCORD_GUILD_ID:'1329107732003029093'})[name]);
const user='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',discord='100000000000000001',viewer='1449442096955002982';
const response=(data,status=200)=>new Response(JSON.stringify(data),{status});
const request=(body={action:'read',department:'lspd'},headers={})=>new Request('https://test.supabase.co/functions/v1/department-hub',{method:'POST',headers:{origin:config.origins[0],authorization:'Bearer test-user-session','content-type':'application/json',...headers},body:JSON.stringify(body)});
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
test('both production origins have exact CORS preflight permission without private access',async()=>{
  assert.deepEqual(config.origins,['https://cosmicrp.net','https://lucidwolfx.github.io']);
  const f=fixture();
  for(const origin of config.origins){
    const r=await f.handler(new Request('https://test.supabase.co',{method:'OPTIONS',headers:{origin,'access-control-request-method':'POST','access-control-request-headers':'authorization, apikey, content-type, x-client-info'}}));
    assert.equal(r.status,204);assert.equal(await r.text(),'');assert.equal(f.calls.length,0);
    assert.equal(r.headers.get('access-control-allow-origin'),origin);assert.equal(r.headers.get('vary'),'Origin');
    assert.equal(r.headers.get('access-control-allow-methods'),'POST, OPTIONS');
    assert.equal(r.headers.get('access-control-allow-headers'),'authorization, apikey, content-type, x-client-info');
    assert.equal(r.headers.get('access-control-allow-credentials'),null);
  }
});

test('unlisted and lookalike origins are rejected for POST and preflight before private calls',async()=>{
  const f=fixture();
  for(const origin of ['https://untrusted.example','https://cosmicrp.net.evil.example','https://www.cosmicrp.net','http://cosmicrp.net','https://cosmicrp.net:8443','https://lucidwolfx.github.io.evil.example','https://lucidwolfx.github.io/cosmic-website','null','*','']){
    for(const method of ['POST','OPTIONS']){
      const r=await f.handler(new Request('https://test.supabase.co',{method,headers:{origin,authorization:'Bearer test-user-session'}}));
      assert.equal(r.status,403,`${method} ${origin}`);assert.equal(r.headers.get('access-control-allow-origin'),null);
      assert.equal(r.headers.get('vary'),'Origin');assert.equal(f.calls.length,0);
    }
  }
});

test('simultaneous requests retain their own allowed origin and still verify identity and roles',async()=>{
  const f=fixture();
  const replies=await Promise.all(config.origins.map(origin=>f.handler(request(undefined,{origin}))));
  for(const [index,r] of replies.entries()){
    assert.equal(r.status,200);assert.equal(r.headers.get('access-control-allow-origin'),config.origins[index]);
    assert.equal(r.headers.get('vary'),'Origin');assert.equal(r.headers.get('cache-control'),'no-store');
  }
  assert.equal(f.calls.filter(call=>call.url.endsWith('/auth/v1/user')).length,2);
  assert.equal(f.calls.filter(call=>call.url.endsWith('/members/'+discord)).length,2);
});

test('both allowed origins preserve authentication and permission denials with readable CORS responses',async()=>{
  for(const origin of config.origins){
    const f=fixture();const missing=await f.handler(request(undefined,{origin,authorization:''}));
    assert.equal(missing.status,401);assert.equal(missing.headers.get('access-control-allow-origin'),origin);assert.equal(f.calls.length,0);
    const g=fixture({authStatus:401});const expired=await g.handler(request(undefined,{origin}));
    assert.equal(expired.status,401);assert.equal(expired.headers.get('access-control-allow-origin'),origin);assert.equal(g.calls.length,1);
    const h=fixture({dbError:{code:'42501'}});const denied=await h.handler(request(undefined,{origin}));
    assert.equal(denied.status,403);assert.equal(denied.headers.get('access-control-allow-origin'),origin);assert.equal(denied.headers.get('vary'),'Origin');
  }
});

test('requests without Origin still require authentication and receive no CORS grant',async()=>{
  const f=fixture();const r=await f.handler(new Request('https://test.supabase.co',{method:'POST',body:JSON.stringify({action:'list'})}));
  assert.equal(r.status,401);assert.equal(r.headers.get('access-control-allow-origin'),null);assert.equal(r.headers.get('vary'),'Origin');assert.equal(f.calls.length,0);
});
