/* Adaptateur autonome R2D3 / Outlook partagé, sans modifier le composant. */
import {createMailEngine, restoreMailEngine} from "./mail-core.js";
import {mountOutlook} from "../shared-ui/v1/outlook.js";

export function connectMailOutlook(host, scenario, options = {}) {
  let engine = options.engine || createMailEngine(scenario);
  let outlook;
  // Outlook lit directement accountEmail et la date ISO créée par R2D3.
  const messages = () => engine.getSnapshot().messages;
  const sync = () => outlook?.update({messages:messages()});
  const callbacks = {
    async onTestAccount(account) {
      const result = engine.validateAccount(account);
      return {success:result.success, message:result.message, code:result.code};
    },
    async onSend(mail) {
      const result=engine.send({
        from:mail.from, to:mail.to, subject:mail.subject, body:mail.body
      });
      // La mise à jour est effectuée avant que le callback d'envoi se termine :
      // Outlook n'ajoute ni envoyé ni reçu en mode external.
      if(result.success) sync();
      return {success:result.success, message:result.message, code:result.code};
    },
    onMessageRead({id}) {
      const result=engine.markRead(id);
      // Synchronisation différée pour éviter un render imbriqué dans le click Outlook.
      if(result.success) queueMicrotask(sync);
    },
    onAccountAdded(){queueMicrotask(sync);},
    async onRestoreArchive({accountEmail,archive}) {
      const norm=x=>String(x||'').trim().toLowerCase();
      if(norm(accountEmail)!==norm(archive.sourceEmail))
        return {success:false,message:'Le compte de la sauvegarde ne correspond pas au compte choisi.'};
      // Build the next R2D3 state off-line. Never modify the live engine until
      // the entire import has passed validation by restoreMailEngine.
      const before=engine.exportState();
      const next=JSON.parse(JSON.stringify(before));
      const identity=m=>JSON.stringify([m.folder||'inbox',norm(m.from),norm(m.to),m.subject||'',m.body||'',m.date||'']);
      const existing=new Set(next.messages.filter(m=>norm(m.accountEmail)===norm(accountEmail)).map(identity));
      let restored=0,skipped=0;
      for(const m of archive.messages){
        if(!m||!['inbox','sent'].includes(m.folder)||norm(m.accountEmail)!==norm(accountEmail)||
          typeof m.from!=='string'||typeof m.to!=='string'||typeof m.subject!=='string'||
          typeof m.body!=='string'||typeof m.read!=='boolean'||typeof m.date!=='string'||
          !Number.isFinite(Date.parse(m.date))) {
          return {success:false,message:'Sauvegarde : courriel incompatible avec R2D3.'};
        }
        const key=identity(m);
        if(existing.has(key)){skipped++;continue;}
        const copy={
          id:'mail-'+next.nextId++,folder:m.folder,accountEmail,
          from:m.from,to:m.to,subject:m.subject,body:m.body,
          read:m.read,date:m.date
        };
        next.messages.push(copy);existing.add(key);restored++;
      }
      let replacement;
      try{replacement=restoreMailEngine(scenario,next);}
      catch(err){return {success:false,message:'Restauration R2D3 impossible : '+(err.message||err)};}
      engine=replacement;
      sync();
      return {success:true,restored,skipped};
    },

    ...(options.callbacks||{})
  };
  outlook=mountOutlook(host,{
    accounts:options.accounts||[],
    messages:messages(),
    messageStore:"external",
    avatar:options.avatar,
    callbacks
  });
  function inject(message) {const result=engine.receive(message);if(result.success)sync();return result;}
  function failure(name, enabled) {return engine.setFailure(name,enabled);}
  function reset() {
    // L'interface Outlook est recréée pour éviter les comptes orphelins.
    outlook.destroy();
    return connectMailOutlook(host,scenario,options);
  }
  return {
    engine, outlook, sync, inject, failure, reset,
    getSnapshot:()=>engine.getSnapshot(),
    destroy:()=>outlook.destroy()
  };
}
