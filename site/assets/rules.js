'use strict';
(() => {
  const rows=[...document.querySelectorAll('[data-rule-category]')];
  const buttons=[...document.querySelectorAll('[data-rules-category]')];
  const search=document.getElementById('rule-search');
  if(!rows.length||!search)return;
  let category='all';
  const filter=()=>{
    const query=search.value.toLowerCase().trim();let visible=0;
    for(const row of rows){
      row.hidden=(category!=='all'&&row.dataset.ruleCategory!==category)||!row.textContent.toLowerCase().includes(query);
      if(!row.hidden){visible++;if(query)row.open=true;}
    }
    document.getElementById('rules-count').textContent=`${visible} of ${rows.length} rules`;
    document.getElementById('rules-empty').hidden=visible>0;
  };
  const select=value=>{category=value;buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.rulesCategory===value)));filter();};
  buttons.forEach(button=>button.addEventListener('click',()=>select(button.dataset.rulesCategory)));
  search.addEventListener('input',filter);
  document.getElementById('rules-expand').addEventListener('click',()=>rows.filter(row=>!row.hidden).forEach(row=>row.open=true));
  document.getElementById('rules-collapse').addEventListener('click',()=>rows.filter(row=>!row.hidden).forEach(row=>row.open=false));
  const reveal=()=>{
    let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}
    const row=rows.find(row=>row.id===id);if(!row)return;
    search.value='';select('all');row.open=true;row.scrollIntoView({block:'start'});
  };
  window.addEventListener('hashchange',reveal);
  document.getElementById('rules-tools').hidden=false;
  document.getElementById('rules-filters').hidden=false;
  filter();reveal();
})();
