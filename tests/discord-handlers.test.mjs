import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandlers,reviewMessage,configFromEnv} from '../supabase/functions/_shared/discord.mjs';

const keys=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);
const hex=bytes=>Buffer.from(bytes).toString('hex');
const config={publicKey:hex(await crypto.subtle.exportKey('raw',keys.publicKey)),
  appId:'100000000000000001',guildId:'1329107732003029093',channelId:'1449966265195171892',
  reviewerRoles:['1329107732896284713','1329107732896284720'],
  botToken:'test-only-bot-token',supabaseUrl:'https://test.supabase.co',serviceKey:'test-only-service-key',deliverySecret:'test-only-secret-longer-than-thirty-two-characters'};
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',messageId='100000000000000003';
const base={id:'100000000000000009',application_id:config.appId,guild_id:config.guildId,channel_id:config.channelId,
  member:{user:{id:'100000000000000002'},roles:[config.reviewerRoles[0]]},
  message:{id:messageId,author:{id:config.appId}},token:'test-only-interaction-token'};
const reply=data=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
async function request(data,timestamp=String(Math.floor(Date.now()/1000))){
  const body=JSON.stringify(data),signature=hex(await crypto.subtle.sign('Ed25519',keys.privateKey,new TextEncoder().encode(timestamp+body)));
  return new Request('https://example.test/interactions',{method:'POST',body,headers:{'x-signature-ed25519':signature,'x-signature-timestamp':timestamp}});
}
const click={...base,type:3,data:{custom_id:`cosmic:approve:${id}:1`}};
const submitted=(action='approve',feedback='')=>({...base,type:5,data:{custom_id:`cosmic:${action}:${id}:1:${messageId}`,components:[{type:18,component:{type:4,custom_id:'feedback',value:feedback}}]}});
const deliveryRequest=()=>new Request('https://example.test/delivery',{method:'POST',headers:{authorization:`Bearer ${config.deliverySecret}`}});
const job={application_id:id,revision:1,version:1,lease_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',attempts:1,
  display_name:'Applicant @everyone',discord_id:'100000000000000004',application:{id,kind:'whitelist',status:'submitted',answers:{character:'Full character answer '.repeat(200)},feedback:''}};

test('department approvals open employee fields and validate the applicant before saving',async()=>{
  const viewer='1449442096955002982',editor='1449494268329852938',pending=[],calls=[];
  const h=createHandlers({config,waitUntil:p=>pending.push(p),log:()=>{},fetchImpl:async(url,options)=>{
    calls.push({url,options});
    if(url.endsWith('/members/'+base.member.user.id))return reply({roles:[config.reviewerRoles[0],viewer,editor]});
    if(url.endsWith('cosmic_department_approval_context'))return reply({viewer_roles:[viewer],editor_roles:[editor],discord_id:job.discord_id});
    if(url.endsWith('/members/'+job.discord_id))return reply({user:{id:job.discord_id,username:'verified.applicant'}});
    if(url.endsWith('cosmic_approve_department_application'))return reply({status:'approved',roster_id:id});
    return reply({});
  }});
  const message=reviewMessage({...job,application:{...job.application,kind:'department'}}).payload;
  assert.match(message.components[0].components[0].custom_id,/:enroll:/);
  const modal=await (await h.interactions(await request({...click,data:{custom_id:`cosmic:enroll:${id}:1`}}))).json();
  assert.equal(modal.type,9);assert.equal(modal.data.components.length,5);
  const submission=submitted('enroll');submission.data.components.push(...Object.entries({name:'Fictional Officer',callsign:'TEST-01',rank:'Officer',division:'Patrol'}).map(([custom_id,value])=>({type:18,component:{type:4,custom_id,value}})));
  assert.equal((await (await h.interactions(await request(submission))).json()).type,5);await Promise.all(pending);
  const saved=JSON.parse(calls.find(c=>c.url.endsWith('cosmic_approve_department_application')).options.body);
  assert.equal(saved.p_member_id,job.discord_id);assert.equal(saved.p_roster.name,'Fictional Officer');assert.equal(saved.p_roster.status,'training');
  assert.equal((await (await h.interactions(await request(submitted('enroll')))).json()).type,4);
});

test('scheduled roster checking requires worker authentication and runs even if review channel access fails',async()=>{
  let checks=0;const h=createHandlers({config,syncRoster:async()=>{checks++;return {checked:0,archived:0,failed:0};},fetchImpl:async()=>reply({})});
  await h.delivery(new Request('https://test',{method:'POST'}));assert.equal(checks,0);
  assert.equal((await h.delivery(deliveryRequest())).status,409);assert.equal(checks,1);
});

test('built-in Cron secret authenticates delivery but public or arbitrary keys do not',async()=>{
  const serverKey='sb_secret_test_only_abcdefghijklmnopqrstuvwxyz';
  const env=configFromEnv(name=>name==='SUPABASE_SECRET_KEYS'?JSON.stringify({default:serverKey,invalid:'sb_publishable_public_only'}):undefined);
  assert.deepEqual(env.schedulerKeys,[serverKey]);
  const h=createHandlers({config:{...config,deliverySecret:undefined,schedulerKeys:env.schedulerKeys},fetchImpl:async url=>url.includes('/channels/')?reply({guild_id:config.guildId,type:0,permission_overwrites:[{id:config.guildId,type:0,deny:'1024',allow:'0'}]}):reply(null)});
  for(const key of ['sb_publishable_public_only','sb_secret_unknown_abcdefghijklmnopqrstuvwxyz','']){
    assert.equal((await h.delivery(new Request('https://example.test/delivery',{method:'POST',headers:{apikey:key}}))).status,401);
  }
  assert.equal((await h.delivery(new Request('https://example.test/delivery',{method:'POST',headers:{apikey:serverKey}}))).status,200);
  assert.deepEqual(configFromEnv(name=>name==='SUPABASE_SECRET_KEYS'?'malformed':undefined).schedulerKeys,[]);
});

test('unsigned, forged and stale requests cannot reach the backend',async()=>{
  let calls=0;const h=createHandlers({config,fetchImpl:async()=>{calls++;throw Error('Unexpected network');}});
  assert.equal((await h.interactions(new Request('https://example.test',{method:'POST',body:'{}'}))).status,401);
  assert.equal((await h.interactions(await request(click,'1000000000'))).status,401);
  const tampered=await request(click);const headers=tampered.headers;
  assert.equal((await h.interactions(new Request('https://example.test',{method:'POST',headers,body:JSON.stringify({...click,type:5})}))).status,401);
  assert.equal(calls,0);
});
test('Discord endpoint validation accepts a signed ping',async()=>{
  const h=createHandlers({config});assert.deepEqual(await (await h.interactions(await request({type:1,application_id:config.appId}))).json(),{type:1});
});
test('only designated server, channel and reviewer roles can open decisions',async()=>{
  const h=createHandlers({config});
  for(const change of [{guild_id:'999999999999999999'},{channel_id:'999999999999999999'},
    {member:{...base.member,roles:[]}},{message:{...base.message,author:{id:'999999999999999999'}}}]){
    const result=await (await h.interactions(await request({...click,...change}))).json();
    assert.equal(result.type,4);assert.equal(result.data.flags,64);
  }
  const result=await (await h.interactions(await request(click))).json();
  assert.equal(result.type,9);assert.ok(result.data.custom_id.length<=100);
  assert.equal(result.data.components[0].type,18);
});
test('denial and changes require applicant-visible feedback',async()=>{
  const h=createHandlers({config});
  for(const action of ['deny','changes'])assert.equal((await (await h.interactions(await request(submitted(action,'no')))).json()).type,4);
});
test('decision acknowledges immediately, checks current roles and saves once through the RPC',async()=>{
  const pending=[],calls=[];
  const h=createHandlers({config,waitUntil:p=>pending.push(p),log:()=>{},fetchImpl:async(url,options)=>{
    calls.push({url,options});
    if(url.includes('/members/'))return reply({roles:[config.reviewerRoles[1]]});
    if(url.includes('/rpc/'))return reply({status:'approved',already_recorded:false});
    return reply({});
  }});
  assert.deepEqual(await (await h.interactions(await request(submitted()))).json(),{type:5,data:{flags:64}});
  await Promise.all(pending);
  const save=calls.find(x=>x.url.includes('/rpc/'));const args=JSON.parse(save.options.body);
  assert.equal(args.p_reviewer,base.member.user.id);assert.equal(args.p_message,messageId);assert.equal(args.p_revision,1);
  assert.match(JSON.parse(calls.at(-1).options.body).content,/Decision saved/);
});
test('a reviewer losing their role cannot save an open modal',async()=>{
  const pending=[],calls=[];
  const h=createHandlers({config,waitUntil:p=>pending.push(p),fetchImpl:async(url,options)=>{calls.push(url);return reply(url.includes('/members/')?{roles:[]}:{});}});
  await h.interactions(await request(submitted()));await Promise.all(pending);
  assert.equal(calls.some(url=>url.includes('/rpc/')),false);
});
test('application messages preserve full answers and cannot ping everyone',()=>{
  const {payload,attachment}=reviewMessage(job);
  assert.deepEqual(payload.allowed_mentions,{parse:[]});assert.equal(payload.components[0].components.length,3);
  assert.ok(attachment.includes(job.application.answers.character));assert.equal(payload.attachments.length,1);
  const finished=reviewMessage({...job,application:{...job.application,status:'approved'}});
  assert.deepEqual(finished.payload.components,[]);
});
test('delivery requires its secret and a private channel before loading applications',async()=>{
  let calls=0;
  const h=createHandlers({config,fetchImpl:async()=>{calls++;return reply({guild_id:config.guildId,type:0,permission_overwrites:[]});}});
  assert.equal((await h.delivery(new Request('https://example.test',{method:'POST'}))).status,401);assert.equal(calls,0);
  assert.equal((await h.delivery(await deliveryRequest())).status,409);assert.equal(calls,1);
});
test('queue delivery posts full answers and records the resulting message',async()=>{
  let claimed=false;const calls=[];
  const h=createHandlers({config,log:()=>{},fetchImpl:async(url,options)=>{
    calls.push({url,options});
    if(url.endsWith('/channels/'+config.channelId))return reply({guild_id:config.guildId,type:0,permission_overwrites:[{id:config.guildId,type:0,deny:'1024',allow:'0'}]});
    if(url.endsWith('cosmic_claim_discord_review')){if(claimed)return reply(null);claimed=true;return reply(job);}
    if(url.endsWith('/messages')){assert.ok(options.body instanceof FormData);const payload=JSON.parse(options.body.get('payload_json'));assert.equal(payload.enforce_nonce,true);return reply({id:messageId});}
    if(url.endsWith('cosmic_finish_discord_review'))return reply(true);
    throw Error('Unexpected endpoint');
  }});
  const response=await h.delivery(await deliveryRequest());assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{delivered:1,failed:0});
  assert.equal(JSON.parse(calls.find(x=>x.url.endsWith('cosmic_finish_discord_review')).options.body).p_message,messageId);
});
test('Discord rate limits schedule a retry instead of dropping the application',async()=>{
  let retry;
  const h=createHandlers({config,log:()=>{},fetchImpl:async(url,options)=>{
    if(url.endsWith('/channels/'+config.channelId))return reply({guild_id:config.guildId,type:0,permission_overwrites:[{id:config.guildId,type:0,deny:'1024'}]});
    if(url.endsWith('cosmic_claim_discord_review'))return reply(job);
    if(url.endsWith('/messages'))return new Response(JSON.stringify({retry_after:123}),{status:429});
    if(url.endsWith('cosmic_finish_discord_review')){retry=JSON.parse(options.body);return reply(true);}
    throw Error('Unexpected endpoint');
  }});
  assert.equal((await h.delivery(await deliveryRequest())).status,503);assert.equal(retry.p_retry_seconds,123);assert.equal(retry.p_error,'Remote HTTP 429');
});
