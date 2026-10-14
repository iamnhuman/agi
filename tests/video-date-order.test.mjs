import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCatalogStore,validateCatalog} from '../server/catalog.mjs';
import {startServers} from '../server/http.mjs';
import {orderVideos,sortVideosByDate,videoPositionByDate} from '../lib/video-order.mjs';

const ids=items=>items.map(v=>v.id);
let sequence=0;
const video=(id,date)=>({id,name:id||'New',url:`https://t.me/date_order_test/${++sequence}`,publishedAt:date,platform:'Telegram',videoId:'',reference:false,dateSource:'manual',dateUrl:'',image:'',alternateUrls:[],sourceOrder:sequence});
async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'video-date-order-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const file=join(dir,'catalog.json'),catalog={artists:[],sections:[],videos:[video('early','2024-01-01'),video('middle','2025-01-01'),video('late','2026-01-01')]};
 await writeFile(file,JSON.stringify(catalog));return {dir,file,catalog,store:createCatalogStore(file)};
}
const automaticDates=items=>items.filter(v=>!v.manualPosition).map(v=>v.publishedAt);

test('new items enter their date position and equal dates retain a stable order',async t=>{
 const {store}=await fixture(t);
 const mid=await store.mutate({action:'video-save',video:video('','2024-06-01'),reverseNumbering:true});
 assert.equal(mid.position,3);assert.equal(mid.video.manualPosition,undefined);
 assert.deepEqual(ids(orderVideos((await store.read()).videos)),['late','middle',mid.video.id,'early']);
 const same=await store.mutate({action:'video-save',video:video('','2024-06-01')});
 assert.deepEqual(ids((await store.read()).videos),['early',mid.video.id,same.video.id,'middle','late']);
 const oldest=await store.mutate({action:'video-save',video:video('','2020-01-01')});
 const newest=await store.mutate({action:'video-save',video:video('','2027-01-01')});
 assert.equal((await store.read()).videos[0].id,oldest.video.id);assert.equal((await store.read()).videos.at(-1).id,newest.video.id);
});

test('changing an automatic date moves the item while other metadata and plain edits stay intact',async t=>{
 const {store,catalog}=await fixture(t),early=catalog.videos[0];
 const result=await store.mutate({action:'video-save',video:{...early,publishedAt:'2027-03-04',name:'Changed date',section:'world'},reverseNumbering:true});
 assert.equal(result.position,1);
 let saved=await store.read();assert.deepEqual(ids(saved.videos),['middle','late','early']);
 for(const other of catalog.videos.slice(1))assert.deepEqual(saved.videos.find(v=>v.id===other.id),other);
 assert.equal(result.video.url,early.url);assert.equal(result.video.section,'world');
 await store.mutate({action:'video-save',video:{...result.video,name:'Only renamed'}});
 saved=await store.read();assert.deepEqual(ids(saved.videos),['middle','late','early']);
});

test('undated additions follow dated cards in descending view and move when their date is filled',async t=>{
 const {store}=await fixture(t);
 const result=await store.mutate({action:'video-save',video:video('',''),reverseNumbering:true});
 assert.equal(result.position,4);assert.equal(orderVideos((await store.read()).videos).at(-1).id,result.video.id);
 await store.mutate({action:'video-save',video:{...result.video,publishedAt:'2024-06-01'}});
 assert.deepEqual(ids((await store.read()).videos),['early',result.video.id,'middle','late']);
});

test('explicit numbers override chronology, survive stale editors and leave automatic dates ordered',async t=>{
 const {file,store}=await fixture(t);
 const manual=await store.mutate({action:'video-save',video:video('','2020-01-01'),position:1,reverseNumbering:true});
 assert.equal(manual.video.manualPosition,true);assert.equal(manual.position,1);
 assert.equal((await store.read()).videos.at(-1).id,manual.video.id);
 const stale={...manual.video,publishedAt:'2019-01-01',name:'Stale edit'};delete stale.manualPosition;
 await store.mutate({action:'video-save',video:stale});
 await store.mutate({action:'video-save',video:video('','2024-06-01')});
 const saved=await createCatalogStore(file).read(),at=saved.videos.findIndex(v=>v.id===manual.video.id);
 assert.equal(orderVideos(saved.videos)[0].id,manual.video.id);assert.equal(saved.videos[at].manualPosition,true);assert.equal(saved.videos[at].publishedAt,'2019-01-01');
 const dates=automaticDates(saved.videos);assert.deepEqual(dates,[...dates].sort());
});

test('a manually moved card can return to automatic placement explicitly',async t=>{
 const {store,catalog}=await fixture(t);
 await store.mutate({action:'video-move',id:'early',position:1,reverseNumbering:true});
 let saved=await store.read();assert.equal(saved.videos.at(-1).manualPosition,true);
 const stale=catalog.videos[0];
 const result=await store.mutate({action:'video-save',video:stale,positionMode:'date',reverseNumbering:true});
 assert.equal(result.video.manualPosition,undefined);assert.equal(result.position,3);
 saved=await store.read();assert.deepEqual(ids(saved.videos),['early','middle','late']);
});

test('inserting an older card preserves the relative custom order of all existing cards',async t=>{
 const {store}=await fixture(t);
 await store.mutate({action:'video-move',id:'early',position:2,reverseNumbering:true});
 const before=ids((await store.read()).videos);
 const added=await store.mutate({action:'video-save',video:video('','2020-01-01')});
 let saved=await store.read();assert.deepEqual(ids(saved.videos).filter(id=>id!==added.video.id),before);
 assert.equal(orderVideos(saved.videos)[1].id,'early');
 await store.mutate({action:'video-save',video:{...added.video,publishedAt:'2027-01-01'}});
 saved=await store.read();assert.deepEqual(ids(saved.videos).filter(id=>id!==added.video.id),before);
 assert.equal(orderVideos(saved.videos)[0].id,added.video.id);
});

test('untrusted video fields cannot implicitly opt out of chronology and conflicting controls are atomic',async t=>{
 const {store,file,catalog}=await fixture(t);
 const result=await store.mutate({action:'video-save',video:{...video('','2020-01-01'),manualPosition:true}});
 assert.equal(result.video.manualPosition,undefined);assert.equal((await store.read()).videos[0].id,result.video.id);
 const before=await readFile(file,'utf8');
 for(const options of [{position:1,positionMode:'date'},{positionMode:'manual'},{positionMode:1}]){
  await assert.rejects(store.mutate({action:'video-save',video:{...catalog.videos[0],name:'Must not change'},...options}));
  assert.equal(await readFile(file,'utf8'),before);
 }
 assert.throws(()=>validateCatalog({...catalog,videos:[{...catalog.videos[0],manualPosition:'true'}]}),/режим порядка/);
});

test('queued additions use the latest collection and remain chronological after restart',async t=>{
 const {file,store}=await fixture(t);
 const additions=['2027-01-01','2024-06-01','2020-01-01'].map(date=>video('',date));
 await Promise.all(additions.map(video=>store.mutate({action:'video-save',video})));
 const saved=await createCatalogStore(file).read();assert.equal(saved.videos.length,6);
 assert.deepEqual(saved.videos.map(v=>v.publishedAt),['2020-01-01','2024-01-01','2024-06-01','2025-01-01','2026-01-01','2027-01-01']);
});

test('the editor preview matches server placement in either numbering direction without mutating records',async t=>{
 const {store,catalog}=await fixture(t),snapshot=structuredClone(catalog.videos);
 await store.mutate({action:'video-move',id:'middle',position:1,reverseNumbering:true});
 for(const order of ['asc','desc']){
  const items=(await store.read()).videos,newVideo=video('','2024-06-01'),expected=videoPositionByDate(items,newVideo,order);
  const result=await store.mutate({action:'video-save',video:newVideo,reverseNumbering:order==='desc'});assert.equal(result.position,expected);
 }
 assert.deepEqual(catalog.videos,snapshot);assert.notEqual(sortVideosByDate(catalog.videos),catalog.videos);
});

test('repair sorts all dates atomically, clears manual exceptions and preserves every other field',async t=>{
 const {dir,file,store}=await fixture(t);
 await store.mutate({action:'video-move',id:'early',position:1,reverseNumbering:true});
 const before=await store.read(),dist=join(dir,'dist');await mkdir(dist);
 const app=await startServers({catalogFile:file,distDir:dist,sitePort:0,adminPort:0});t.after(()=>app.close());
 const post=base=>fetch(base+'/api/catalog',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({action:'video-sort-dates'})});
 assert.equal((await post(app.siteUrl)).status,403);
 const response=await post(app.adminUrl);assert.equal(response.status,200);
 const repaired=await response.json();assert.deepEqual(ids(repaired.videos),['early','middle','late']);
 const published=await (await fetch(app.siteUrl+'/api/catalog')).json();assert.deepEqual(published.videos,repaired.videos);
 assert.deepEqual(published.artists,before.artists);assert.deepEqual(published.sections,before.sections);
 for(const original of before.videos){const {manualPosition,...metadata}=original;assert.deepEqual(repaired.videos.find(v=>v.id===original.id),metadata);}
});
