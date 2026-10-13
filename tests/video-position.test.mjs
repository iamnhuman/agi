import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCatalogStore,validateCatalog} from '../server/catalog.mjs';
import {startServers} from '../server/http.mjs';
import {orderVideos} from '../lib/video-order.mjs';

const ids=videos=>videos.map(video=>video.id);
const video=(id,date,index)=>({id,name:id,url:`https://t.me/video_position_test/${index+1}`,platform:'Telegram',videoId:'',reference:false,title:'',publishedAt:date,dateSource:date?'source':'unknown',dateUrl:date?`https://t.me/video_position_test/${index+1}?embed=1&mode=tme`:'',image:'',description:'',alternateUrls:[],sourceOrder:index});
async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'video-position-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const file=join(dir,'catalog.json'),catalog={artists:[],sections:[],videos:[video('middle','2025-01-01',0),video('unknown','',1),video('first','2023-01-01',2),video('last','2026-01-01',3)]};
 await writeFile(file,JSON.stringify(catalog));return {dir,file,catalog,store:createCatalogStore(file)};
}

test('positions persist across years without changing dates or addition order',async t=>{
 const {file,catalog,store}=await fixture(t);
 const moved=await store.mutate({action:'video-move',id:'last',position:1});
 assert.deepEqual(moved.videoTimelineOrder,['last','first','middle','unknown']);
 assert.deepEqual(moved.videos,catalog.videos);
 const saved=await createCatalogStore(file).read();
 assert.deepEqual(ids(orderVideos(saved.videos,'dates',saved.videoTimelineOrder)),moved.videoTimelineOrder);
 assert.deepEqual(ids(orderVideos(saved.videos,'asc',saved.videoTimelineOrder)),ids(catalog.videos));
 assert.deepEqual(ids(orderVideos(saved.videos,'desc',saved.videoTimelineOrder)),ids(catalog.videos).reverse());
 const end=await store.mutate({action:'video-move',id:'first',position:4});
 assert.deepEqual(end.videoTimelineOrder,['last','middle','unknown','first']);
});

test('invalid moves leave the file unchanged and a no-op retains automatic chronology',async t=>{
 const {file,store}=await fixture(t);const before=await readFile(file,'utf8');
 for(const position of [0,-1,5,1.5,'2',null,undefined,NaN,Infinity]){
  await assert.rejects(store.mutate({action:'video-move',id:'first',position}),/целую позицию/);
  assert.equal(await readFile(file,'utf8'),before);
 }
 await assert.rejects(store.mutate({action:'video-move',id:'missing',position:1}),/не найдено/);
 assert.equal(await readFile(file,'utf8'),before);
 await store.mutate({action:'video-move',id:'first',position:1});
 assert.equal((await store.read()).videoTimelineOrder,undefined);
});

test('queued moves preserve the latest order, and edits, additions and deletions retain it',async t=>{
 const {store}=await fixture(t);
 await Promise.all([store.mutate({action:'video-move',id:'last',position:1}),store.mutate({action:'video-move',id:'middle',position:1})]);
 let saved=await store.read();assert.deepEqual(saved.videoTimelineOrder,['middle','last','first','unknown']);
 const edited={...saved.videos.find(video=>video.id==='middle'),name:'Renamed',publishedAt:'2022-01-01'};
 await store.mutate({action:'video-save',video:edited});
 assert.deepEqual((await store.read()).videoTimelineOrder,saved.videoTimelineOrder);
 const added=await store.mutate({action:'video-save',video:{...video('','2021-01-01',9),name:'New video'}});
 saved=await store.read();assert.equal(saved.videoTimelineOrder[0],added.video.id);
 assert.deepEqual(saved.videoTimelineOrder.filter(id=>id!==added.video.id),['middle','last','first','unknown']);
 await store.mutate({action:'video-delete',id:'last'});
 saved=await store.read();assert.ok(!saved.videoTimelineOrder.includes('last'));
 await store.mutate({action:'video-order-reset'});
 saved=await store.read();assert.equal(saved.videoTimelineOrder,undefined);
 assert.deepEqual(ids(orderVideos(saved.videos,'dates')),[added.video.id,'middle','first','unknown']);
});

test('manual order rejects duplicates and references to missing records',()=>{
 const catalog={artists:[],sections:[],videos:[video('one','2024-01-01',0)]};
 for(const order of ['one',['one','one'],['missing'],[1]])assert.throws(()=>validateCatalog({...catalog,videoTimelineOrder:order}),/порядок видео/);
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
 await store.mutate({action:'video-save',video:{...withoutSection,title:'New title'}});
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
 assert.deepEqual(published.videoTimelineOrder,moved.videoTimelineOrder);
});
