import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {importVideo,videoLink,videoMetadata} from '../server/video-import.mjs';
import {startServers} from '../server/http.mjs';

const source='https://youtu.be/nXM--ulGkSA?si=share';
const watch='https://www.youtube.com/watch?v=nXM--ulGkSA';
const image='https://i.ytimg.com/vi/nXM--ulGkSA/maxresdefault.jpg';
const page='<meta property="og:title" content="Song title"><meta property="og:image" content="'+image+'"><meta itemprop="datePublished" content="2026-10-28"><span itemprop="author" itemscope itemtype="http://schema.org/Person"><link itemprop="url" href="https://www.youtube.com/@artist"><link itemprop="name" content="Артист &amp; группа"></span>';
const html=body=>new Response(body,{headers:{'content-type':'text/html'}});
const embed=data=>new Response(JSON.stringify({provider_name:'YouTube',title:'Song title',author_name:'Имя артиста',...data}),{headers:{'content-type':'application/json'}});
const blocked=()=>new Response('',{status:403});

test('YouTube imports the channel name while retaining the cover and publication date',async()=>{
 const requested=[];
 const result=await importVideo(source,async(url,options)=>{
  requested.push(url);assert.equal(options.redirect,'manual');
  if(url===watch)return html(page);
  const endpoint=new URL(url);
  assert.equal(endpoint.origin+endpoint.pathname,'https://www.youtube.com/oembed');
  assert.equal(endpoint.searchParams.get('url'),watch);assert.equal(endpoint.searchParams.get('format'),'json');
  return embed();
 });
 assert.equal(requested.length,2);assert.equal(result.name,'Имя артиста');
 assert.equal(result.image,image);assert.equal(result.publishedAt,'2026-10-28');
 assert.equal(result.dateSource,'source');assert.equal(result.dateUrl,watch);assert.equal(result.isVideo,true);
});

test('YouTube still imports the author when the watch page is blocked',async()=>{
 for(const url of [source,watch,'https://www.youtube.com/shorts/nXM--ulGkSA','https://www.youtube.com/embed/nXM--ulGkSA']){
  const result=await importVideo(url,async endpoint=>endpoint===watch?blocked():embed({author_name:'  Артист\n  & группа  '}));
  assert.equal(result.name,'Артист & группа');assert.equal(result.image,'https://i.ytimg.com/vi/nXM--ulGkSA/hqdefault.jpg');
  assert.equal(result.publishedAt,'');assert.equal(result.dateSource,'unknown');
 }
});

test('YouTube falls back to the page author if oEmbed fails or omits the author',async()=>{
 for(const response of [blocked,()=>embed({author_name:''}),()=>embed({author_name:{name:'Wrong'}}),()=>embed({provider_name:'Other'}),()=>html('not JSON'),()=>{throw Error('Network error');}]){
  const result=await importVideo(source,async url=>url===watch?html(page):response());
  assert.equal(result.name,'Артист & группа');assert.equal(result.image,image);assert.equal(result.publishedAt,'2026-10-28');
 }
});

test('page author parsing respects author scope, entities and name length',()=>{
 const link=videoLink(source);
 assert.equal(videoMetadata('<meta itemprop="name" content="Video title">'+page,link).name,'Артист & группа');
 assert.equal(videoMetadata("<span itemprop='author'><meta itemprop='name' content='&#65;rtist &quot;AI&quot;'></span>",link).name,'Artist "AI"');
 assert.equal(videoMetadata('<meta name="author" content="  Artist   name ">',link).name,'Artist name');
 assert.equal(videoMetadata('<meta name="author" content="'+'a'.repeat(200)+'">',link).name.length,160);
 assert.equal(videoMetadata(page,videoLink('https://vk.com/video-1_2')).name,undefined);
});

test('missing YouTube authors leave the field empty instead of substituting a video title',async()=>{
 const result=await importVideo(source,async url=>url===watch?html('<meta property="og:title" content="Video title">'):embed({author_name:undefined}));
 assert.equal(result.name,'');assert.equal(result.isVideo,true);assert.equal(result.publishedAt,'');
 const unavailable=await importVideo(source,async()=>{throw Error('Network error');});
 assert.equal(unavailable.name,'');assert.equal(unavailable.image,'https://i.ytimg.com/vi/nXM--ulGkSA/hqdefault.jpg');
});

test('video import API returns the YouTube author and saves it with the card',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'atlas-youtube-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const file=join(dir,'catalog.json'),dist=join(dir,'dist');await mkdir(dist);
 await writeFile(file,JSON.stringify({sections:[],artists:[],videos:[]}));
 const fetcher=async url=>url===watch?html(page):new URL(url).pathname==='/oembed'?embed():blocked();
 const app=await startServers({catalogFile:file,distDir:dist,sitePort:0,adminPort:0,fetcher});t.after(()=>app.close());
 const post=(path,body)=>fetch(app.adminUrl+path,{method:'POST',headers:{origin:app.adminUrl,'content-type':'application/json'},body:JSON.stringify(body)});
 const response=await post('/api/video-import',{url:source});assert.equal(response.status,200);
 const imported=await response.json();assert.equal(imported.name,'Имя артиста');assert.equal(imported.publishedAt,'2026-10-28');
 const saved=await post('/api/catalog',{action:'video-save',video:imported});assert.equal(saved.status,200);
 assert.equal((await saved.json()).video.name,'Имя артиста');
 const catalog=await (await fetch(app.siteUrl+'/api/catalog')).json();assert.equal(catalog.videos[0].name,'Имя артиста');
});
