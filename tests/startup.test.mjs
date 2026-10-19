import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const source=await readFile(new URL('../client/startup.ts',import.meta.url),'utf8');
const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
const {prepareWorkspace}=await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const current={artists:[{id:'updated',image:'./avatars/current.jpg'}],sections:[],videos:[]};
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};

test('the first render waits for both the current catalog and the real font, in parallel',async()=>{
 const response=deferred(),font=deferred(),fontStarted=deferred();let ready=false;
 const controller=new AbortController();
 const startup=prepareWorkspace('/api/catalog',{load(specimen,text){
  assert.match(specimen,/Press Start 2P/);assert.match(text,/ИИзм/);fontStarted.resolve();return font.promise;
 }},async(url,options)=>{
  assert.equal(url,'/api/catalog');assert.equal(options.cache,'no-store');assert.equal(options.signal,controller.signal);
  return response.promise;
 },controller.signal).then(catalog=>{ready=true;return catalog;});
 await fontStarted.promise;
 response.resolve(Response.json(current));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(ready,false,'Current photos alone must not reveal fallback typography');
 font.resolve([]);
 assert.deepEqual(await startup,current);
});

test('a warm font does not reveal old photos while the catalog is still loading',async()=>{
 const response=deferred();let ready=false;
 const startup=prepareWorkspace('./catalog.json',{load:async()=>[]},()=>response.promise).then(catalog=>{ready=true;return catalog;});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(ready,false);
 response.resolve(Response.json(current));assert.deepEqual(await startup,current);
});

test('unavailable fonts do not prevent the current catalog from opening',async()=>{
 for(const fonts of [undefined,{load:async()=>{throw Error('Font unavailable');}},{load(){throw Error('Font API blocked');}}]){
  assert.deepEqual(await prepareWorkspace('/api/catalog',fonts,async()=>Response.json(current)),current);
 }
});

test('failed, invalid and cancelled requests reject instead of showing a bundled catalog',async()=>{
 await assert.rejects(prepareWorkspace('/api/catalog',undefined,async()=>new Response('',{status:503})),/загрузить архив/);
 await assert.rejects(prepareWorkspace('/api/catalog',undefined,async()=>Response.json({artists:[]})),/прочитать архив/);
 const controller=new AbortController();controller.abort();
 await assert.rejects(prepareWorkspace('/api/catalog',undefined,async(_url,{signal})=>{signal.throwIfAborted();},controller.signal),{name:'AbortError'});
});

test('the curator waits for the font without an extra catalog request',async()=>{
 let fontLoaded=false;
 assert.equal(await prepareWorkspace(null,{load:async()=>{fontLoaded=true;}},async()=>assert.fail('The curator loads its own editable catalog')),null);
 assert.equal(fontLoaded,true);
});
