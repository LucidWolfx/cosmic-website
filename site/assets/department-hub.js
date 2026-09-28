'use strict';
(() => {
  const E=window.CosmicUI.escape;
  const STATES={active:'Active',training:'In training',reserve:'Reserve',leave:'On leave'};
  let generation=0,timer;
  function unmount(){generation++;clearInterval(timer);}
  async function mount(host,client){
    unmount();const ticket=generation;let current=null,snapshot=null,archived=false,rosterOffset=0,noticeOffset=0,busy=false;
    const active=()=>ticket===generation&&host.isConnected;
    const stamp=value=>new Date(value).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
    const api=async(action,payload={},department=current?.id)=>{
      const {data,error}=await client.functions.invoke('department-hub',{body:{action,department,payload}});
      if(error){let message='Department access could not be checked. Please try again.';let status=error.context?.status;
        try{const body=await error.context.json();message=body.error||message;}catch{}
        const problem=new Error(message);problem.status=status;throw problem;
      }
      return data;
    };
    function fail(error){if(!active())return;snapshot=null;host.innerHTML=`<div class="empty-state"><h3>Department unavailable</h3><p>${E(error.message)}</p><button class="button" data-hub-retry>Check access again</button></div>`;host.querySelector('[data-hub-retry]').onclick=()=>{current=null;directory();};}
    function setMessage(message,bad=false){const box=host.querySelector('[data-hub-message]');if(box){box.textContent=message;box.classList.toggle('error',bad);}}
    async function directory(){
      host.innerHTML='<div class="notice" role="status">Checking your Discord department roles...</div>';
      try{const data=await api('list',{},null);if(!active())return;
        host.innerHTML=`<div class="department-hub"><p class="hub-intro">Your department workspace. Access follows your roles in the Cosmic Discord server.</p>${data.departments.length?`<div class="grid-2">${data.departments.map(d=>`<article class="card"><span class="eyebrow">INTERNAL DEPARTMENT</span><h3>${E(d.name)}</h3><p>Notices, the employee roster, and department updates.</p><p class="hub-access">${d.can_edit?'Command access':'Department member'}</p><button class="button primary" data-hub-open="${E(d.id)}">Open department ↗</button></article>`).join('')}</div>`:'<div class="empty-state"><h3>No department access yet.</h3><p>You need your department’s Discord role to open its internal workspace.</p><button class="button" data-hub-retry>Check my roles again</button></div>'}</div>`;
        host.querySelectorAll('[data-hub-open]').forEach(b=>b.onclick=()=>{current=data.departments.find(d=>d.id===b.dataset.hubOpen);rosterOffset=noticeOffset=0;archived=false;load();});
        host.querySelector('[data-hub-retry]')?.addEventListener('click',directory);
      }catch(error){fail(error);}
    }
    async function load(message='',quiet=false){
      if(!active())return;busy=true;
      // Clear previous private content before refreshing access, including failures.
      if(!quiet)host.innerHTML='<div class="notice" role="status">Opening your department...</div>';
      try{const data=await api('read',{roster_offset:rosterOffset,notice_offset:noticeOffset,archived});if(!active())return;
        snapshot=data;current=data.department;if(!current.can_edit)archived=false;draw();if(message)setMessage(message);
      }catch(error){fail(error);}finally{busy=false;}
    }
    function draw(){
      const edit=current.can_edit;
      host.innerHTML=`<div class="department-hub">
        <section class="hub-heading"><div><span class="eyebrow">INTERNAL / ${edit?'COMMAND':'MEMBER'} ACCESS</span><h2>${E(current.name)}</h2><p>Updates and people. Everything your department needs in one place.</p></div><button class="button small" data-hub-back>My departments</button></section>
        <div class="hub-toolbar"><button class="button small" data-hub-refresh>Refresh</button>${edit?`<label class="hub-archive-filter"><input type="checkbox" data-hub-archived ${archived?'checked':''}> Show archived entries</label>`:''}</div>
        <p class="message" data-hub-message aria-live="polite"></p><div data-hub-editor></div>
        <section class="hub-section" aria-labelledby="hub-notices-title"><div class="hub-section-heading"><div><span class="eyebrow">DEPARTMENT UPDATES</span><h2 id="hub-notices-title">${archived?'Archived notices':'Notice board'}</h2></div>${edit&&!archived?'<button class="button primary small" data-hub-add-notice>New notice</button>':''}</div>
          ${snapshot.notices.length?snapshot.notices.map(n=>`<article class="card hub-notice"><div class="hub-notice-meta">${n.pinned?'<span class="pill">Pinned</span>':''}${!n.published?'<span class="pill">Draft</span>':''}<span>Updated ${E(stamp(n.updated_at))}</span></div><h3>${E(n.title)}</h3><div class="hub-notice-body">${E(n.body)}</div>${edit?`<div class="button-row">${!archived?`<button class="button small" data-hub-edit-notice="${E(n.id)}">Edit</button>`:''}<button class="button small" data-hub-archive-notice="${E(n.id)}">${archived?'Restore':'Archive'}</button></div>`:''}</article>`).join(''):'<div class="empty-state"><h3>No notices here yet.</h3><p>'+ (edit?'Use New notice to prepare a draft or publish an update.':'Published department updates will appear here.')+'</p></div>'}
          <div class="pager"><button class="button small" data-hub-notices-prev ${noticeOffset?'':'disabled'}>Previous notices</button><button class="button small" data-hub-notices-next ${snapshot.notices_more?'':'disabled'}>Next notices</button></div>
        </section>
        <section class="hub-section" aria-labelledby="hub-roster-title"><div class="hub-section-heading"><div><span class="eyebrow">THE PEOPLE BEHIND THE BADGE</span><h2 id="hub-roster-title">${archived?'Archived roster':'Employee roster'}</h2></div></div>
          ${snapshot.roster.length?`<div class="hub-roster">${snapshot.roster.map(r=>`<article class="hub-employee"><div><span class="hub-callsign">${E(r.callsign||'No call sign')}</span><h3>${E(r.name)}</h3><p>${E(r.rank)}${r.division?' · '+E(r.division):''}</p>${r.discord_id&&/^[0-9]{17,20}$/.test(r.discord_id)?`<p class="hub-discord"><a href="https://discord.com/users/${E(r.discord_id)}" target="_blank" rel="noopener noreferrer">Discord: ${E(r.discord_name||r.discord_id)} ↗</a><small>${E(r.discord_id)}</small></p>`:'<p class="muted-text">Legacy entry: no Discord account linked</p>'}${r.archive_reason==='discord_left'?'<p class="hub-departure">Left the Discord server</p>':''}</div><span class="pill">${E(STATES[r.status]||r.status)}</span>${edit?`<div class="button-row">${!archived?`<button class="button small" data-hub-edit-roster="${E(r.id)}">Edit</button>`:''}${archived&&r.archive_reason==='discord_left'?'<span class="muted-text">New approval required</span>':`<button class="button small" data-hub-archive-roster="${E(r.id)}">${archived?'Restore':'Archive'}</button>`}</div>`:''}</article>`).join('')}</div>`:'<div class="empty-state"><h3>No roster entries here yet.</h3><p>'+ (edit?'Approve a department application to add a Discord-linked employee.':'The command team will publish the department roster here.')+'</p></div>'}
          <div class="pager"><button class="button small" data-hub-roster-prev ${rosterOffset?'':'disabled'}>Previous employees</button><button class="button small" data-hub-roster-next ${snapshot.roster_more?'':'disabled'}>Next employees</button></div>
        </section></div>`;
      const on=(selector,fn)=>host.querySelector(selector)?.addEventListener('click',fn);
      on('[data-hub-back]',()=>{current=null;directory();});on('[data-hub-refresh]',()=>load());
      host.querySelector('[data-hub-archived]')?.addEventListener('change',e=>{archived=e.target.checked;rosterOffset=noticeOffset=0;load();});
      on('[data-hub-add-notice]',()=>editor('notice'));on('[data-hub-add-roster]',()=>editor('roster'));
      for(const kind of ['notice','roster']){
        const entries=kind==='notice'?snapshot.notices:snapshot.roster;
        host.querySelectorAll(`[data-hub-edit-${kind}]`).forEach(b=>b.onclick=()=>editor(kind,entries.find(x=>x.id===b.getAttribute(`data-hub-edit-${kind}`))));
        host.querySelectorAll(`[data-hub-archive-${kind}]`).forEach(b=>b.onclick=async()=>{
          const row=entries.find(x=>x.id===b.getAttribute(`data-hub-archive-${kind}`));
          if(!confirm(`${archived?'Restore':'Archive'} this ${kind==='notice'?'notice':'employee'}? ${archived?'It will return to the active list.':'It can be restored from the archive.'}`))return;
          b.disabled=true;try{await api(kind+'_archive',{id:row.id,revision:row.revision,archived:!archived});if(active())await load(archived?'Entry restored.':'Entry archived.');}catch(error){if(error.status===401||error.status===403||error.status===503)fail(error);else{setMessage(error.message,true);b.disabled=false;}}
        });
      }
      on('[data-hub-notices-prev]',()=>{noticeOffset=Math.max(0,noticeOffset-20);load();});on('[data-hub-notices-next]',()=>{noticeOffset+=20;load();});
      on('[data-hub-roster-prev]',()=>{rosterOffset=Math.max(0,rosterOffset-50);load();});on('[data-hub-roster-next]',()=>{rosterOffset+=50;load();});
    }
    function editor(kind,row={}){
      if(!current.can_edit)return;const target=host.querySelector('[data-hub-editor]');
      target.innerHTML=`<form class="card hub-editor"><h3>${row.id?'Edit':kind==='notice'?'New':'Add'} ${kind==='notice'?'notice':'employee'}</h3>${kind==='notice'?`
        <label class="field">Title<input name="title" minlength="3" maxlength="120" required value="${E(row.title||'')}"></label><label class="field">Notice<textarea name="body" maxlength="8000" required>${E(row.body||'')}</textarea></label>
        <label class="checkbox field"><input name="pinned" type="checkbox" ${row.pinned?'checked':''}><span>Pin this notice</span></label><label class="checkbox field"><input name="published" type="checkbox" ${row.published?'checked':''}><span>Publish to department members (leave unchecked to save a command-only draft)</span></label>`:`
        <p>Use roleplay details for the employee roster.</p><div class="grid-2"><label class="field">Character name<input name="name" minlength="2" maxlength="80" required value="${E(row.name||'')}"></label><label class="field">Rank<input name="rank" maxlength="60" required value="${E(row.rank||'')}"></label><label class="field">Call sign<input name="callsign" maxlength="24" value="${E(row.callsign||'')}"></label><label class="field">Division<input name="division" maxlength="80" value="${E(row.division||'')}"></label></div><label class="field">Status<select name="status">${Object.entries(STATES).map(([key,label])=>`<option value="${key}" ${(row.status||'active')===key?'selected':''}>${label}</option>`).join('')}</select></label>`}
        <div class="button-row"><button class="button primary" type="submit">Save ${kind==='notice'?'notice':'employee'}</button><button class="button" type="button" data-hub-cancel>Cancel</button></div><p class="message" data-editor-message role="status"></p></form>`;
      const form=target.querySelector('form');form.querySelector('[data-hub-cancel]').onclick=()=>{target.innerHTML='';};form.querySelector('input')?.focus();
      form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('[type="submit"]');button.disabled=true;
        const fields=new FormData(form),payload=Object.fromEntries(fields);if(row.id){payload.id=row.id;payload.revision=row.revision;}
        if(kind==='notice'){payload.pinned=form.elements.pinned.checked;payload.published=form.elements.published.checked;}
        try{await api(kind+'_save',payload);if(active())await load(kind==='notice'?(payload.published?'Notice published.':'Draft saved.'):'Roster updated.');}
        catch(error){if(error.status===401||error.status===403||error.status===503)fail(error);else if(active()){form.querySelector('[data-editor-message]').textContent=error.message;button.disabled=false;}}
      };
    }
    await directory();
    if(active())timer=setInterval(async()=>{if(!active()||!current||busy||document.hidden)return;try{
      const data=await api('list',{},null);if(!active())return;const allowed=data.departments.find(d=>d.id===current?.id);
      if(!allowed)throw new Error('Your Discord role no longer grants department access.');
      if(current.can_edit&&!allowed.can_edit)await load('Your account now has read-only department access.');
      else if(!host.querySelector('form'))await load('',true);
    }catch(error){fail(error);}},60000);
  }
  function configureReview(form,application){
    if(application?.kind!=='department')return;
    form.dataset.department=application.department_id||application.answers?.department||'';
    const panel=document.createElement('fieldset');panel.className='card hub-editor';panel.dataset.enrollment='';
    panel.innerHTML='<legend>Department employee details</legend><p>Approval adds this character to the roster and links the applicant’s verified Discord account automatically. Department access and command roles are required.</p><div class="grid-2"><label class="field">Character name<input name="employee_name" minlength="2" maxlength="80" required></label><label class="field">Call sign<input name="employee_callsign" maxlength="24" required></label><label class="field">Rank<input name="employee_rank" maxlength="60" required></label><label class="field">Division<input name="employee_division" maxlength="80"></label></div><label class="field">Employee status<select name="employee_status"><option value="training">In training</option><option value="active">Active</option><option value="reserve">Reserve</option><option value="leave">On leave</option></select></label>';
    form.querySelector('[name="decision"]').closest('label').after(panel);
    const toggle=()=>{const show=form.elements.decision.value==='approved';panel.hidden=!show;panel.disabled=!show;};
    form.elements.decision.addEventListener('change',toggle);toggle();
  }
  async function approve(client,form){
    const fields=new FormData(form),roster=Object.fromEntries(['name','callsign','rank','division','status'].map(key=>[key,fields.get('employee_'+key)]));
    const {data,error}=await client.functions.invoke('department-hub',{body:{action:'approve',department:form.dataset.department,payload:{application_id:form.dataset.id,roster,feedback:fields.get('feedback')||''}}});
    if(error){let message='Department approval could not be confirmed. Refresh the queue before retrying.';try{message=(await error.context.json()).error||message;}catch{}throw new Error(message);}
    return data;
  }
  window.CosmicDepartments={mount,unmount,configureReview,approve};
})();
