const API = 'https://discord.com/api/v10';
const ID = /^[0-9]{17,20}$/;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const ACTION = new RegExp(`^cosmic:(approve|deny|changes):(${UUID}):([1-9][0-9]{0,8})(?::([0-9]{17,20}))?$`);
const DECISIONS = { approve: 'approved', deny: 'denied', changes: 'changes_requested' };
const TITLES = { approve: 'Approve application', deny: 'Deny application', changes: 'Request changes' };
const TYPES = { whitelist: 'Whitelist application', department: 'Department interest', business: 'Business proposal', organization: 'Organization proposal', creator: 'Creator inquiry', support: 'Support request' };
const STATUS = { submitted: 'Awaiting review', under_review: 'Under review', changes_requested: 'Changes requested', approved: 'Approved', denied: 'Denied', withdrawn: 'Withdrawn' };
const QUESTIONS = { character: 'Your character', motivation: 'Why Cosmic?', scenario: 'Unexpected roleplay scenario', teamwork: 'Helping the community', title: 'Request title', details: 'Request details', rules_ack: 'Rules acknowledged', rules_version_ack: 'Rules version' };
const encoder = new TextEncoder();
const json = (data, status=200) => new Response(JSON.stringify(data), {status, headers:{'content-type':'application/json','cache-control':'no-store'}});
const privateReply = content => json({type:4,data:{content,flags:64,allowed_mentions:{parse:[]}}});
const clean = value => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'');
const text = (value, max=1000) => clean(value).replace(/[\\*_`~|>]/g,'\\$&').slice(0,max) || 'Not provided';

export function configFromEnv(get) {
  let schedulerKeys=[];
  try{schedulerKeys=Object.values(JSON.parse(get('SUPABASE_SECRET_KEYS')||'{}')).filter(v=>typeof v==='string'&&/^sb_secret_[A-Za-z0-9_-]{20,}$/.test(v));}catch{}
  return {
    supabaseUrl:get('SUPABASE_URL'), serviceKey:get('SUPABASE_SERVICE_ROLE_KEY'),
    publicKey:get('DISCORD_PUBLIC_KEY'), appId:get('DISCORD_APPLICATION_ID'),
    botToken:get('DISCORD_BOT_TOKEN'), guildId:get('DISCORD_GUILD_ID'),
    channelId:get('DISCORD_REVIEW_CHANNEL_ID'),
    reviewerRoles:(get('DISCORD_REVIEWER_ROLE_IDS')||'').split(',').map(s=>s.trim()).filter(Boolean),
    deliverySecret:get('DISCORD_DELIVERY_SECRET'),
    schedulerKeys,
  };
}

export async function verifySignature(request, body, publicKey, now=Date.now()) {
  const signature=request.headers.get('x-signature-ed25519')||'';
  const timestamp=request.headers.get('x-signature-timestamp')||'';
  if(!/^[0-9a-f]{128}$/i.test(signature)||!/^[0-9a-f]{64}$/i.test(publicKey||'')||
     !/^[0-9]{10,11}$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>300)return false;
  const bytes=hex=>Uint8Array.from(hex.match(/.{2}/g),v=>parseInt(v,16));
  try {
    const key=await crypto.subtle.importKey('raw',bytes(publicKey),{name:'Ed25519'},false,['verify']);
    return await crypto.subtle.verify('Ed25519',key,bytes(signature),encoder.encode(timestamp+body));
  } catch { return false; }
}

export function reviewMessage(job) {
  const a=job.application;
  const open=['submitted','under_review'].includes(a.status);
  const fields=[
    {name:'Applicant',value:text(job.display_name,120),inline:true},
    {name:'Discord account',value:ID.test(job.discord_id||'')?job.discord_id:'No Discord identity linked',inline:true},
    {name:'Status',value:STATUS[a.status]||text(a.status,50),inline:true},
    {name:'Application reference',value:a.id},
  ];
  if(a.feedback)fields.push({name:'Feedback for the applicant',value:text(a.feedback)});
  if(a.reviewed_by_discord)fields.push({name:'Reviewed by Discord user',value:text(a.reviewed_by_discord,30)});
  const payload={
    content:'',allowed_mentions:{parse:[]},
    embeds:[{title:TYPES[a.kind]||'Application',description:'Read the attached application, then choose a decision below. Feedback is visible to the applicant on the website.',color:a.status==='approved'?0x5ac99c:a.status==='denied'?0xe27979:0x8ac7f3,fields,footer:{text:`Cosmic | submission ${job.revision}`}}],
    components:open?[{type:1,components:[
      {type:2,style:3,label:'Approve',custom_id:`cosmic:approve:${a.id}:${job.revision}`},
      {type:2,style:4,label:'Deny',custom_id:`cosmic:deny:${a.id}:${job.revision}`},
      {type:2,style:2,label:'Request changes',custom_id:`cosmic:changes:${a.id}:${job.revision}`},
    ]}]:[],
    attachments:[{id:0,filename:`application-${a.id}.txt`,description:'Complete application answers'}],
  };
  const answers=Object.entries(a.answers||{}).map(([key,value])=>`${QUESTIONS[key]||key}\n${typeof value==='object'?JSON.stringify(value):clean(value)}`).join('\n\n');
  const attachment=`COSMIC APPLICATION\nReference: ${a.id}\nSubmission: ${job.revision}\nApplicant: ${clean(job.display_name)}\nDiscord account: ${job.discord_id||'Not linked'}\nType: ${TYPES[a.kind]||a.kind}\nStatus: ${STATUS[a.status]||a.status}\n\n${answers}\n\nStaff feedback\n${clean(a.feedback)||'None yet'}\n`;
  return {payload,attachment};
}

class RemoteError extends Error {
  constructor(service,status,retrySeconds=60) {super(`${service} request failed (${status}).`);this.status=status;this.retrySeconds=retrySeconds;}
}

export function createHandlers({config:c,fetchImpl=fetch,waitUntil=()=>{},now=()=>Date.now(),log=console.error}) {
  function configured() {
    try{return new URL(c.supabaseUrl).protocol==='https:'&&Boolean(c.serviceKey&&c.botToken)&&
      [c.guildId,c.channelId,c.appId].every(v=>ID.test(v||''))&&
      c.reviewerRoles?.length>0&&c.reviewerRoles.every(v=>ID.test(v)&&v!==c.guildId);}
    catch{return false;}
  }
  async function discord(path,options={}) {
    const response=await fetchImpl(API+path,{...options,headers:{Authorization:`Bot ${c.botToken}`,...options.headers},signal:AbortSignal.timeout(8000)});
    if(!response.ok){
      let retry=60;
      if(response.status===429){try{retry=Math.ceil((await response.json()).retry_after)||60;}catch{}}
      throw new RemoteError('Discord',response.status,retry);
    }
    return response.status===204?null:response.json();
  }
  async function rpc(name,args={}) {
    const response=await fetchImpl(`${c.supabaseUrl}/rest/v1/rpc/${name}`,{
      method:'POST',headers:{apikey:c.serviceKey,Authorization:`Bearer ${c.serviceKey}`,'content-type':'application/json'},
      body:JSON.stringify(args),signal:AbortSignal.timeout(8000),
    });
    if(!response.ok){
      const error=new RemoteError('Database',response.status);
      try{const data=await response.json();if(['P0001','42501'].includes(data.code))error.userMessage=data.message;}catch{}
      throw error;
    }
    return response.status===204?null:response.json();
  }
  const roleAllowed=roles=>Array.isArray(roles)&&roles.some(role=>c.reviewerRoles.includes(role));
  function scopeAllowed(i) {
    return i.application_id===c.appId&&i.guild_id===c.guildId&&
      (i.channel_id||i.channel?.id)===c.channelId&&ID.test(i.member?.user?.id||'')&&roleAllowed(i.member?.roles);
  }
  function modal(action,id,revision,messageId) {
    return json({type:9,data:{custom_id:`cosmic:${action}:${id}:${revision}:${messageId}`,
      title:TITLES[action],components:[{type:18,label:'Feedback for the applicant',
        description:action==='approve'?'Submit to confirm approval. Feedback is optional.':'Explain your decision or the changes needed.',
        component:{type:4,custom_id:'feedback',style:2,required:action!=='approve',min_length:action==='approve'?0:5,max_length:4000}}]}});
  }
  function feedbackOf(components) {
    for(const item of components||[]){
      if(item.custom_id==='feedback'&&typeof item.value==='string')return item.value.trim();
      const nested=feedbackOf(item.component?[item.component]:item.components);
      if(nested!==null)return nested;
    }
    return null;
  }
  async function finishInteraction(i,content) {
    // The token only goes to Discord's fixed host; never include it in logs.
    const response=await fetchImpl(`${API}/webhooks/${c.appId}/${encodeURIComponent(i.token)}/messages/@original`,{
      method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({content,allowed_mentions:{parse:[]}}),signal:AbortSignal.timeout(8000),
    });
    if(!response.ok)throw new RemoteError('Discord acknowledgement',response.status);
  }
  async function decide(i,action,id,revision,messageId,feedback) {
    let content;
    try {
      // Recheck current roles when the modal is submitted, not just when it opens.
      const member=await discord(`/guilds/${c.guildId}/members/${i.member.user.id}`);
      if(!roleAllowed(member.roles))content='Your Discord account no longer has an authorized review role. No decision was saved.';
      else {
        const result=await rpc('cosmic_discord_review_application',{
          p_id:id,p_revision:revision,p_interaction:i.id,p_reviewer:i.member.user.id,
          p_channel:c.channelId,p_message:messageId,p_decision:DECISIONS[action],p_feedback:feedback,
        });
        content=result.already_recorded?'This decision was already recorded.':`Decision saved: ${STATUS[result.status]||result.status}. The applicant can see it on the website. This channel message will update shortly.`;
      }
    } catch(error) {
      content=error.userMessage||'The review could not be confirmed. Check the application status before retrying.';
      log('Cosmic Discord review failed',error.status||'network');
    }
    try{await finishInteraction(i,content);}catch(error){log('Cosmic Discord acknowledgement failed',error.status||'network');}
  }
  async function interactions(request) {
    if(request.method!=='POST')return json({error:'Method not allowed'},405);
    const body=await request.text();
    if(body.length>128000)return json({error:'Payload too large'},413);
    if(!await verifySignature(request,body,c.publicKey,now()))return json({error:'Invalid signature'},401);
    let i;try{i=JSON.parse(body);}catch{return json({error:'Invalid JSON'},400);}
    if(i.application_id!==c.appId)return json({error:'Wrong application'},403);
    if(i.type===1)return json({type:1});
    if(!configured())return privateReply('Cosmic application reviews are not configured yet.');
    if(!scopeAllowed(i))return privateReply('You do not have access to review applications in this channel.');
    const match=ACTION.exec(i.data?.custom_id||'');
    if(!match)return privateReply('This review control is not recognized.');
    const [,action,id,revision,modalMessage]=match;
    if(i.type===3){
      if(modalMessage||!ID.test(i.message?.id||'')||i.message?.author?.id!==c.appId)return privateReply('Use the application message posted by the Cosmic bot.');
      return modal(action,id,revision,i.message.id);
    }
    if(i.type===5){
      const feedback=feedbackOf(i.data.components)??'';
      if(!modalMessage||!ID.test(i.id||'')||!i.token)return privateReply('The review form is incomplete. Reopen it from the application message.');
      if(feedback.length>4000||(action!=='approve'&&feedback.length<5))return privateReply('Please provide at least five characters of feedback for a denial or change request (maximum 4,000).');
      // Acknowledge immediately; Discord allows only three seconds for this response.
      waitUntil(decide(i,action,id,Number(revision),modalMessage,feedback));
      return json({type:5,data:{flags:64}});
    }
    return privateReply('This interaction is not supported.');
  }

  async function sendJob(job) {
    if(job.channel_id&&job.channel_id!==c.channelId)throw new Error('Review channel changed; migrate the stored message reference first.');
    const {payload,attachment}=reviewMessage(job);
    const send=async(messageId)=>{
      const body=new FormData();
      const data=messageId?payload:{...payload,nonce:job.application_id.replaceAll('-','').slice(0,24),enforce_nonce:true};
      body.set('payload_json',JSON.stringify(data));
      body.set('files[0]',new Blob([attachment],{type:'text/plain;charset=utf-8'}),payload.attachments[0].filename);
      return discord(`/channels/${c.channelId}/messages${messageId?'/'+messageId:''}`,{method:messageId?'PATCH':'POST',body});
    };
    try{return await send(job.message_id);}catch(error){if(job.message_id&&error.status===404)return send(null);throw error;}
  }
  async function delivery(request) {
    if(request.method!=='POST')return json({error:'Method not allowed'},405);
    const workerAuthorized=c.deliverySecret?.length>=32&&request.headers.get('authorization')===`Bearer ${c.deliverySecret}`;
    const schedulerAuthorized=(c.schedulerKeys||[]).some(key=>/^sb_secret_[A-Za-z0-9_-]{20,}$/.test(key)&&request.headers.get('apikey')===key);
    if(!workerAuthorized&&!schedulerAuthorized)return json({error:'Unauthorized'},401);
    if(!configured())return json({error:'Integration is not configured'},503);
    try {
      const channel=await discord(`/channels/${c.channelId}`);
      const everyone=channel.permission_overwrites?.find(p=>p.id===c.guildId&&p.type===0);
      // A dedicated private text channel prevents accidental publication to everyone.
      if(channel.guild_id!==c.guildId||channel.type!==0||!everyone||
         (BigInt(everyone.deny||0)&1024n)===0n||(BigInt(everyone.allow||0)&1024n)!==0n)
        return json({error:'Review channel must be a private text channel in the configured server'},409);
      let delivered=0,failed=0;
      for(let n=0;n<5;n++){
        const job=await rpc('cosmic_claim_discord_review');if(!job)break;
        try {
          const message=await sendJob(job);
          const recorded=await rpc('cosmic_finish_discord_review',{p_id:job.application_id,p_lease:job.lease_id,p_version:job.version,p_channel:c.channelId,p_message:message.id});
          if(recorded)delivered++;
        } catch(error) {
          failed++;
          const delay=error.status===429?error.retrySeconds:Math.min(3600,30*2**Math.min(job.attempts,7));
          await rpc('cosmic_finish_discord_review',{p_id:job.application_id,p_lease:job.lease_id,p_version:job.version,p_channel:null,p_message:null,p_error:error.status?`Remote HTTP ${error.status}`:'Delivery failed; check function configuration and connectivity.',p_retry_seconds:delay});
          if(error.status===429)break;
        }
      }
      return json({delivered,failed},failed?503:200);
    } catch(error){log('Cosmic Discord delivery failed',error.status||'configuration/network');return json({error:'Delivery unavailable'},503);}
  }
  return {interactions,delivery};
}
