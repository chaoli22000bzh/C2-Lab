import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const scenario=JSON.parse(readFileSync(resolve(root,'scenarios/cybernet.json'),'utf8'));
writeFileSync(resolve(root,'demo/cybernet-scenario.js'),'// Distribution generee depuis scenarios/cybernet.json. NE PAS EDITER.\nexport default '+JSON.stringify(scenario,null,2)+';\n');
console.log('Demo scenario regenerated');
