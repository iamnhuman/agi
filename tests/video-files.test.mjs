import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {downloadInstagramVideo,MAX_VIDEO_BYTES} from '../server/video-files.mjs';
import {createCatalogStore} from '../server/catalog.mjs';
import {startServers} from '../server/http.mjs';

async function fixture(t){
  const dir=await mkdtemp(join(tmpdir(),'atlas-video-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const file=join(dir,'catalog.json'),dist=join(dir,'dist');await mkdir(dist);
  const video={id:'test-video',name:'Video',url:'https://www.instagram.com/p/ABC123456/',platform:'Instagram',videoId:'',reference:false,isVideo:true,title:'Original title',publishedAt:'2025-02-03',dateSource:'manual',dateUrl:'',image:'',sourceOrder:0,alternateUrls:[]};
  await writeFile(file,JSON.stringify({sections:[{id:'world',name:'Мир'}],artists:[],videos:[video]}));
  return {dir,file,dist,video};
}

test('Instagram videos are cached as MP4 assets without publishing temporary CDN URLs',async t=>{
  const {dist}=await fixture(t);
  const bytes=Buffer.concat([Buffer.from([0,0,0,32]),Buffer.from('ftypisom'),Buffer.alloc(128),Buffer.from(randomUUID())]);
  const url='https://scontent.cdninstagram.com/video.mp4?temporary=signature';
  const fetcher=async(_url,options)=>{assert.equal(options.redirect,'manual');return new Response(bytes,{headers:{'content-type':'video/mp4'}});};
  const media=await downloadInstagramVideo(url,dist,fetcher);
  t.after(()=>rm(resolve('public',media.slice(2)),{force:true}));
  assert.match(media,/^\.\/videos\/clip-[a-f0-9]{16}\.mp4$/);
  assert.deepEqual(await readFile(join(dist,media.slice(2))),bytes);
  assert.deepEqual(await readFile(resolve('public',media.slice(2))),bytes);
  assert.equal(await downloadInstagramVideo(url,dist,fetcher),media);
});

test('video downloads reject foreign redirects, oversized responses and invalid MP4 bytes',async t=>{
  const {dist}=await fixture(t);let requests=0;
  await assert.rejects(downloadInstagramVideo('https://scontent.cdninstagram.com/video.mp4',dist,async()=>{requests++;return new Response('',{status:302,headers:{location:'https://example.com/video.mp4'}});}),/Источник видео/);
  assert.equal(requests,1);
  await assert.rejects(downloadInstagramVideo('https://scontent.cdninstagram.com/video.mp4',dist,async()=>new Response('',{headers:{'content-type':'video/mp4','content-length':String(MAX_VIDEO_BYTES+1)}})),/64 МБ/);
  await assert.rejects(downloadInstagramVideo('https://scontent.cdninstagram.com/video.mp4',dist,async()=>new Response('invalid MP4',{headers:{'content-type':'video/mp4'}})),/Видеофайл повреждён/);
});

test('attaching a player preserves current card edits and stale editors cannot remove it',async t=>{
  const {file,video}=await fixture(t),store=createCatalogStore(file);
  const media='./videos/clip-0123456789abcdef.mp4';
  await store.mutate({action:'video-save',video:{...video,name:'Curator edit'}});
  const attached=await store.mutate({action:'video-media',id:video.id,url:video.url,media});
  assert.equal(attached.video.name,'Curator edit');assert.equal(attached.video.title,video.title);
  await store.mutate({action:'video-save',video:{...video,name:'Older editor'}});
  assert.equal((await store.read()).videos[0].media,media);
  await assert.rejects(store.mutate({action:'video-media',id:video.id,url:video.url,media:'https://cdninstagram.com/temporary.mp4'}),/сохранённый видеофайл/);
  await store.mutate({action:'video-save',video:{...video,url:'https://www.instagram.com/p/CHANGED123/'}});
  assert.equal(Object.hasOwn((await store.read()).videos[0],'media'),false);
  await assert.rejects(store.mutate({action:'video-media',id:video.id,url:video.url,media}),/Ссылка карточки изменилась/);
});

test('the local player serves byte ranges for seeking, HEAD and complete videos',async t=>{
  const {file,dist}=await fixture(t),bytes=Buffer.from('0123456789abcdefghijklmnopqrstuvwxyz');
  await mkdir(join(dist,'videos'));await writeFile(join(dist,'videos','clip.mp4'),bytes);
  const app=await startServers({catalogFile:file,distDir:dist,sitePort:0,adminPort:0});t.after(()=>app.close());
  const url=app.siteUrl+'/videos/clip.mp4';
  const full=await fetch(url);assert.equal(full.headers.get('content-type'),'video/mp4');assert.deepEqual(Buffer.from(await full.arrayBuffer()),bytes);
  const partial=await fetch(url,{headers:{range:'bytes=3-8'}});assert.equal(partial.status,206);assert.equal(partial.headers.get('content-range'),'bytes 3-8/36');assert.equal(await partial.text(),'345678');
  const suffix=await fetch(url,{headers:{range:'bytes=-4'}});assert.equal(suffix.status,206);assert.equal(await suffix.text(),'wxyz');
  const head=await fetch(url,{method:'HEAD'});assert.equal(head.headers.get('content-length'),'36');assert.equal(await head.text(),'');
  const invalid=await fetch(url,{headers:{range:'bytes=36-50'}});assert.equal(invalid.status,416);assert.equal(invalid.headers.get('content-range'),'bytes */36');
});
