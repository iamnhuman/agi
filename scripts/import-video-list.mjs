import {readFile,writeFile,rename} from 'node:fs/promises';
import {importVideo} from '../server/video-import.mjs';
const seeds=JSON.parse(await readFile(process.argv[2],'utf8'));const out=[];let cursor=0;
async function worker(){while(cursor<seeds.length){const s=seeds[cursor++];const meta=await importVideo(s.url);out.push({...s,...meta,name:s.name});console.log(`${out.length}/${seeds.length} ${s.name}: ${meta.publishedAt||'без даты'}`);}}
await Promise.all([worker(),worker(),worker()]);
const path='data/catalog.json';const current=JSON.parse(await readFile(path,'utf8'));const existing=current.videos||[];
for(const v of out.sort((a,b)=>a.sourceOrder-b.sourceOrder)){if(!existing.some(x=>x.url===v.url))existing.push(v);}
current.videos=existing;await writeFile(path+'.tmp',JSON.stringify(current,null,2)+'\n');await rename(path+'.tmp',path);
console.log(JSON.stringify({total:existing.length,dated:existing.filter(v=>v.publishedAt).length}));
