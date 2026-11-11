/* Outlook UI shared component v0.3.0. Display and actions only; no transport or validation rules. */
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
  const normalize=(a,i)=>({ ...account,...a,id:a.id||'acct-'+(i+1),incomingUsername:a.incomingUsername??a.username??a.email??'',incomingPassword:a.incomingPassword??a.password??'',smtpAuthMode:a.smtpAuthMode||'same' });
  const accounts=(Array.isArray(options.accounts)?options.accounts:options.account?[options.account]:[account]).map(normalize);
  const blank=()=>({id:null,email:'',type:'imap',incomingHost:'',incomingPort:'993',incomingSecurity:'ssl',outgoingHost:'',outgoingPort:'587',outgoingSecurity:'starttls',incomingUsername:'',incomingPassword:'',outgoingUsername:'',outgoingPassword:'',smtpAuthMode:'same',username:'',password:''});
  const state = {view:'mail',folder:'inbox',configOpen:false,composeOpen:false,accounts,activeId:accounts[0]?.id||null,account:accounts[0]||blank(),adding:accounts.length===0,messages:(options.messages||[]).map(x=>({...x,accountId:x.accountId||accounts[0]?.id||'acct-1'})),selected:null,result:null,testing:false,testSeq:0,sending:false,sendSeq:0,compose:{to:'',subject:'',body:''},draftId:null};
  const avatar={photoUrl:options.avatar?.photoUrl||'',initials:options.avatar?.initials||'',fallbackUrl:options.avatar?.fallbackUrl||'',alt:options.avatar?.alt||'Photo du compte'};
  function avatarHtml(){const src=avatar.photoUrl||(!avatar.initials?avatar.fallbackUrl:'');return src?`<img class="ou-avatar-photo" src="${esc(src)}" alt="${esc(avatar.alt)}">`:esc(avatar.initials||'');}
  const root=document.createElement('div');root.className='ou-app';host.replaceChildren(root);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const emit=(name,data)=>{if(typeof callbacks[name]==='function') return callbacks[name](data);};
  function render(){
    root.innerHTML=`<div class="ou-top"><div class="ou-waffle" aria-hidden="true">▦</div><strong>Outlook</strong><div class="ou-search" aria-label="Rechercher">⌕ &nbsp; Rechercher</div><button class="ou-gear" data-action="settings" title="Paramètres" aria-label="Paramètres">⚙</button><div class="ou-avatar" title="Compte">${avatarHtml()}</div></div>
    <div class="ou-shell"><nav class="ou-rail" aria-label="Applications"><button data-view="mail" class="${state.view==='mail'?'current':''}" title="Courrier" aria-label="Courrier">✉</button><button data-view="calendar" class="${state.view==='calendar'?'current':''}" title="Calendrier" aria-label="Calendrier">▦</button><button data-view="people" class="${state.view==='people'?'current':''}" title="Personnes" aria-label="Personnes">♙</button></nav>
    ${state.view==='mail'?mailHtml():state.view==='calendar'?calendarHtml():peopleHtml()}</div>
    ${state.configOpen?settingsHtml():''}${state.composeOpen?composeHtml():''}`;
  }
  function mailHtml(){
    const folders=[['inbox','Boîte de réception'],['sent','Éléments envoyés'],['drafts','Brouillons']];
    const shown=state.messages.filter(m=>(m.folder||'inbox')===state.folder&&m.accountId===state.activeId);
    const selected=shown.find(m=>m.id===state.selected)||shown[0];
    return `<aside class="ou-folders"><button class="ou-account-switch" data-action="settings">${esc(state.accounts.find(a=>a.id===state.activeId)?.email||'Ajouter un compte')}　⌄</button><button class="ou-new" data-action="compose">✎ &nbsp; Nouveau courrier</button><div class="ou-folder-title">Dossiers</div>${folders.map(f=>`<button class="ou-folder ${state.folder===f[0]?'selected':''}" data-folder="${f[0]}"><span>▤</span> ${f[1]} <small>${state.messages.filter(m=>(m.folder||'inbox')===f[0]&&m.accountId===state.activeId).length||''}</small></button>`).join('')}</aside>
    <section class="ou-list"><div class="ou-list-title"><b>${esc(folders.find(f=>f[0]===state.folder)?.[1])}</b><small>Filtrer &nbsp;⌄</small></div>${shown.map(m=>`<button class="ou-message ${selected?.id===m.id?'active':''}" data-message="${esc(m.id)}"><span class="ou-initial">${esc((m.from||'?').slice(0,1).toUpperCase())}</span><span><strong>${esc(m.from)}</strong><b>${esc(m.subject)}</b><small>${esc((m.body||'').replace(/\s+/g,' ').slice(0,95))}</small></span><time>${esc(m.date||'')}</time></button>`).join('')||'<p class="ou-empty">Aucun message.</p>'}</section>
    <article class="ou-reading">${selected?`<h2>${esc(selected.subject)}</h2><div class="ou-from"><div class="ou-initial">${esc((selected.from||'?').slice(0,1).toUpperCase())}</div><div><b>${esc(selected.from)}</b><small>À : ${esc(selected.to||state.account.email)}</small></div></div><div class="ou-letter">${esc(selected.body||'').replace(/\n/g,'<br>')}</div><div class="ou-reading-actions"><button class="ou-reply" data-action="reply">↶ &nbsp; Répondre</button><button class="ou-reply" data-action="forward">↪ &nbsp; Transférer</button></div>`:'<div class="ou-placeholder">Sélectionnez un élément pour le lire.</div>'}</article>`;
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
 return `<div class="ou-shade" data-action="close-settings"></div><section class="ou-settings" role="dialog" aria-label="Paramètres Outlook" aria-modal="true"><header><h2>Paramètres</h2><button type="button" data-action="close-settings" aria-label="Fermer les paramètres">×</button></header><div class="ou-settings-frame"><nav class="ou-settings-nav" aria-label="Paramètres"><div class="ou-settings-nav-section">Comptes</div><div class="ou-settings-nav-active">Vos comptes</div></nav><div class="ou-setting-body"><h3>Vos comptes</h3><div class="ou-account-list">${state.accounts.map(x=>`<button type="button" data-account="${esc(x.id)}" class="ou-account-choice ${x.id===state.activeId&&!state.adding?'selected':''}">✉ &nbsp; ${esc(x.email)}</button>`).join('')}<button type="button" data-action="add-account" class="ou-account-add">＋ Ajouter un compte</button></div><div class="ou-account-identity"><span class="ou-account-symbol">✉</span><div><b>${esc(a.email||'Nouveau compte')}</b><small>${m365?'Microsoft 365':a.type==='pop3'?'POP3':'IMAP'}</small></div></div><form id="ou-account"><h4>${state.adding?'Ajouter un compte':'Paramètres du compte'}</h4>${field('Adresse e-mail','email')}${select('Type de compte','type',[['pop3','POP3'],['imap','IMAP'],['m365','Microsoft 365']])}${m365?`<div class="ou-info">Se connecter à un compte professionnel ou scolaire</div><h4 class="ou-subheading">Informations de connexion</h4>${field('Nom d’utilisateur','username')}${field('Mot de passe','password','password')}`:`<h4 class="ou-subheading">Courrier entrant (${a.type==='pop3'?'POP3':'IMAP'})</h4>${field('Serveur','incomingHost')}<div class="ou-fields">${field('Port','incomingPort')}${select('Méthode de chiffrement','incomingSecurity',security)}</div>${field('Nom d’utilisateur entrant','incomingUsername')}${field('Mot de passe entrant','incomingPassword','password')}<h4 class="ou-subheading">Courrier sortant (SMTP)</h4>${field('Serveur','outgoingHost')}<div class="ou-fields">${field('Port','outgoingPort')}${select('Méthode de chiffrement','outgoingSecurity',security)}</div>${select('Authentification SMTP','smtpAuthMode',[['same','Utiliser les identifiants du serveur entrant'],['separate','Utiliser des identifiants différents']])}${a.smtpAuthMode==='separate'?`${field('Nom d’utilisateur SMTP','outgoingUsername')}${field('Mot de passe SMTP','outgoingPassword','password')}`:''}`}<div class="ou-actions"><button class="ou-primary" type="submit" ${state.testing?'disabled':''}>${state.testing?'Connexion…':state.adding?'Ajouter le compte':'Continuer'}</button></div></form><div class="ou-result ${state.result?.success===true?'ou-result-success':state.result?.success===false?'ou-result-error':''}" role="status" aria-live="polite">${state.result?esc(state.result.message):''}</div></div></div></section>`;
}
  function composeHtml(){const d=state.compose;return `<section class="ou-compose" role="dialog" aria-label="Nouveau courrier"><header><b>Nouveau courrier</b><button data-action="close-compose" aria-label="Fermer">×</button></header><form id="ou-compose-form"><div class="ou-compose-toolbar"><button type="submit" class="ou-primary" ${state.sending?'disabled':''}>➤ &nbsp; ${state.sending?'Envoi…':'Envoyer'}</button><button type="button" data-action="save-draft" class="ou-secondary">Enregistrer le brouillon</button><button type="button" data-action="discard-draft" class="ou-trash" title="Supprimer le brouillon">⌫</button></div><div class="ou-compose-row"><label for="ou-to">À</label><input id="ou-to" name="to" value="${esc(d.to)}" placeholder="Ajouter un destinataire" required></div><div class="ou-compose-row"><label for="ou-subject">Objet</label><input id="ou-subject" name="subject" value="${esc(d.subject)}" required></div><textarea name="body" aria-label="Corps du message" placeholder="Rédigez votre message…">${esc(d.body)}</textarea><div class="ou-result" role="status">${state.result?esc(state.result.message):''}</div></form></section>`;}
  function captureAccountFields(){const form=root.querySelector('#ou-account');if(!form)return;Object.assign(state.account,Object.fromEntries(new FormData(form)));}
  function switchAccount(id){captureAccountFields();const a=state.accounts.find(x=>x.id===id);if(!a)return;state.account=a;state.activeId=id;state.adding=false;state.result=null;state.testSeq++;state.testing=false;state.selected=null;state.folder='inbox';if(state.composeOpen){saveDraft();state.composeOpen=false;}}
  function startAccount(){captureAccountFields();state.account=blank();state.adding=true;state.result=null;state.testSeq++;state.testing=false;}
  function captureCompose(){const form=root.querySelector('#ou-compose-form');if(form)state.compose={...state.compose,...Object.fromEntries(new FormData(form))};}
  function openCompose(d=null){state.compose=d?{to:d.to||'',subject:d.subject||'',body:d.body||''}:{to:'',subject:'',body:''};state.draftId=d?.id||null;state.composeOpen=true;state.result=null;}
  function saveDraft(){captureCompose();const d=state.compose;if(!d.to.trim()&&!d.subject.trim()&&!d.body.trim())return;let item=state.messages.find(m=>m.id===state.draftId&&m.folder==='drafts');if(!item){item={id:'draft-'+(++state.sendSeq),folder:'drafts',from:state.account.email,accountId:state.activeId};state.messages.unshift(item);state.draftId=item.id;}Object.assign(item,d,{date:'Brouillon'});emit('onDraftSave',{...d,id:item.id,accountId:state.activeId});}
  root.addEventListener('error',e=>{if(e.target.matches('.ou-avatar-photo')){e.target.replaceWith(document.createTextNode(avatar.initials||''));}},true);
  root.addEventListener('click',async e=>{
    const view=e.target.closest('[data-view]');if(view){captureAccountFields();state.view=view.dataset.view;state.configOpen=false;state.composeOpen=false;render();return;}
    const folder=e.target.closest('[data-folder]');if(folder){state.folder=folder.dataset.folder;state.selected=null;render();return;}
    const accountChoice=e.target.closest('[data-account]');if(accountChoice){switchAccount(accountChoice.dataset.account);render();return;}
    const msg=e.target.closest('[data-message]');if(msg){state.selected=msg.dataset.message;if(state.folder==='drafts'){const d=state.messages.find(m=>m.id===state.selected);if(d)openCompose(d);}render();return;}
    const act=e.target.closest('[data-action]');if(!act)return;
    const action=act.dataset.action;if(action==='close-settings')captureAccountFields();
    if(action==='settings'){state.configOpen=true;state.result=null;}
    if(action==='close-settings'){state.configOpen=false;state.result=null;}
    if(action==='compose'){openCompose();}
    if(action==='close-compose'){saveDraft();state.composeOpen=false;state.result=null;state.sending=false;state.sendSeq++;}
    if(action==='reply'||action==='forward'){const m=state.messages.find(x=>x.id===state.selected)||state.messages.find(x=>x.folder===state.folder&&x.accountId===state.activeId);if(m)openCompose({to:action==='reply'?(m.replyTo||m.email||m.from||''):'',subject:(action==='reply'?'RE: ':'TR: ')+(m.subject||''),body:'\n\nDe : '+(m.from||'')+'\nObjet : '+(m.subject||'')+'\n\n'+(m.body||'')});}
    if(action==='add-account')startAccount();
    if(action==='save-draft'){saveDraft();state.composeOpen=false;state.folder='drafts';state.selected=state.draftId;state.result=null;}
    if(action==='discard-draft'){if(state.draftId)state.messages=state.messages.filter(m=>m.id!==state.draftId);state.composeOpen=false;state.draftId=null;state.result=null;emit('onDraftDiscard');}
    render();
  });
  root.addEventListener('submit',async e=>{
    if(e.target.id==='ou-account'){
      e.preventDefault();if(state.testing)return;
      captureAccountFields();state.testing=true;state.result={message:'Connexion en cours…'};const sequence=++state.testSeq;
      const snapshot={...state.account};render();
      try{const response=await emit('onTestAccount',snapshot);if(sequence!==state.testSeq)return;state.result=response&&typeof response.success==='boolean'?response:{success:false,message:'La connexion n’a pas pu être vérifiée.'};}
      catch(err){if(sequence!==state.testSeq)return;state.result={success:false,message:'La connexion n’a pas pu être établie.'};}
      if(state.adding&&state.result?.success){const created={...state.account,id:'acct-'+(Date.now())};state.accounts.push(created);state.activeId=created.id;state.account=created;state.adding=false;state.folder='inbox';emit('onAccountAdded',{...created});}
      state.testing=false;render();
    }
    if(e.target.id==='ou-compose-form'){
      e.preventDefault();if(state.sending)return;captureCompose();const message={...state.compose};state.sending=true;state.result={message:'Envoi en cours…'};const seq=++state.sendSeq;render();
      try{const result=await emit('onSend',{...message,accountId:state.activeId,from:state.account.email});if(seq!==state.sendSeq)return;state.result=result||{success:false,message:'Envoi impossible.'};if(result?.success){if(state.draftId)state.messages=state.messages.filter(m=>m.id!==state.draftId);state.messages.unshift({id:'sent-'+seq,folder:'sent',from:state.account.email,accountId:state.activeId,...message,date:'Aujourd’hui'});state.composeOpen=false;state.folder='sent';state.selected=null;state.draftId=null;state.result=null;}}
      catch(err){state.result={success:false,message:'Le message n’a pas pu être envoyé.'};}
      state.sending=false;render();
    }
  });
  root.addEventListener('change',e=>{
    if(e.target.form?.id==='ou-account'){captureAccountFields();state.testSeq++;state.testing=false;if(e.target.name==='type'||e.target.name==='smtpAuthMode'){state.result=null;render();}else if(state.result){state.result=null;const status=root.querySelector('.ou-result');if(status){status.textContent='';status.className='ou-result';}}}
  });
  function update(patch={}){captureCompose();if(patch.avatar)Object.assign(avatar,patch.avatar);if(patch.account){state.testSeq++;state.testing=false;}if(patch.account)state.account={...state.account,...patch.account};if(patch.messages)state.messages=patch.messages.map(x=>({...x}));if(patch.result)state.result=patch.result;render();}
  render();return {update,destroy(){root.remove()},getAccount(){return {...state.account}},getAccounts(){return state.accounts.map(a=>({...a}))}};
}
