import {build} from 'vite';
import {copyFile,cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {validateCatalog} from '../server/catalog.mjs';
const pages = process.argv.includes('--pages');
const catalog = validateCatalog(JSON.parse(await readFile('data/catalog.json','utf8')));
await build({mode:pages?'pages':'production'});
const output = pages ? 'dist/pages' : 'dist/local';
await copyFile(`${output}/site.html`,`${output}/index.html`);
if (pages) {
  await writeFile(`${output}/catalog.json`,JSON.stringify(catalog,null,2)+'\n');
  await writeFile('dist/pages/.nojekyll','');
  // This repository uses Pages from main/root. Keep the deployable files at root.
  await copyFile(`${output}/index.html`,'index.html');
  await copyFile(`${output}/favicon.svg`,'favicon.svg');
  await mkdir('assets',{recursive:true});
  await cp(`${output}/assets`,'assets',{recursive:true});
  const rootCatalog = structuredClone(catalog);
  for(const artist of rootCatalog.artists || []){
    if(typeof artist.image==='string'&&artist.image.startsWith('./avatars/'))
      artist.image=artist.image.replace('./avatars/','./public/avatars/');
  }
  await writeFile('catalog.json',JSON.stringify(rootCatalog,null,2)+'\n');
  await writeFile('.nojekyll','');
}
