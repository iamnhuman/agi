import {spawnSync} from 'node:child_process';
import {homedir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const candidates=[...new Set([
 process.execPath,
 join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'),
 '/opt/homebrew/bin/node',
 '/usr/local/bin/node',
])];
const probe=`const [major,minor]=process.versions.node.split('.').map(Number);
if(major<22||(major===22&&minor<13))process.exit(1);
await import('rolldown');`;
const runtime=candidates.find(node=>spawnSync(node,['--input-type=module','-e',probe],{
 cwd:root,stdio:'ignore',timeout:15000,
}).status===0);
if(!runtime){
 console.error('Не найден совместимый Node.js 22.13+ с зависимостями проекта. Установите Node.js 24 и выполните npm ci.');
 process.exit(1);
}
const result=spawnSync(runtime,['scripts/build.mjs',...process.argv.slice(2)],{
 cwd:root,stdio:'inherit',env:{...process.env,PATH:dirname(runtime)+':'+(process.env.PATH||'')},
});
process.exit(result.status??1);
