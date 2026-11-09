import test from "node:test";
import assert from "node:assert/strict";
import {formatNslookup} from "../shared-ui/v1/nslookup.js";

const base={status:"ok",serverAddress:"192.168.10.10",serverId:"srv-dns"};
test("NSLOOKUP-01 : resolution A en sortie Windows",()=>{
 const output=formatNslookup({name:"atelier.test",result:{...base,found:true,address:"192.168.10.50",chain:[{name:"atelier.test",type:"A",value:"192.168.10.50"}]}});
 assert.match(output,/C:\\>nslookup atelier\.test/);
 assert.match(output,/Serveur :  UnKnown/);
 assert.match(output,/Address:  192\.168\.10\.10/);
 assert.match(output,/Nom :    atelier\.test/);
 assert.match(output,/Address:  192\.168\.10\.50/);
 assert.doesNotMatch(output,/CNAME|Adresse résolue/);
});
test("NSLOOKUP-02 : CNAME affiche le nom canonique et l'alias",()=>{
 const output=formatNslookup({name:"www.atelier.test",result:{...base,found:true,address:"192.168.10.50",chain:[{name:"www.atelier.test",type:"CNAME",value:"atelier.test"},{name:"atelier.test",type:"A",value:"192.168.10.50"}]}});
 assert.match(output,/Nom :    atelier\.test/);
 assert.match(output,/Aliases:  www\.atelier\.test/);
 assert.doesNotMatch(output,/CNAME  atelier\.test|Adresse résolue/);
});
test("NSLOOKUP-03 : nom inconnu renvoie Non-existent domain",()=>{
 const output=formatNslookup({name:"inconnu.atelier.test",result:{...base,found:false,reason:"name_not_found",chain:[]}});
 assert.match(output,/Serveur :  UnKnown/);
 assert.match(output,/\*\*\* UnKnown ne parvient pas à trouver inconnu\.atelier\.test : Non-existent domain/);
 assert.doesNotMatch(output,/Aucune réponse DNS|Adresse résolue/);
});
test("NSLOOKUP-04 : boucle CNAME est un Server failed",()=>{
 const output=formatNslookup({name:"alias.atelier.test",result:{...base,found:false,reason:"alias_loop",chain:[]}});
 assert.match(output,/Server failed/);
});
test("NSLOOKUP-05 : serveur inaccessible n'est pas un NXDOMAIN",()=>{
 const output=formatNslookup({name:"atelier.test",result:{status:"unavailable",reason:"Serveur DNS inaccessible"}});
 assert.match(output,/timed-out/);
 assert.doesNotMatch(output,/Non-existent domain/);
});
test("NSLOOKUP-06 : nom serveur non invente, PTR connu fourni explicitement",()=>{
 const output=formatNslookup({name:"absent.atelier.test",serverName:"dns.atelier.test",result:{...base,found:false,reason:"name_not_found"}});
 assert.match(output,/Serveur :  dns\.atelier\.test/);
 assert.match(output,/\*\*\* dns\.atelier\.test ne parvient pas à trouver absent\.atelier\.test/);
});
