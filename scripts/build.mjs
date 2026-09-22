import {build} from 'vite';
import {copyFile,readFile,writeFile} from 'node:fs/promises';
import {validateCatalog} from '../server/catalog.mjs';
const pages = process.argv.includes('--pages');
const catalog = validateCatalog(JSON.parse(await readFile('data/catalog.json','utf8')));
await build({mode:pages?'pages':'production'});
const output = pages ? 'dist/pages' : 'dist/local';
if(!pages) await copyFile(`${output}/site.html`,`${output}/index.html`);
if (pages) {
  let [javascript,styles,icon,html] = await Promise.all([
    readFile(`${output}/atlas.iife.js`,'utf8'),
    readFile(`${output}/atlas.css`,'utf8'),
    readFile('public/favicon.svg'),
    readFile('site.html','utf8'),
  ]);
  if(/^\s*(import|export)\s/m.test(javascript)) throw new Error('Pages-бандл содержит import/export; ожидается обычный скрипт.');
  // A closing script tag inside React's embedded strings would terminate an inline script in HTML.
  javascript = javascript.replace(/<\/script/gi,'<\\/script');
  const sourceScript = '<script type="module" src="/client/site.tsx"></script>';
  if(!html.includes(sourceScript)) throw new Error('Не найдена точка входа статической страницы.');
  html = html.replace(sourceScript,()=>`<script>\n${javascript}\n</script>`);
  html = html.replace('</head>',()=>`<style>\n${styles}\n</style><link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${icon.toString('base64')}"/></head>`);
  await writeFile(`${output}/index.html`,html);
  await writeFile(`${output}/catalog.json`,JSON.stringify(catalog,null,2)+'\n');
  await writeFile('dist/pages/.nojekyll','');
  // This repository uses Pages from main/root. Embed the complete app in one HTML file.
  const rootHtml = html.replaceAll('./avatars/','./public/avatars/');
  await writeFile('index.html',rootHtml);
  await copyFile(`${output}/favicon.svg`,'favicon.svg');
  const rootCatalog = structuredClone(catalog);
  for(const artist of rootCatalog.artists || []){
    if(typeof artist.image==='string'&&artist.image.startsWith('./avatars/'))
      artist.image=artist.image.replace('./avatars/','./public/avatars/');
  }
  await writeFile('catalog.json',JSON.stringify(rootCatalog,null,2)+'\n');
  await writeFile('.nojekyll','');
}
