import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

async function loadTs(path){
 const source=await readFile(new URL(path,import.meta.url),'utf8');
 const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
 return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const {resolveClientIp}=await loadTs('../app/client-signal.ts');
const {signalGlyphFrame}=await loadTs('../app/signal-screen.ts');

test('IP lookup reads the current connection on each call and bypasses caches',async()=>{
 const requests=[];
 let address='203.0.113.12';
 const fetcher=async(url,options)=>{requests.push({url,options});return Response.json({ip:address});};
 const signal=new AbortController().signal;
 assert.equal((await resolveClientIp(signal,fetcher)).value,address);
 address='2001:db8::32';
 assert.equal((await resolveClientIp(signal,fetcher)).value,address);
 assert.notEqual(requests[0].url,requests[1].url);
 assert.ok(requests.every(({options})=>options.cache==='no-store'&&options.signal instanceof AbortSignal));
});

test('blocked IP provider falls back, and an unavailable IP is never invented',async()=>{
 let calls=0;
 const backup=await resolveClientIp(new AbortController().signal,async()=>{
  if(++calls===1)throw new TypeError('Blocked');
  return new Response('198.51.100.24\n');
 });
 assert.deepEqual(backup,{label:'PUBLIC IP',value:'198.51.100.24'});
 const unavailable=await resolveClientIp(new AbortController().signal,async()=>new Response('<html>not an IP</html>'));
 assert.deepEqual(unavailable,{label:'CLIENT IP',value:'UNAVAILABLE'});
});

test('local connection fallback stays distinct from public IP and cancellation stops requests',async()=>{
 const local=await resolveClientIp(new AbortController().signal,async(url)=>url.startsWith('/')?Response.json({ip:'::1'}):new Response('',{status:503}));
 assert.deepEqual(local,{label:'LINK IP',value:'::1'});
 const controller=new AbortController();controller.abort();
 await resolveClientIp(controller.signal,async()=>{assert.fail('An aborted session must not start a lookup');});
});

test('rain glyphs change in the same cell at independent rates, with occasional afterimages',()=>{
 const frames=Array.from({length:40},(_,cell)=>Array.from({length:120},(_,tick)=>signalGlyphFrame(317,cell,tick/60,72)));
 assert.ok(frames.every(cell=>new Set(cell.map(frame=>frame.index)).size>1));
 const changes=frames.map(cell=>cell.filter((frame,index)=>index&&frame.index!==cell[index-1].index).length);
 assert.ok(new Set(changes).size>3,'Cells must not all mutate in unison');
 assert.ok(frames.some(cell=>cell.some(frame=>frame.afterimage>0)));
});
