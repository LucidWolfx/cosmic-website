'use strict';
/* Discord OAuth is handled by Supabase. No passwords, tokens, client secrets,
   or server credentials are hardcoded here. Private authorization is in SQL. */
(() => {
  if(document.body.dataset.preview==='true')return;
  const conf=window.COSMIC?.auth||{};
  let clientPromise;
  function configError(){
    if(!conf.supabaseUrl||!conf.publishableKey)return 'The member backend is not connected yet. This preview cannot sign in, save, or submit real applications.';
    try {const u=new URL(conf.supabaseUrl);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)return 'Set a valid public HTTPS Supabase project URL.';}catch{return 'The Supabase project URL is invalid.';}
    if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(conf.publishableKey))return 'Use a Supabase publishable key. Never put a secret or service_role key in the website.';
    if(location.protocol==='file:')return 'Authentication needs an HTTP development server or HTTPS hosting. Run python -m http.server 8080 --directory site, then open localhost:8080.';
    return '';
  }
  async function client(){
    const error=configError();if(error)throw new Error(error);
    if(!clientPromise)clientPromise=(async()=>{
      if(!window.supabase){await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2';script.crossOrigin='anonymous';const timeout=setTimeout(()=>{script.remove();reject(new Error('The authentication library timed out. Check your connection and try again.'));},15000);script.onload=()=>{clearTimeout(timeout);resolve();};script.onerror=()=>{clearTimeout(timeout);reject(new Error('The authentication library could not be loaded. Please try again.'));};document.head.append(script);});}
      if(!window.supabase?.createClient)throw new Error('The authentication library is unavailable.');
      return window.supabase.createClient(conf.supabaseUrl,conf.publishableKey,{auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true,storageKey:'cosmic-auth-session'}});
    })().catch(e=>{clientPromise=undefined;throw e;});
    return clientPromise;
  }
  const clearCallbackUrl=()=>{if(['https:','http:'].includes(location.protocol))history.replaceState({},'',location.pathname);};
  const callbackUrl=()=>new URL('auth-callback.html',location.href).href;
  async function user(){const c=await client();const {data,error}=await c.auth.getUser();if(error){if(error.status===400||error.status===401||error.name==='AuthSessionMissingError')return null;throw error;}return data.user;}
  async function signOut(){const c=await client();const {error}=await c.auth.signOut({scope:'local'});if(error)throw error;location.replace('login.html');}
  window.CosmicAuth={client,user,signOut,configError};
  const page=document.body.dataset.page,notice=document.querySelector('#auth-notice'),msg=document.querySelector('#auth-message');
  if(page==='login'){
    const button=document.querySelector('#discord-login'),err=configError();notice.textContent=err||'Secure Discord sign-in is configured. Account membership still requires approval.';button.disabled=Boolean(err);
    button.addEventListener('click',async()=>{button.disabled=true;msg.textContent='Opening secure Discord sign-in...';try{const c=await client();const {error}=await c.auth.signInWithOAuth({provider:'discord',options:{redirectTo:callbackUrl(),scopes:'identify email'}});if(error)throw error;}catch(e){msg.textContent=e.message;msg.classList.add('error');button.disabled=false;}});
    if(!err)user().then(u=>{if(u){notice.textContent='You are already signed in. Open your member portal to continue.';const a=document.createElement('a');a.className='button';a.href='portal.html';a.textContent='Open member portal ↗';notice.after(a);}}).catch(e=>{msg.textContent=e.message;});
  }
  if(page==='auth-callback'){
    (async()=>{try{const params=new URLSearchParams(location.search);const providerError=params.get('error_description')||params.get('error');if(providerError)throw new Error(providerError);const code=params.get('code');if(!code)throw new Error('The sign-in callback has no authorization code. Return to login and try again.');const c=await client();const {error}=await c.auth.exchangeCodeForSession(code);clearCallbackUrl();if(error)throw error;const {data,error:verifyError}=await c.auth.getUser();if(verifyError||!data.user)throw verifyError||new Error('Your account could not be verified.');location.replace('portal.html');}catch(e){clearCallbackUrl();notice.textContent='Sign-in was not completed.';msg.textContent=e.message;msg.classList.add('error');}})();
  }
})();
