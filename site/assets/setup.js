'use strict';
(() => {
 const f=document.querySelector('#setup-form'),c=window.COSMIC||{},msg=document.querySelector('#setup-message');
 const values={name:c.brand?.name,tagline:c.brand?.tagline,logo:c.brand?.logo,accent:c.brand?.accent,referenceSheet:c.brand?.referenceSheet,heroImage:c.heroImage,...c.links,supabaseUrl:c.auth?.supabaseUrl,publishableKey:c.auth?.publishableKey,launchLabel:c.launch?.label,statusEndpoint:c.status?.endpoint};
 for(const[k,v]of Object.entries(values))if(f.elements[k])f.elements[k].value=v||'';
 f.elements.enableDesignPreview.checked=c.enableDesignPreview!==false;
 f.addEventListener('submit',e=>{e.preventDefault();const data=new FormData(f),get=k=>String(data.get(k)||'').trim();try{
  const key=get('publishableKey');if(key&&!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key))throw new Error('Only a Supabase publishable key is allowed. Do not put secret credentials here.');
  for(const field of ['discord','support','youtube','twitch','instagram','tiktok','supabaseUrl','statusEndpoint']){const value=get(field);if(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)throw new Error(field+' must use a public HTTPS URL without embedded credentials.');}}
  const connect=get('connect');if(connect){const u=new URL(connect);if(!['https:','fivem:'].includes(u.protocol)||u.username||u.password)throw new Error('Use an HTTPS FiveM join link or a fivem: connection link.');}
  const next={...c,brand:{...c.brand,name:get('name'),tagline:get('tagline'),logo:get('logo'),accent:get('accent'),referenceSheet:get('referenceSheet')},heroImage:get('heroImage'),links:Object.fromEntries(['discord','connect','support','youtube','twitch','instagram','tiktok'].map(k=>[k,get(k)])),auth:{supabaseUrl:get('supabaseUrl'),publishableKey:key},launch:{...c.launch,label:get('launchLabel')},status:{...c.status,endpoint:get('statusEndpoint')},enableDesignPreview:f.elements.enableDesignPreview.checked};
  const blob=new Blob(['/* Public Cosmic configuration. Never add secret credentials. */\nwindow.COSMIC = '+JSON.stringify(next,null,2)+';\n'],{type:'text/javascript'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='config.js';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);msg.textContent='Configuration generated. Replace site/assets/config.js with this file. Backend settings and permissions were not changed.';
 }catch(err){msg.textContent=err.message;}});
})();
