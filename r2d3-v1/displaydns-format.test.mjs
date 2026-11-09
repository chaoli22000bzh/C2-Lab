import test from "node:test";
import assert from "node:assert/strict";
import {formatDisplayDns,formatFlushDns} from "../shared-ui/v1/dns-cache-commands.js";

test("DISPLAYDNS-01 : enregistrement A avec rubriques Windows françaises",()=>{
 const text=formatDisplayDns({entries:[{name:"atelier.test",found:true,address:"192.168.10.50",remainingTtl:300,chain:[{name:"atelier.test",type:"A",value:"192.168.10.50"}]}]});
 assert.match(text,/Configuration IP de Windows/);
 assert.match(text,/Nom d'enregistrement\./);
 assert.match(text,/Type d'enregistrement : 1/);
 assert.match(text,/Enregistrement \(hôte\) : 192\.168\.10\.50/);
 assert.match(text,/Durée de vie  \. \. \. \. : 300/);
});
test("DISPLAYDNS-02 : CNAME et A affichés comme deux enregistrements distincts",()=>{
 const text=formatDisplayDns({entries:[{name:"www.atelier.test",found:true,address:"192.168.10.50",remainingTtl:250,chain:[{name:"www.atelier.test",type:"CNAME",value:"atelier.test"},{name:"atelier.test",type:"A",value:"192.168.10.50"}]}]});
 assert.match(text,/Type d'enregistrement : 5/);
 assert.match(text,/Enregistrement CNAME\s+: atelier\.test/);
 assert.match(text,/Type d'enregistrement : 1/);
 assert.match(text,/Enregistrement \(hôte\) : 192\.168\.10\.50/);
});
test("DISPLAYDNS-03 : pas de doublon des enregistrements déjà affichés",()=>{
 const entry={name:"atelier.test",found:true,address:"192.168.10.50",remainingTtl:200,chain:[{name:"atelier.test",type:"A",value:"192.168.10.50"}]};
 const text=formatDisplayDns({entries:[entry,entry]});
 assert.equal(text.split("Enregistrement (hôte)").length-1,1);
});
test("DISPLAYDNS-04 : entrée expirée non affichée",()=>{
 const text=formatDisplayDns({entries:[{name:"atelier.test",found:true,remainingTtl:0,chain:[]}]});
 assert.doesNotMatch(text,/Enregistrement \(hôte\)/);
});
test("DISPLAYDNS-05 : réponse négative sans faux A",()=>{
 const text=formatDisplayDns({entries:[{name:"inconnu.atelier.test",found:false,remainingTtl:60}]});
 assert.match(text,/Réponse négative/);
 assert.doesNotMatch(text,/Enregistrement \(hôte\)/);
});
test("DISPLAYDNS-06 : purge Windows toujours disponible",()=>{
 const text=formatFlushDns();
 assert.match(text,/ipconfig \/flushdns/);
 assert.match(text,/Cache de résolution DNS vidé\./);
});
