/* Adaptateur autonome R2D3 / Outlook 0.4.8, sans modifier le composant partagé. */
import {createMailEngine} from "./mail-core.js";
import {mountOutlook} from "../shared-ui/v1/outlook.js";

export function connectMailOutlook(host, scenario, options = {}) {
  const engine = options.engine || createMailEngine(scenario);
  let outlook;
  // Sans conversion accountId : Outlook 0.4.8 sait lire accountEmail.
  const messages = () => engine.getSnapshot().messages.map(mail=>({
    ...mail, date: mail.date || "Aujourd’hui"
  }));
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
    ...(options.callbacks||{})
  };
  outlook=mountOutlook(host,{
    accounts:[],
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
