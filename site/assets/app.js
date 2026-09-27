'use strict';
(() => {
  const config=window.COSMIC||{};
  const $=(s,root=document)=>root.querySelector(s);
  const $$=(s,root=document)=>[...root.querySelectorAll(s)];
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeUrl=(value,{local=true,connect=false}={})=>{
    if(typeof value!=='string'||!value.trim())return '';
    value=value.trim();
    if(/[\u0000-\u001f\u007f]/.test(value))return '';
    if(local&&!value.startsWith('//')&&!/^[a-z][a-z0-9+.-]*:/i.test(value)&&!value.includes('\\')&&!value.split('/').includes('..'))return value;
    try { const u=new URL(value);
      if(u.protocol==='https:'&&!u.username&&!u.password)return u.href;
      if(connect&&u.protocol==='fivem:'&&!u.username&&!u.password)return u.href;
    }catch{}return '';
  };
  const message=(title,copy)=>{ $('#message-title').textContent=title;$('#message-copy').textContent=copy;$('#message-dialog').showModal(); };
  const download=(filename,data,type='application/json')=>{
    const blob=new Blob([typeof data==='string'?data:JSON.stringify(data,null,2)],{type});
    const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);
  };
  window.CosmicUI={$, $$, escape, safeUrl, message, download};
  $$('[data-year]').forEach(e=>e.textContent=new Date().getFullYear());
  $$('[data-launch-label]').forEach(e=>e.textContent=config.launch?.label||'Whitelist transition planned');
  $$('[data-wordmark]').forEach(e=>{const small=document.createElement('small');small.textContent=(config.brand?.tagline||'A life beyond ordinary').toUpperCase();e.textContent=(config.brand?.name||'Cosmic').toUpperCase();e.append(small);});
  if(config.brand?.accent&&/^#[0-9a-f]{6}$/i.test(config.brand.accent))document.documentElement.style.setProperty('--accent',config.brand.accent);
  const root=document.documentElement;
  const reference=safeUrl(config.brand?.referenceSheet||'');
  root.dataset.brandMode='text';
  root.dataset.coverMode=reference?'reference':'none';
  if(reference){
    root.dataset.referenceArt='true';
    root.dataset.brandMode='reference';
    // Resolve from the page so external CSS does not add a second assets/ folder.
    const referenceLink=document.createElement('a');referenceLink.href=reference;
    root.style.setProperty('--brand-sheet','url('+JSON.stringify(referenceLink.href)+')');
    $$('[data-reference-image]').forEach(image=>{
      image.addEventListener('error',()=>{
        if(image.closest('.reference-brand')&&root.dataset.brandMode==='reference')root.dataset.brandMode='text';
        const slice=image.closest('.sheet-slice');if(slice)slice.hidden=true;
      });
      image.src=reference;
    });
  }else{$$('[data-reference-image]').forEach(image=>{image.closest('.sheet-slice').hidden=true;});}
  const logo=safeUrl(config.brand?.logo||'');
  if(logo)$$('[data-brand-logo]').forEach(image=>{
    image.addEventListener('load',()=>{image.hidden=false;root.dataset.brandMode='custom';});
    image.addEventListener('error',()=>{image.hidden=true;});
    image.src=logo;
  });
  if(config.heroImage){
    const image=$('[data-hero-image]'),url=safeUrl(config.heroImage);
    if(image&&url){
      image.addEventListener('load',()=>{image.hidden=false;root.dataset.coverMode='custom';});
      image.addEventListener('error',()=>{image.hidden=true;});
      image.src=url;
    }
  }
  if(config.enableDesignPreview===false)$$('[data-design-preview]').forEach(e=>e.hidden=true);
  const menu=$('#menu-toggle'), mobile=$('#mobile-nav');
  if(menu&&mobile){menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));mobile.hidden=!open;menu.setAttribute('aria-label',open?'Close menu':'Open menu');});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!mobile.hidden){mobile.hidden=true;menu.setAttribute('aria-expanded','false');menu.focus();}});}
  document.addEventListener('click',e=>{
    const close=e.target.closest('[data-close-dialog]');if(close)close.closest('dialog').close();
    const link=e.target.closest('[data-link]');if(link){const key=link.dataset.link,url=safeUrl(config.links?.[key],{local:false,connect:key==='connect'});if(url)window.open(url,'_blank','noopener,noreferrer');else message('Connection pending',`The official ${key==='connect'?'FiveM connection':key} destination has not been added yet. No link has been invented for this preview.`);}
    if(e.target.closest('[data-open-search]')){$('#search-dialog').showModal();$('#site-search').focus();renderSearch('');}
  });
  $$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
  const renderSearch=q=>{const words=q.toLowerCase().trim().split(/\s+/).filter(Boolean);const entries=(window.COSMIC_PAGES||[]).filter(p=>words.every(w=>(p.title+' '+p.description).toLowerCase().includes(w))).slice(0,12);$('#search-results').innerHTML=entries.length?entries.map(p=>`<a href="${escape(p.url)}"><b>${escape(p.title)}</b><small>${escape(p.description)}</small></a>`).join(''):'<p>No pages match that search.</p>';};
  $('#site-search')?.addEventListener('input',e=>renderSearch(e.target.value));
  let category='All';const filterGuides=()=>{const q=($('#guide-search')?.value||'').toLowerCase().trim();let shown=0;$$('[data-guide-card]').forEach(e=>{const show=(category==='All'||e.dataset.category===category)&&e.dataset.search.includes(q);e.hidden=!show;if(show)shown++;});if($('#guide-empty'))$('#guide-empty').hidden=shown>0;};
  $$('[data-guide-filter]').forEach(b=>b.addEventListener('click',()=>{category=b.dataset.guideFilter;$$('[data-guide-filter]').forEach(e=>e.setAttribute('aria-pressed',String(e===b)));filterGuides();}));
  $('#guide-search')?.addEventListener('input',filterGuides);
  $$('[data-rule-filter]').forEach(b=>b.addEventListener('click',()=>{$$('[data-rule-filter]').forEach(e=>e.setAttribute('aria-pressed',String(e===b)));$$('[data-rule-category]').forEach(e=>e.hidden=b.dataset.ruleFilter!=='all'&&e.dataset.ruleCategory!==b.dataset.ruleFilter);}));
  const addDirectory=(key,target,empty)=>{const host=$(target);if(!host)return;const entries=window.COSMIC_CONTENT?.[key]||[];for(const row of entries){if(!row?.name||!row.description)continue;const c=document.createElement('div');c.className='card';const title=document.createElement('h3');title.textContent=row.name;const description=document.createElement('p');description.textContent=row.description;c.append(title,description);const url=safeUrl(row.url);if(url){const a=document.createElement('a');a.className='text-link';a.href=url;a.textContent='More information ↗';c.append(a);}host.append(c);}if($(empty))$(empty).hidden=host.children.length>0;};
  addDirectory('businesses','#business-directory','#business-empty');addDirectory('organizations','#organization-directory','#organization-empty');
  const gallery=$('#media-gallery');if(gallery){for(const row of (window.COSMIC_CONTENT?.media||[])){const url=safeUrl(row.src);if(!url||!row.alt)continue;const figure=document.createElement('figure');figure.className='card';figure.style.margin='0';const image=document.createElement('img');image.className='media-img';image.src=url;image.alt=row.alt;image.loading='lazy';const caption=document.createElement('figcaption');caption.textContent=row.caption||'';figure.append(image,caption);gallery.append(figure);}if(gallery.children.length)$('#media-placeholders').hidden=true;}
  async function loadStatus(){
    const label=$('#server-status');if(!label)return;
    const detail=$('#status-detail'),time=$('#status-time');const endpoint=safeUrl(config.status?.endpoint,{local:false});
    const unavailable=reason=>{label.textContent='Status unavailable';detail.textContent=reason;time.textContent='No verified live player count or uptime is available.';};
    if(!endpoint){unavailable('No official monitoring endpoint has been connected.');return;}
    label.textContent='Checking...';const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),8000);
    try {const res=await fetch(endpoint,{signal:ctrl.signal,cache:'no-store',credentials:'omit'});if(!res.ok)throw new Error('The monitor did not respond successfully.');const data=await res.json();const timestamp=Date.parse(data.updatedAt),age=Date.now()-timestamp,maxAge=Math.max(30,Number(config.status?.maxAgeSeconds)||180)*1000;
      if(typeof data.online!=='boolean'||!Number.isFinite(timestamp)||age>maxAge||age< -60000)throw new Error('The latest monitoring result is missing or stale.');
      label.textContent=data.online?'Online':'Offline';detail.textContent=data.online?'The official monitor reports the server is online.':'The official monitor reports the server is offline.';
      if(data.online&&Number.isInteger(data.players)&&Number.isInteger(data.maxPlayers)&&data.players>=0&&data.maxPlayers>=data.players)detail.textContent+=` ${data.players} / ${data.maxPlayers} players.`;
      time.textContent='Monitor update: '+new Date(timestamp).toLocaleString();
    }catch(err){unavailable(err.name==='AbortError'?'The monitor timed out. Availability is unknown.':err.message||'Could not verify server availability.');}finally{clearTimeout(timer);}
  }
  $('#refresh-status')?.addEventListener('click',loadStatus);loadStatus();
})();
