import {resolve} from 'node:path';
import {startServers} from './http.mjs';
try {
  const app = await startServers({catalogFile:resolve('data/catalog.json'),distDir:resolve('dist/local'),dev:process.argv.includes('--dev')});
  console.log(`\nСайт:     ${app.siteUrl}\nАдминка:  ${app.adminUrl}\n\nИзменения сохраняются в data/catalog.json.\nОстановить: Ctrl+C\n`);
  let closing = false;
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal,async()=>{if(closing)return;closing=true;await app.close();process.exit(0);});
} catch (e) {
  console.error(e.code === 'EADDRINUSE' ? 'Порт 3333 или 3334 занят. Остановите другой экземпляр сайта и повторите запуск.' : e.message);
  process.exit(1);
}
