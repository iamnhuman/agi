import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCatalogStore} from '../server/catalog.mjs';
import {startServers} from '../server/http.mjs';

async function fixture(t){
  const dir=await mkdtemp(join(tmpdir(),'artist-order-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const file=join(dir,'catalog.json');
  const catalog={
    sections:[{id:'world',name:'Мир'},{id:'runet',name:'Рунет'}],
    artists:Array.from({length:24},(_,index)=>({
      id:`artist-${index+1}`,name:`Artist ${index+1}`,url:`https://www.instagram.com/artist_${index+1}`,
      section:index%2?'runet':'world',kind:index%3?'artist':'media',rating:'AA',
      platform:'Instagram',description:`Description ${index+1}`,image:'',tags:'AI',
    })),
    videos:[],
  };
  await writeFile(file,JSON.stringify(catalog));
  return {dir,file,catalog,store:createCatalogStore(file)};
}

test('moves use final one-based positions and preserve other records and catalog data',async t=>{
  const {file,catalog,store}=await fixture(t);
  const first=catalog.artists[0],last=catalog.artists.at(-1);
  const moved=await store.mutate({action:'move',id:first.id,position:20});
  assert.equal(moved.position,20);
  assert.deepEqual(moved.artists[19],first);
  assert.deepEqual(moved.artists.filter(a=>a.id!==first.id),catalog.artists.slice(1));
  assert.deepEqual((await createCatalogStore(file).read()).artists,moved.artists);

  const toStart=await store.mutate({action:'move',id:last.id,position:1});
  assert.deepEqual(toStart.artists[0],last);
  const toEnd=await store.mutate({action:'move',id:last.id,position:24});
  assert.deepEqual(toEnd.artists.at(-1),last);
  const same=await store.mutate({action:'move',id:last.id,position:24});
  assert.deepEqual(same.artists,toEnd.artists);
  const saved=await createCatalogStore(file).read();
  assert.equal(new Set(saved.artists.map(a=>a.id)).size,24);
  assert.deepEqual(saved.sections,catalog.sections);
  assert.deepEqual(saved.videos,catalog.videos);
});

test('invalid positions and missing cards leave the saved catalog unchanged',async t=>{
  const {file,store}=await fixture(t);
  const before=await readFile(file,'utf8');
  for(const position of [0,-1,25,1.5,'2',null,undefined,NaN,Infinity]){
    await assert.rejects(store.mutate({action:'move',id:'artist-1',position}),/целую позицию/);
    assert.equal(await readFile(file,'utf8'),before);
  }
  await assert.rejects(store.mutate({action:'move',id:'missing',position:1}),/не найдена/);
  assert.equal(await readFile(file,'utf8'),before);
  await store.mutate({action:'move',id:'artist-1',position:2});
  assert.equal((await store.read()).artists[1].id,'artist-1');
});

test('descending numbers move cards to the requested number without reversing the collection',async t=>{
  const {file,catalog,store}=await fixture(t);
  const first=catalog.artists[0],last=catalog.artists.at(-1);
  const moved=await store.mutate({action:'move',id:first.id,position:5,reverseNumbering:true});
  assert.equal(moved.position,5);
  assert.deepEqual(moved.artists[19],first);
  assert.deepEqual(moved.artists.filter(a=>a.id!==first.id),catalog.artists.slice(1));
  const toTop=await store.mutate({action:'move',id:last.id,position:24,reverseNumbering:true});
  assert.deepEqual(toTop.artists[0],last);
  const toBottom=await store.mutate({action:'move',id:last.id,position:1,reverseNumbering:true});
  assert.deepEqual(toBottom.artists.at(-1),last);
  assert.deepEqual((await createCatalogStore(file).read()).artists,toBottom.artists);
});

test('queued moves use the latest catalog and survive restarting the store',async t=>{
  const {file,store}=await fixture(t);
  await Promise.all([
    store.mutate({action:'move',id:'artist-1',position:24}),
    store.mutate({action:'move',id:'artist-2',position:24}),
  ]);
  const saved=await createCatalogStore(file).read();
  assert.deepEqual(saved.artists.slice(-2).map(a=>a.id),['artist-1','artist-2']);
});

test('curator move API persists the order returned by the public catalog',async t=>{
  const {dir,file}=await fixture(t);
  const dist=join(dir,'dist');await mkdir(dist);
  const app=await startServers({catalogFile:file,distDir:dist,sitePort:0,adminPort:0});
  t.after(()=>app.close());
  const body=JSON.stringify({action:'move',id:'artist-1',position:1,reverseNumbering:true});
  const post=base=>fetch(base+'/api/catalog',{method:'POST',headers:{origin:base,'content-type':'application/json'},body});
  assert.equal((await post(app.siteUrl)).status,403);
  const response=await post(app.adminUrl);
  assert.equal(response.status,200);
  const moved=await response.json();
  assert.equal(moved.artists[23].id,'artist-1');
  const publicCatalog=await (await fetch(app.siteUrl+'/api/catalog')).json();
  assert.deepEqual(publicCatalog.artists,moved.artists);
});
