import {build} from 'vite';
import {readFile,writeFile} from 'node:fs/promises';
import {validateCatalog} from '../server/catalog.mjs';
const pages = process.argv.includes('--pages');
const catalog = validateCatalog(JSON.parse(await readFile('data/catalog.json','utf8')));
await build({mode:pages?'pages':'production'});
if (pages) {
  await writeFile('dist/pages/catalog.json',JSON.stringify(catalog,null,2)+'\n');
  await writeFile('dist/pages/.nojekyll','');
}
