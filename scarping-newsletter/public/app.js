const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const state = { leads: [], campaigns: [] };
const labels = { new:'Nuovo', qualified:'Qualificato', contacted:'Contattato', won:'Acquisito', lost:'Perso' };

async function api(path, options = {}) {
  const response = await fetch(path, { headers:{ 'Content-Type':'application/json' }, ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Operazione non riuscita');
  return data;
}
function toast(message, error = false) { const el=$('#toast'); el.textContent=message; el.style.background=error?'#a23f3f':'#18252e'; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),3000); }
function escapeHtml(value='') { const d=document.createElement('div'); d.textContent=value; return d.innerHTML; }
function initials(name='') { return name.split(/\s+/).slice(0,2).map(v=>v[0]).join('').toUpperCase(); }

async function dashboard() {
  const data=await api('/api/dashboard'); const s=data.stats||{};
  $('#stat-total').textContent=s.total||0; $('#stat-new').textContent=s.nuovi||0; $('#stat-contacted').textContent=s.contattati||0; $('#stat-won').textContent=s.acquisiti||0;
  const recent=$('#recent-list'); recent.classList.toggle('empty',!data.recent.length); recent.innerHTML=data.recent.length?data.recent.map(l=>`<div class="recent-row"><div class="company"><span class="avatar">${initials(l.company)}</span><div><b>${escapeHtml(l.company)}</b><small>${escapeHtml(l.category||'Settore non indicato')} · ${escapeHtml(l.city||'—')}</small></div></div><span class="badge ${l.status}">${labels[l.status]}</span><span class="score">${l.score}/100</span></div>`).join(''):'Nessun lead presente';
  const sectors=$('#sector-list'); const max=Math.max(...data.sectors.map(s=>s.value),1); sectors.classList.toggle('empty',!data.sectors.length); sectors.innerHTML=data.sectors.length?data.sectors.map(s=>`<div class="sector-item"><div><span>${escapeHtml(s.label)}</span><b>${s.value}</b></div><div class="bar"><i style="width:${s.value/max*100}%"></i></div></div>`).join(''):'I dati appariranno qui';
}
async function loadLeads() {
  const q=encodeURIComponent($('#lead-search').value); const status=encodeURIComponent($('#status-filter').value);
  state.leads=await api(`/api/leads?q=${q}&status=${status}`); const tbody=$('#leads-table'); $('#leads-empty').style.display=state.leads.length?'none':'block';
  tbody.innerHTML=state.leads.map(l=>`<tr><td><div class="company"><span class="avatar">${initials(l.company)}</span><div><b>${escapeHtml(l.company)}</b><small>${escapeHtml(l.category||'—')}</small></div></div></td><td>${l.email?`<a href="mailto:${escapeHtml(l.email)}">${escapeHtml(l.email)}</a>`:''}${l.phone?`<a href="tel:${escapeHtml(l.phone)}">${escapeHtml(l.phone)}</a>`:''}${!l.email&&!l.phone?'—':''}</td><td>${escapeHtml(l.city||'—')}<small style="display:block;color:#87949a">${escapeHtml(l.address||'')}</small></td><td><a href="${escapeHtml(l.source_url||l.website||'#')}" target="_blank" rel="noopener">${escapeHtml(l.source)}</a></td><td><span class="score">${l.score}</span></td><td><select class="status-select" data-status="${l.id}">${Object.entries(labels).map(([v,k])=>`<option value="${v}" ${l.status===v?'selected':''}>${k}</option>`).join('')}</select></td><td><button class="icon-btn" data-delete="${l.id}" title="Elimina">×</button></td></tr>`).join('');
}
async function loadCampaigns() {
  state.campaigns=await api('/api/campaigns');
  $$('.campaign-select').forEach(select=>{const value=select.value;select.innerHTML='<option value="">Nessuna campagna</option>'+state.campaigns.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');select.value=value});
  $('#campaign-grid').innerHTML=state.campaigns.length?state.campaigns.map(c=>`<article class="campaign-card"><div class="campaign-icon">◫</div><h3>${escapeHtml(c.name)}</h3><p>${escapeHtml(c.sector||'Tutti i settori')} · ${escapeHtml(c.location||'Tutte le località')}</p><div class="campaign-meta"><span>${c.lead_count} lead</span><span class="badge ${c.status==='active'?'won':''}">${c.status==='active'?'Attiva':c.status}</span></div></article>`).join(''):'<div class="panel empty">Non hai ancora creato campagne.</div>';
}
function go(view) { $$('.view').forEach(v=>v.classList.toggle('active',v.id===view)); $$('.nav-item').forEach(v=>v.classList.toggle('active',v.dataset.view===view)); const titles={dashboard:'Buongiorno 👋',leads:'Database lead',discover:'Ricerca clienti',campaigns:'Le tue campagne'};$('#page-title').textContent=titles[view]; if(view==='leads')loadLeads();if(view==='dashboard')dashboard();if(view==='campaigns')loadCampaigns(); }

$$('.nav-item').forEach(b=>b.addEventListener('click',()=>go(b.dataset.view))); $$('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go))); $$('[data-open]').forEach(b=>b.addEventListener('click',()=>$('#'+b.dataset.open).showModal()));
$('#lead-form').addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/leads',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});e.target.reset();$('#lead-modal').close();toast('Lead salvato');dashboard()}catch(err){toast(err.message,true)}});
$('#campaign-form').addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/campaigns',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});e.target.reset();$('#campaign-modal').close();toast('Campagna creata');await loadCampaigns()}catch(err){toast(err.message,true)}});
$('#discover-form').addEventListener('submit',async e=>{e.preventDefault();const button=$('button[type=submit]',e.target);button.disabled=true;button.textContent='Ricerca in corso…';$('#result-title').textContent='Sto cercando…';$('#result-copy').textContent='Interrogo le fonti pubbliche e rimuovo i duplicati.';try{const data=await api('/api/discover',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});$('#result-title').textContent=`${data.imported} aziende trovate`;$('#result-copy').textContent='I contatti sono stati aggiunti al database.';$('#result-preview').innerHTML=data.leads.slice(0,5).map(l=>`<div class="preview-lead"><b>${escapeHtml(l.company)}</b><br><span>${escapeHtml(l.city)} · ${escapeHtml(l.phone||l.website||'contatto da arricchire')}</span></div>`).join('');toast(`${data.imported} lead importati`);dashboard()}catch(err){$('#result-title').textContent='Ricerca non completata';$('#result-copy').textContent=err.message;toast(err.message,true)}finally{button.disabled=false;button.textContent='⌕ Cerca nuove aziende'}});
$('#import-form').addEventListener('submit',async e=>{e.preventDefault();try{const fd=new FormData(e.target);const csv=await fd.get('file').text();const data=await api('/api/import',{method:'POST',body:JSON.stringify({csv,campaign_id:fd.get('campaign_id')})});$('#import-modal').close();e.target.reset();toast(`${data.imported} contatti importati`);dashboard()}catch(err){toast(err.message,true)}});
$('#lead-search').addEventListener('input',()=>{clearTimeout(window.searchTimer);window.searchTimer=setTimeout(loadLeads,250)});$('#status-filter').addEventListener('change',loadLeads);
$('#leads-table').addEventListener('change',async e=>{if(e.target.dataset.status){await api(`/api/leads/${e.target.dataset.status}`,{method:'PATCH',body:JSON.stringify({status:e.target.value})});toast('Stato aggiornato')}});
$('#leads-table').addEventListener('click',async e=>{if(e.target.dataset.delete&&confirm('Eliminare questo lead?')){await api(`/api/leads/${e.target.dataset.delete}`,{method:'DELETE'});toast('Lead eliminato');loadLeads()}});
$('#export-csv').addEventListener('click',()=>{const fields=['company','category','city','address','website','email','phone','source','status','score'];const quote=v=>`"${String(v??'').replaceAll('"','""')}"`;const csv=[fields.join(','),...state.leads.map(l=>fields.map(f=>quote(l[f])).join(','))].join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='leadforge-export.csv';a.click();URL.revokeObjectURL(a.href)});

await Promise.all([dashboard(),loadCampaigns()]);
