/* Outlook UI shared component v0.2.1. Display and actions only; no transport or validation rules. */
export function mountOutlook(host, options = {}) {
  if (!(host instanceof HTMLElement)) throw new TypeError('Outlook: host missing');
  const callbacks = options.callbacks || {};
  const account = Object.assign({email:'contact@atelier-kerwen.fr',type:'imap',incomingHost:'imap.entreprise.fr',incomingPort:'993',incomingSecurity:'ssl',outgoingHost:'smtp.entreprise.fr',outgoingPort:'587',outgoingSecurity:'starttls',username:'contact@atelier-kerwen.fr',password:''},options.account || {});
  // Legacy username/password remain accepted for existing callers.
  account.incomingUsername ??= account.username;
  account.incomingPassword ??= account.password;
  account.outgoingUsername ??= account.incomingUsername;
  account.outgoingPassword ??= account.incomingPassword;
  account.smtpAuthMode ??= 'same';
  const state = {view:'mail',folder:'inbox',configOpen:false,composeOpen:false,account, messages:(options.messages||[]).map(x=>({...x})),selected:null,result:null,testing:false,testSeq:0};
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
  function settingsHtml(){
 const a=state.account,m365=a.type==='m365';
 const field=(label,name,type='text')=>`<label class="ou-field">${label}<input name="${name}" type="${type}" value="${esc(a[name])}" autocomplete="off"></label>`;
 const select=(label,name,items)=>`<label class="ou-field">${label}<select name="${name}">${items.map(([v,t])=>`<option value="${v}" ${a[name]===v?'selected':''}>${t}</option>`).join('')}</select></label>`;
 const security=[['none','Aucune'],['ssl','SSL/TLS'],['starttls','STARTTLS']];
 return `<div class="ou-shade" data-action="close-settings"></div><section class="ou-settings" role="dialog" aria-label="Paramètres Outlook" aria-modal="true"><header><h2>Paramètres</h2><button type="button" data-action="close-settings" aria-label="Fermer les paramètres">×</button></header><div class="ou-settings-frame"><nav class="ou-settings-nav" aria-label="Paramètres"><div class="ou-settings-nav-section">Comptes</div><div class="ou-settings-nav-active">Vos comptes</div></nav><div class="ou-setting-body"><h3>Vos comptes</h3><div class="ou-account-identity"><span class="ou-account-symbol">✉</span><div><b>${esc(a.email)}</b><small>${m365?'Microsoft 365':a.type==='pop3'?'POP3':'IMAP'}</small></div></div><form id="ou-account"><h4>Paramètres du compte</h4>${select('Type de compte','type',[['pop3','POP3'],['imap','IMAP'],['m365','Microsoft 365']])}${m365?`<div class="ou-info">Se connecter à un compte professionnel ou scolaire</div><h4 class="ou-subheading">Informations de connexion</h4>${field('Nom d’utilisateur','username')}${field('Mot de passe','password','password')}`:`<h4 class="ou-subheading">Courrier entrant (${a.type==='pop3'?'POP3':'IMAP'})</h4>${field('Serveur','incomingHost')}<div class="ou-fields">${field('Port','incomingPort')}${select('Méthode de chiffrement','incomingSecurity',security)}</div>${field('Nom d’utilisateur entrant','incomingUsername')}${field('Mot de passe entrant','incomingPassword','password')}<h4 class="ou-subheading">Courrier sortant (SMTP)</h4>${field('Serveur','outgoingHost')}<div class="ou-fields">${field('Port','outgoingPort')}${select('Méthode de chiffrement','outgoingSecurity',security)}</div>${select('Authentification SMTP','smtpAuthMode',[['same','Utiliser les identifiants du serveur entrant'],['separate','Utiliser des identifiants différents']])}${a.smtpAuthMode==='separate'?`${field('Nom d’utilisateur SMTP','outgoingUsername')}${field('Mot de passe SMTP','outgoingPassword','password')}`:''}`}<div class="ou-actions"><button class="ou-primary" type="submit" ${state.testing?'disabled':''}>${state.testing?'Connexion…':'Continuer'}</button></div></form><div class="ou-result ${state.result?.success===true?'ou-result-success':state.result?.success===false?'ou-result-error':''}" role="status" aria-live="polite">${state.result?esc(state.result.message):''}</div></div></div></section>`;
}
  function composeHtml(){return `<section class="ou-compose" role="dialog" aria-label="Nouveau courrier"><header><b>Nouveau courrier</b><button data-action="close-compose" aria-label="Fermer">×</button></header><form id="ou-compose-form"><div class="ou-compose-toolbar"><button type="submit" class="ou-primary">➤ &nbsp; Envoyer</button></div><label>À <input name="to" placeholder="Ajouter un destinataire" required></label><label>Objet <input name="subject" required></label><textarea name="body" aria-label="Corps du message"></textarea><div class="ou-result" role="status">${state.result?esc(state.result.message):''}</div></form></section>`;}
  function captureAccountFields(){const form=root.querySelector('#ou-account');if(form)state.account={...state.account,...Object.fromEntries(new FormData(form))};}
  root.addEventListener('click',async e=>{
    const view=e.target.closest('[data-view]');if(view){captureAccountFields();state.view=view.dataset.view;state.configOpen=false;state.composeOpen=false;render();return;}
    const folder=e.target.closest('[data-folder]');if(folder){state.folder=folder.dataset.folder;state.selected=null;render();return;}
    const msg=e.target.closest('[data-message]');if(msg){state.selected=msg.dataset.message;render();return;}
    const act=e.target.closest('[data-action]');if(!act)return;
    const action=act.dataset.action;if(action==='close-settings')captureAccountFields();
    if(action==='settings'){state.configOpen=true;state.result=null;}
    if(action==='close-settings'){state.configOpen=false;state.result=null;}
    if(action==='compose'){state.composeOpen=true;state.result=null;}
    if(action==='close-compose'){state.composeOpen=false;state.result=null;}
    if(action==='reply'){state.composeOpen=true;state.result=null;}
    render();
  });
  root.addEventListener('submit',async e=>{
    if(e.target.id==='ou-account'){
      e.preventDefault();if(state.testing)return;
      captureAccountFields();state.testing=true;state.result={message:'Connexion en cours…'};const sequence=++state.testSeq;
      const snapshot={...state.account};render();
      try{const response=await emit('onTestAccount',snapshot);if(sequence!==state.testSeq)return;state.result=response&&typeof response.success==='boolean'?response:{success:false,message:'La connexion n’a pas pu être vérifiée.'};}
      catch(err){if(sequence!==state.testSeq)return;state.result={success:false,message:'La connexion n’a pas pu être établie.'};}
      state.testing=false;render();
    }
    if(e.target.id==='ou-compose-form'){
      e.preventDefault();const message=Object.fromEntries(new FormData(e.target));state.result={message:'Envoi en cours...'};render();
      try{const r=await emit('onSend',message);state.result=r||{message:'Opération terminée.'};if(r?.success){state.messages.unshift({id:'sent-'+Date.now(),folder:'sent',from:state.account.email,...message,date:'Aujourd’hui'});state.composeOpen=false;state.folder='sent';state.selected=null;}}
      catch(err){state.result={message:'Échec de l’envoi.'};}
      render();
    }
  });
  root.addEventListener('change',e=>{
    if(e.target.form?.id==='ou-account'){captureAccountFields();state.testSeq++;state.testing=false;if(e.target.name==='type'||e.target.name==='smtpAuthMode'){state.result=null;render();}else if(state.result){state.result=null;const status=root.querySelector('.ou-result');if(status){status.textContent='';status.className='ou-result';}}}
  });
  function update(patch={}){if(patch.account){state.testSeq++;state.testing=false;}if(patch.account)state.account={...state.account,...patch.account};if(patch.messages)state.messages=patch.messages.map(x=>({...x}));if(patch.result)state.result=patch.result;render();}
  render();return {update,destroy(){root.remove()},getAccount(){return {...state.account}}};
}
