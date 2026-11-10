/* Outlook UI shared component v0.1.0. Display and actions only; no transport or validation rules. */
export function mountOutlook(host, options = {}) {
  if (!(host instanceof HTMLElement)) throw new TypeError('Outlook: host missing');
  const callbacks = options.callbacks || {};
  const account = Object.assign({email:'contact@atelier-kerwen.fr',type:'imap',incomingHost:'imap.entreprise.fr',incomingPort:'993',incomingSecurity:'ssl',outgoingHost:'smtp.entreprise.fr',outgoingPort:'587',outgoingSecurity:'starttls',username:'contact@atelier-kerwen.fr',password:''},options.account || {});
  const state = {view:'mail',folder:'inbox',configOpen:false,composeOpen:false,account, messages:(options.messages||[]).map(x=>({...x})),selected:null,result:null};
  const root=document.createElement('div');root.className='ou-app';host.replaceChildren(root);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const emit=(name,data)=>{if(typeof callbacks[name]==='function') return callbacks[name](data);};
  function render(){
    root.innerHTML=`<div class="ou-top"><div class="ou-waffle" aria-hidden="true">▦</div><strong>Outlook</strong><div class="ou-search" aria-label="Rechercher">⌕ &nbsp; Rechercher</div><button class="ou-gear" data-action="settings" title="Paramètres" aria-label="Paramètres">⚙</button><div class="ou-avatar" title="Compte">AK</div></div>
    <div class="ou-shell"><nav class="ou-rail" aria-label="Applications"><button data-view="mail" class="${state.view==='mail'?'current':''}" title="Courrier" aria-label="Courrier">✉</button><button data-view="calendar" class="${state.view==='calendar'?'current':''}" title="Calendrier" aria-label="Calendrier">▦</button><button data-view="people" class="${state.view==='people'?'current':''}" title="Personnes" aria-label="Personnes">♙</button></nav>
    ${state.view==='mail'?mailHtml():state.view==='calendar'?calendarHtml():peopleHtml()}</div>
    ${state.configOpen?settingsHtml():''}${state.composeOpen?composeHtml():''}`;
  }
  function mailHtml(){
    const folders=[['inbox','Boîte de réception'],['sent','Éléments envoyés'],['drafts','Brouillons']];
    const shown=state.messages.filter(m=>(m.folder||'inbox')===state.folder);
    const selected=shown.find(m=>m.id===state.selected)||shown[0];
    return `<aside class="ou-folders"><button class="ou-new" data-action="compose">✎ &nbsp; Nouveau courrier</button><div class="ou-folder-title">Dossiers</div>${folders.map(f=>`<button class="ou-folder ${state.folder===f[0]?'selected':''}" data-folder="${f[0]}"><span>▤</span> ${f[1]} <small>${state.messages.filter(m=>(m.folder||'inbox')===f[0]).length||''}</small></button>`).join('')}</aside>
    <section class="ou-list"><div class="ou-list-title"><b>${esc(folders.find(f=>f[0]===state.folder)?.[1])}</b><small>Filtrer &nbsp;⌄</small></div>${shown.map(m=>`<button class="ou-message ${selected?.id===m.id?'active':''}" data-message="${esc(m.id)}"><span class="ou-initial">${esc((m.from||'?').slice(0,1).toUpperCase())}</span><span><strong>${esc(m.from)}</strong><b>${esc(m.subject)}</b><small>${esc((m.body||'').replace(/\s+/g,' ').slice(0,95))}</small></span><time>${esc(m.date||'')}</time></button>`).join('')||'<p class="ou-empty">Aucun message.</p>'}</section>
    <article class="ou-reading">${selected?`<h2>${esc(selected.subject)}</h2><div class="ou-from"><div class="ou-initial">${esc((selected.from||'?').slice(0,1).toUpperCase())}</div><div><b>${esc(selected.from)}</b><small>À : ${esc(selected.to||state.account.email)}</small></div></div><div class="ou-letter">${esc(selected.body||'').replace(/\n/g,'<br>')}</div><button class="ou-reply" data-action="reply">↶ &nbsp; Répondre</button>`:'<div class="ou-placeholder">Sélectionnez un élément pour le lire.</div>'}</article>`;
  }
  function calendarHtml(){
    return `<aside class="ou-folders"><div class="ou-folder-title">Calendriers</div><label class="ou-check"><input type="checkbox" checked disabled> Mon calendrier</label><label class="ou-check"><input type="checkbox" checked disabled> Équipe SAV</label></aside><section class="ou-other"><div class="ou-headline"><h2>Calendrier</h2><span>Semaine</span></div><div class="ou-cal"><div>lun.</div><div>mar.</div><div>mer.</div><div>jeu.</div><div>ven.</div><section>9 h<br><br>11 h<br><br>14 h</section><section><span>Réunion équipe<br>09:30</span></section><section></section><section><span class="shared">Suivi SAV<br>14:00</span></section><section></section></div></section>`;
  }
  function peopleHtml(){return `<aside class="ou-folders"><div class="ou-folder-title">Contacts</div><div class="ou-folder selected">Vos contacts</div><div class="ou-folder">Annuaire</div></aside><section class="ou-other"><div class="ou-headline"><h2>Personnes</h2></div><div class="ou-person"><div class="ou-initial">C</div><div><b>Camille KOENIG</b><small>camille.koenig@entreprise.fr</small></div></div><div class="ou-person"><div class="ou-initial">S</div><div><b>Sophie MARTIN</b><small>sophie.martin@entreprise.fr</small></div></div></section>`;}
  function settingsHtml(){let a=state.account;const field=(label,name,value,type='text')=>`<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" autocomplete="off"></label>`;const select=(label,name,value,items)=>`<label>${label}<select name="${name}">${items.map(([v,t])=>`<option value="${v}" ${v===value?'selected':''}>${t}</option>`).join('')}</select></label>`;return `<div class="ou-shade" data-action="close-settings"></div><section class="ou-settings" role="dialog" aria-label="Paramètres" aria-modal="true"><header><h2>Paramètres</h2><button data-action="close-settings" aria-label="Fermer">×</button></header><div class="ou-setting-body"><h3>Comptes &gt; Vos comptes</h3><p>${esc(a.email)}</p><form id="ou-account"><h4>Paramètres du compte</h4>${select('Type de compte','type',a.type,[['pop3','POP3'],['imap','IMAP'],['m365','Microsoft 365']])}<div data-protocol="standard">${field('Serveur entrant','incomingHost',a.incomingHost)}<div class="ou-fields">${field('Port entrant','incomingPort',a.incomingPort)}${select('Sécurité entrante','incomingSecurity',a.incomingSecurity,[['none','Aucune'],['ssl','SSL/TLS'],['starttls','STARTTLS']])}</div>${field('Serveur sortant (SMTP)','outgoingHost',a.outgoingHost)}<div class="ou-fields">${field('Port sortant','outgoingPort',a.outgoingPort)}${select('Sécurité sortante','outgoingSecurity',a.outgoingSecurity,[['none','Aucune'],['ssl','SSL/TLS'],['starttls','STARTTLS']])}</div></div>${field('Nom d’utilisateur','username',a.username)}${field('Mot de passe','password',a.password,'password')}<div class="ou-actions"><button class="ou-primary" type="submit">Tester la configuration</button></div></form><div class="ou-result" role="status" aria-live="polite">${state.result?esc(state.result.message):''}</div></div></section>`;}
  function composeHtml(){return `<section class="ou-compose" role="dialog" aria-label="Nouveau courrier"><header><b>Nouveau courrier</b><button data-action="close-compose" aria-label="Fermer">×</button></header><form id="ou-compose-form"><div class="ou-compose-toolbar"><button type="submit" class="ou-primary">➤ &nbsp; Envoyer</button></div><label>À <input name="to" placeholder="Ajouter un destinataire" required></label><label>Objet <input name="subject" required></label><textarea name="body" aria-label="Corps du message"></textarea><div class="ou-result" role="status">${state.result?esc(state.result.message):''}</div></form></section>`;}
  root.addEventListener('click',async e=>{
    const view=e.target.closest('[data-view]');if(view){state.view=view.dataset.view;state.configOpen=false;state.composeOpen=false;render();return;}
    const folder=e.target.closest('[data-folder]');if(folder){state.folder=folder.dataset.folder;state.selected=null;render();return;}
    const msg=e.target.closest('[data-message]');if(msg){state.selected=msg.dataset.message;render();return;}
    const act=e.target.closest('[data-action]');if(!act)return;
    const action=act.dataset.action;
    if(action==='settings'){state.configOpen=true;state.result=null;}
    if(action==='close-settings'){state.configOpen=false;state.result=null;}
    if(action==='compose'){state.composeOpen=true;state.result=null;}
    if(action==='close-compose'){state.composeOpen=false;state.result=null;}
    if(action==='reply'){state.composeOpen=true;state.result=null;}
    render();
  });
  root.addEventListener('submit',async e=>{
    if(e.target.id==='ou-account'){
      e.preventDefault();const data=Object.fromEntries(new FormData(e.target));state.account={...state.account,...data};state.result={message:'Vérification en cours...'};render();
      try {const r=await emit('onTestAccount',{...state.account});state.result=r||{message:'Test effectué.'};}
      catch(err){state.result={message:'Impossible de terminer le test.'};}
      render();
    }
    if(e.target.id==='ou-compose-form'){
      e.preventDefault();const message=Object.fromEntries(new FormData(e.target));state.result={message:'Envoi en cours...'};render();
      try{const r=await emit('onSend',message);state.result=r||{message:'Opération terminée.'};if(r?.success){state.messages.unshift({id:'sent-'+Date.now(),folder:'sent',from:state.account.email,...message,date:'Aujourd’hui'});state.composeOpen=false;state.folder='sent';state.selected=null;}}
      catch(err){state.result={message:'Échec de l’envoi.'};}
      render();
    }
  });
  root.addEventListener('change',e=>{
    if(e.target.name==='type'){const form=e.target.form;const standard=form.querySelector('[data-protocol="standard"]');if(standard)standard.hidden=e.target.value==='m365';}
  });
  function update(patch={}){if(patch.account)state.account={...state.account,...patch.account};if(patch.messages)state.messages=patch.messages.map(x=>({...x}));if(patch.result)state.result=patch.result;render();}
  render();return {update,destroy(){root.remove()},getAccount(){return {...state.account}}};
}
