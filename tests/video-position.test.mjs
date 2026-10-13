import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCatalogStore,validateCatalog} from '../server/catalog.mjs';
import {startServers} from '../server/http.mjs';
import {orderVideos} from '../lib/video-order.mjs';

const ids=videos=>videos.map(video=>video.id);
const video=(id,date,index)=>({id,name:id,url:`https://t.me/video_position_test/${index+1}`,platform:'Telegram',videoId:'',reference:false,publishedAt:date,dateSource:date?'source':'unknown',dateUrl:date?`https://t.me/video_position_test/${index+1}?embed=1&mode=tme`:'',image:'',alternateUrls:[],sourceOrder:index});
async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'video-position-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const file=join(dir,'catalog.json'),catalog={artists:[],sections:[],videos:[video('middle','2025-01-01',0),video('unknown','',1),video('first','2023-01-01',2),video('last','2026-01-01',3)]};
 await writeFile(file,JSON.stringify(catalog));return {dir,file,catalog,store:createCatalogStore(file)};
}

test('edited positions persist in both directions without changing video metadata',async t=>{
 const {file,catalog,store}=await fixture(t);
 const moved=await store.mutate({action:'video-move',id:'last',position:1});
 assert.deepEqual(ids(moved.videos),['last','middle','unknown','first']);
 const saved=await createCatalogStore(file).read();
 assert.deepEqual(saved.videos,moved.videos);
 for(const original of catalog.videos)assert.deepEqual(saved.videos.find(v=>v.id===original.id),original);
 const descending=await store.mutate({action:'video-move',id:'last',position:1,reverseNumbering:true});
 assert.deepEqual(ids(orderVideos(descending.videos,'desc')),['last','first','unknown','middle']);
 const end=await store.mutate({action:'video-move',id:'first',position:4,reverseNumbering:true});
 assert.deepEqual(ids(orderVideos(end.videos,'desc')),['last','unknown','middle','first']);
 assert.deepEqual(ids(orderVideos(end.videos,'asc')),['first','middle','unknown','last']);
});

test('invalid moves leave the file unchanged and a no-op preserves the collection',async t=>{
 const {file,store,catalog}=await fixture(t);const before=await readFile(file,'utf8');
 for(const position of [0,-1,5,1.5,'2',null,undefined,NaN,Infinity]){
  await assert.rejects(store.mutate({action:'video-move',id:'first',position}),/целую позицию/);
  assert.equal(await readFile(file,'utf8'),before);
 }
 await assert.rejects(store.mutate({action:'video-move',id:'missing',position:1}),/не найдено/);
 assert.equal(await readFile(file,'utf8'),before);
 await store.mutate({action:'video-move',id:'last',position:1,reverseNumbering:true});
 assert.deepEqual((await store.read()).videos,catalog.videos);
});

test('queued moves, edits, new additions and deletions retain the collection order',async t=>{
 const {store}=await fixture(t);
 await Promise.all([store.mutate({action:'video-move',id:'last',position:1}),store.mutate({action:'video-move',id:'middle',position:1})]);
 let saved=await store.read();assert.deepEqual(ids(saved.videos),['middle','last','unknown','first']);
 const edited={...saved.videos.find(video=>video.id==='middle'),name:'Renamed',publishedAt:'2022-01-01'};
 await store.mutate({action:'video-save',video:edited});
 assert.deepEqual(ids((await store.read()).videos),ids(saved.videos));
 const added=await store.mutate({action:'video-save',video:{...video('','2021-01-01',9),name:'New video'}});
 saved=await store.read();assert.equal(orderVideos(saved.videos,'desc')[0].id,added.video.id);
 assert.deepEqual(ids(saved.videos).filter(id=>id!==added.video.id),['middle','last','unknown','first']);
 await store.mutate({action:'video-delete',id:'last'});
 saved=await store.read();assert.deepEqual(ids(saved.videos),['middle','unknown','first',added.video.id]);
});

test('obsolete date-order metadata is removed on the next save',async t=>{
 const {file,catalog,store}=await fixture(t);
 await writeFile(file,JSON.stringify({...catalog,videoTimelineOrder:['first','middle','unknown','last']}));
 await store.mutate({action:'video-move',id:'last',position:1,reverseNumbering:true});
 assert.equal((await store.read()).videoTimelineOrder,undefined);
 assert.deepEqual((await store.read()).videos,catalog.videos);
});

test('region assignment persists through edits and moves and can be changed or cleared',async t=>{
 const {file,store}=await fixture(t);
 let saved=(await store.read()).videos.find(video=>video.id==='middle');
 await store.mutate({action:'video-save',video:{...saved,section:'runet'}});
 saved=(await createCatalogStore(file).read()).videos.find(video=>video.id==='middle');
 assert.equal(saved.section,'runet');
 await store.mutate({action:'video-move',id:'middle',position:1});
 await store.mutate({action:'video-save',video:{...saved,name:'Renamed',section:'world'}});
 saved=(await store.read()).videos.find(video=>video.id==='middle');assert.equal(saved.section,'world');
 const {section,...withoutSection}=saved;
 await store.mutate({action:'video-save',video:{...withoutSection,name:'Updated name'}});
 assert.equal((await store.read()).videos.find(video=>video.id==='middle').section,'world');
 await store.mutate({action:'video-save',video:{...saved,section:''}});
 assert.equal((await store.read()).videos.find(video=>video.id==='middle').section,undefined);
});

test('invalid regions are rejected without altering the catalog',async t=>{
 const {file,store}=await fixture(t),catalog=await store.read(),before=await readFile(file,'utf8');
 for(const section of ['other',1,{},false]){
  await assert.rejects(store.mutate({action:'video-save',video:{...catalog.videos[0],section}}),/регион/);
  assert.equal(await readFile(file,'utf8'),before);
 }
 assert.throws(()=>validateCatalog({...catalog,videos:[{...catalog.videos[0],section:'other'}]}),/регион/);
});

test('only the curator API can persist a move and the public catalog sees the same order',async t=>{
 const {dir,file}=await fixture(t),dist=join(dir,'dist');await mkdir(dist);
 const app=await startServers({catalogFile:file,distDir:dist,sitePort:0,adminPort:0});t.after(()=>app.close());
 const body=JSON.stringify({action:'video-move',id:'last',position:1});
 const post=base=>fetch(base+'/api/catalog',{method:'POST',headers:{origin:base,'content-type':'application/json'},body});
 assert.equal((await post(app.siteUrl)).status,403);
 const response=await post(app.adminUrl);assert.equal(response.status,200);
 const moved=await response.json(),published=await (await fetch(app.siteUrl+'/api/catalog')).json();
 assert.deepEqual(published.videos,moved.videos);
 assert.deepEqual(ids(published.videos),['last','middle','unknown','first']);
});

test('saving video details and a new number is atomic in either display direction',async t=>{
 const {file,store,catalog}=await fixture(t);
 const original=catalog.videos.find(v=>v.id==='first');
 const result=await store.mutate({action:'video-save',video:{...original,name:'Edited video',section:'runet'},position:1,reverseNumbering:true});
 assert.equal(result.video.name,'Edited video');
 let saved=await createCatalogStore(file).read();
 assert.deepEqual(ids(orderVideos(saved.videos,'desc')),['first','last','unknown','middle']);
 assert.equal(saved.videos.at(-1).section,'runet');
 assert.equal(saved.videos.at(-1).publishedAt,original.publishedAt);
 for(const video of catalog.videos.filter(v=>v.id!=='first'))assert.deepEqual(saved.videos.find(v=>v.id===video.id),video);
 await store.mutate({action:'video-save',video:{...saved.videos.at(-1),publishedAt:'2024-06-15'},position:2});
 saved=await store.read();assert.deepEqual(ids(saved.videos),['middle','first','unknown','last']);
 assert.equal(saved.videos[1].publishedAt,'2024-06-15');
});

test('invalid numbers prevent the entire video edit from being saved',async t=>{
 const {file,store,catalog}=await fixture(t),before=await readFile(file,'utf8');
 for(const position of [0,-1,5,1.5,'2',null,NaN,Infinity]){
  await assert.rejects(store.mutate({action:'video-save',video:{...catalog.videos[0],name:'Must not be saved'},position}),/целую позицию/);
  assert.equal(await readFile(file,'utf8'),before);
 }
});

test('a new video can be assigned its number during creation',async t=>{
 const {store}=await fixture(t);
 const result=await store.mutate({action:'video-save',video:{...video('','2020-01-01',9),name:'New video'},position:2,reverseNumbering:true});
 assert.deepEqual(ids(orderVideos((await store.read()).videos,'desc')),['last',result.video.id,'first','unknown','middle']);
});
