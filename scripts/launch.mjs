import {spawn, spawnSync} from 'node:child_process';
import {homedir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const candidates = [...new Set([
  process.execPath,
  join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'),
  '/opt/homebrew/bin/node',
  '/usr/local/bin/node',
])];
const probe = `const [major,minor]=process.versions.node.split('.').map(Number);
if(major<22||(major===22&&minor<13))process.exit(1);
await import('rolldown');`;
const runtime = candidates.find(node => spawnSync(node, ['--input-type=module', '-e', probe], {
  cwd: root, stdio: 'ignore', timeout: 15000,
}).status === 0);
if (!runtime) {
  console.error('Не найден совместимый Node.js с зависимостями проекта. Установите Node.js 24 для архитектуры вашего Mac, выполните npm ci и повторите npm start.');
  process.exit(1);
}
if (runtime !== process.execPath) console.log('Используется совместимый Node.js: ' + runtime);
const options = {cwd: root, stdio: 'inherit', env: {...process.env, PATH: dirname(runtime) + ':' + (process.env.PATH || '')}};
let child = spawn(runtime, ['scripts/build.mjs'], options);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', e => {console.error(e.message); process.exit(1);});
child.on('exit', code => {
  if (code !== 0) process.exit(code || 1);
  child = spawn(runtime, ['server/start.mjs'], options);
  child.on('error', e => {console.error(e.message); process.exit(1);});
  child.on('exit', code => process.exit(code || 0));
});
