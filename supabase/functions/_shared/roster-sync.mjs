// Only a confirmed Discord Unknown Member response can remove an active entry.
export function createRosterSync({config:c,fetchImpl=fetch,now=()=>Date.now()}){
  async function rpc(name,args={}){
    const response=await fetchImpl(`${c.supabaseUrl}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:c.serviceKey,Authorization:`Bearer ${c.serviceKey}`,'content-type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw new Error('Roster synchronization database unavailable.');
    return response.json();
  }
  return async()=>{
    let checked=0,archived=0,failed=0;const started=now();
    // Round-robin leases keep larger rosters moving without a gateway connection.
    for(let n=0;n<30&&now()-started<45000;n++){
      const job=await rpc('cosmic_claim_roster_membership_check');if(!job)break;
      let outcome='retry',name=null,retry=120,stop=false;
      try{
        const response=await fetchImpl(`https://discord.com/api/v10/guilds/${c.guildId}/members/${job.discord_id}`,{headers:{Authorization:`Bot ${c.botToken}`},signal:AbortSignal.timeout(8000)});
        const body=await response.json();
        if(response.ok&&body.user?.id===job.discord_id){outcome='present';name=body.user.username||job.discord_id;}
        else if(response.status===404&&body.code===10007)outcome='left';
        else {failed++;if(response.status===429){retry=Math.max(60,Math.ceil(Number(body.retry_after)||120));stop=true;}else if([401,403].includes(response.status)){retry=300;stop=true;}}
      }catch{failed++;stop=true;}
      const saved=await rpc('cosmic_finish_roster_membership_check',{p_id:job.id,p_lease:job.lease,p_discord:job.discord_id,p_outcome:outcome,p_name:name,p_retry_seconds:retry});
      if(saved){checked++;if(outcome==='left')archived++;}
      if(stop)break;
    }
    return {checked,archived,failed};
  };
}
