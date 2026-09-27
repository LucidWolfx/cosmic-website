const ID=/^[0-9]{17,20}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS=new Set(['list','read','notice_save','notice_archive','roster_save','roster_archive']);
class Failure extends Error {constructor(status,message){super(message);this.status=status;}}

export function departmentConfig(get){return {supabaseUrl:get('SUPABASE_URL'),serviceKey:get('SUPABASE_SERVICE_ROLE_KEY'),botToken:get('DISCORD_BOT_TOKEN'),guildId:get('DISCORD_GUILD_ID'),origin:'https://lucidwolfx.github.io'};}

export function createDepartmentHandler({config:c,fetchImpl=fetch}){
  const cors={'access-control-allow-origin':c.origin,'access-control-allow-headers':'authorization, apikey, content-type, x-client-info','access-control-allow-methods':'POST, OPTIONS','vary':'Origin','cache-control':'no-store','content-type':'application/json'};
  const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
  async function rpc(name,args){
    const response=await fetchImpl(`${c.supabaseUrl}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:c.serviceKey,Authorization:`Bearer ${c.serviceKey}`,'content-type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(8000)});
    if(!response.ok){
      let error;try{error=await response.json();}catch{}
      if(error?.code==='42501')throw new Failure(403,'Your account does not have the required department access.');
      if(error?.code==='P0001')throw new Failure(409,String(error.message).slice(0,180));
      if(['23514','23502','22P02'].includes(error?.code))throw new Failure(400,'Check the required fields and their lengths.');
      throw new Failure(503,'The department service is unavailable. Please try again.');
    }
    return response.json();
  }
  return async request=>{
    if(request.headers.get('origin')&&request.headers.get('origin')!==c.origin)return reply({error:'Origin not allowed.'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    if(request.method!=='POST')return reply({error:'Use POST.'},405);
    try{
      if(!c.supabaseUrl?.startsWith('https://')||!c.serviceKey||!c.botToken||!ID.test(c.guildId||''))throw new Failure(503,'The department service is not configured.');
      const authorization=request.headers.get('authorization')||'';
      if(!/^Bearer [^\s]+$/.test(authorization))throw new Failure(401,'Sign in to open your department.');
      if(Number(request.headers.get('content-length')||0)>20000)throw new Failure(413,'The request is too large.');
      const raw=await request.text();if(new TextEncoder().encode(raw).length>20000)throw new Failure(413,'The request is too large.');
      let input;try{input=JSON.parse(raw);}catch{throw new Failure(400,'Invalid request.');}
      if(!input||Array.isArray(input)||!ACTIONS.has(input.action)||
        (input.action!=='list'&&!/^[a-z0-9-]{1,40}$/.test(input.department||''))||
        (input.payload!==undefined&&(!input.payload||typeof input.payload!=='object'||Array.isArray(input.payload))))throw new Failure(400,'Invalid department request.');
      const auth=await fetchImpl(`${c.supabaseUrl}/auth/v1/user`,{headers:{apikey:c.serviceKey,Authorization:authorization},signal:AbortSignal.timeout(8000)});
      if(!auth.ok){if(auth.status>=500||auth.status===429)throw new Failure(503,'Sign-in verification is temporarily unavailable.');throw new Failure(401,'Your session has expired. Sign in again.');}
      const user=await auth.json();if(!UUID.test(user.id||''))throw new Failure(401,'Your account could not be verified.');
      // Never use user-editable metadata or any client-supplied identity/roles.
      const discordId=await rpc('cosmic_department_identity',{p_user:user.id});
      if(!ID.test(discordId||''))throw new Failure(403,'A verified Discord account is required.');
      const memberResponse=await fetchImpl(`https://discord.com/api/v10/guilds/${c.guildId}/members/${discordId}`,{headers:{Authorization:`Bot ${c.botToken}`},signal:AbortSignal.timeout(8000)});
      if(memberResponse.status===404)throw new Failure(403,'Join the Cosmic Discord server to access your department.');
      if(!memberResponse.ok)throw new Failure(503,'Discord role verification is temporarily unavailable. Try again shortly.');
      const member=await memberResponse.json();
      if(member.user?.id!==discordId||member.pending===true||!Array.isArray(member.roles)||member.roles.some(r=>typeof r!=='string'||!ID.test(r)))throw new Failure(403,'Your Discord membership could not be verified.');
      const roles=member.roles.filter(r=>r!==c.guildId);
      const result=await rpc('cosmic_department_request',{p_user:user.id,p_roles:roles,p_action:input.action,p_department:input.department||null,p_payload:input.payload||{}});
      return reply(result);
    }catch(error){return reply({error:error instanceof Failure?error.message:'Department verification could not be completed. Please try again.'},error instanceof Failure?error.status:503);}
  };
}
