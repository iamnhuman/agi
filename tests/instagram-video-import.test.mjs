import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {importVideo,videoLink,videoMetadata} from '../server/video-import.mjs';
import {startServers} from '../server/http.mjs';

const source='https://www.instagram.com/p/DecFJCoMpXq/';
const image='https://scontent.cdninstagram.com/post.jpg';
const page=`<meta property="og:title" content="Электро клуб | Тюмень on Instagram: &quot;(НЕ)HALLOWEEN
31 ОКТЯБРЯ
Выступает @other_artist&quot;">
<meta property="og:description" content="315 likes, 401 comments - electroclub.tmn on October 13, 2026: &quot;(НЕ)HALLOWEEN
31 ОКТЯБРЯ
Выступает @other_artist&quot;">
<meta property="og:image" content="${image}">`;
const html=body=>new Response(body,{headers:{'content-type':'text/html'}});

test('Instagram imports the owner from multiline public metadata when the caption mentions other artists',async()=>{
 const result=await importVideo(source,async url=>{assert.equal(url,source);return html(page);});
 assert.equal(result.name,'electroclub.tmn');assert.equal(result.image,image);
 assert.equal(result.publishedAt,'2026-10-13');assert.equal(result.dateSource,'source');assert.equal(result.dateUrl,source);
});

test('Instagram imports the publication date without engagement counts for posts and reels',async()=>{
 for(const kind of ['p','reel']){
  const url=`https://www.instagram.com/${kind}/DfAhqoNn5NN/`;
  const result=await importVideo(url,async()=>html(`<meta name="description" content="200000000000lightyears on October 27, 2026: &quot;EV3r1thing Is N0th1N6\ncollab w/ @uzvle&quot;">`));
  assert.equal(result.name,'200000000000lightyears');assert.equal(result.publishedAt,'2026-10-27');
  assert.equal(result.dateSource,'source');assert.equal(result.dateUrl,url);
 }
});

test('Instagram description dates validate calendar days and require a complete publication header',()=>{
 const link=videoLink(source);
 const metadata=value=>videoMetadata(`<meta property="og:description" content="${value}">`,link);
 const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
 for(const [index,month] of months.entries())assert.equal(metadata(`12 likes - artist on ${month} 9, 2026: Caption`).publishedAt,`2026-${String(index+1).padStart(2,'0')}-09`);
 assert.equal(metadata('artist on February 29, 2024: Caption').publishedAt,'2024-02-29');
 for(const header of ['February 29, 2026','February 30, 2024','April 31, 2026','October 0, 2026','October 27','10/27/2026','Tomorrow 27, 2026']){
  const result=metadata(`artist on ${header}: Event on October 31, 2026`);
  assert.equal(result.publishedAt,'',header);assert.equal(result.dateSource,'unknown');assert.equal(result.dateUrl,'');
 }
 for(const description of ['Event on October 31, 2026','Caption\nartist on October 31, 2026: Event'])assert.equal(metadata(description).publishedAt,'');
});

test('Instagram retains explicit source dates and falls back to the ordinary description when needed',()=>{
 const link=videoLink(source);
 const explicit=videoMetadata(page+'<meta property="article:published_time" content="2026-10-12T23:30:00-07:00">',link);
 assert.equal(explicit.publishedAt,'2026-10-12');
 const upload=videoMetadata(page+'<script type="application/ld+json">{"uploadDate":"2026-10-11T23:30:00Z"}</script>',link);
 assert.equal(upload.publishedAt,'2026-10-11');
 const fallback=videoMetadata('<meta property="og:description" content="artist on February 30, 2026: Caption"><meta name="description" content="artist on February 28, 2026: Caption">',link);
 assert.equal(fallback.publishedAt,'2026-02-28');
});

test('Instagram falls back to the title author and decodes entities without including the caption',()=>{
 for(const url of [source,'https://www.instagram.com/reel/DecFJCoMpXq/']){
  const link=videoLink(url);
  assert.equal(videoMetadata(page.replace('og:description','unused'),link).name,'Электро клуб | Тюмень');
  assert.equal(videoMetadata('<meta property="og:title" content="  Artist &amp; &#x41;I   on Instagram: &quot;Caption\n@someone_else&quot;">',link).name,'Artist & AI');
  assert.equal(videoMetadata('<meta name="twitter:title" content="Артист в Instagram: &quot;Публикация&quot;">',link).name,'Артист');
 }
});

test('Instagram accepts ordinary description and profile-title metadata',()=>{
 const link=videoLink(source);
 assert.equal(videoMetadata('<meta name="description" content="electroclub.tmn on October 13, 2026: &quot;Caption&quot;">',link).name,'electroclub.tmn');
 assert.equal(videoMetadata('<meta property="og:title" content="Электро клуб (@electroclub.tmn) • Instagram photos and videos">',link).name,'electroclub.tmn');
 assert.equal(videoMetadata('<meta property="og:title" content="'+'a'.repeat(200)+' on Instagram: Caption">',link).name.length,160);
});

test('Instagram does not mistake login pages, bare captions or mentions for the author',async()=>{
 const link=videoLink(source);
 for(const title of ['Instagram','Login • Instagram','Log in • Instagram','Войти • Instagram','Caption @other_artist']){
  assert.equal(videoMetadata(`<meta property="og:title" content="${title}"><meta property="og:description" content="Visit @other_artist for details">`,link).name,'');
 }
 const result=await importVideo(source,async()=>new Response('',{status:403}));
 assert.equal(result.name||'','');assert.equal(result.image,'');
});

test('video import API keeps the public Instagram author when the session fails and saves it with the card',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'atlas-instagram-video-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const file=join(dir,'catalog.json'),dist=join(dir,'dist');await mkdir(dist);
 await writeFile(file,JSON.stringify({sections:[],artists:[],videos:[]}));
 const app=await startServers({catalogFile:file,distDir:dist,sitePort:0,adminPort:0,
  fetcher:async url=>url===source?html(page):new Response('',{status:403}),
  instagramPost:async shortcode=>{assert.equal(shortcode,'DecFJCoMpXq');throw Error('Session unavailable');},
 });t.after(()=>app.close());
 const post=(path,body)=>fetch(app.adminUrl+path,{method:'POST',headers:{origin:app.adminUrl,'content-type':'application/json'},body:JSON.stringify(body)});
 const response=await post('/api/video-import',{url:source});assert.equal(response.status,200);
 const imported=await response.json();assert.equal(imported.name,'electroclub.tmn');assert.equal(imported.sessionNotice,'Session unavailable');
 assert.equal(imported.publishedAt,'2026-10-13');assert.equal(imported.dateSource,'source');assert.equal(imported.dateUrl,source);
 const saved=await post('/api/catalog',{action:'video-save',video:imported});assert.equal(saved.status,200);
 assert.equal((await saved.json()).video.name,'electroclub.tmn');
 const catalog=await (await fetch(app.siteUrl+'/api/catalog')).json();assert.equal(catalog.videos[0].name,'electroclub.tmn');
 assert.equal(catalog.videos[0].publishedAt,'2026-10-13');assert.equal(catalog.videos[0].dateSource,'source');assert.equal(catalog.videos[0].dateUrl,source);
});

test('video import API prefers the authenticated Instagram owner when available',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'atlas-instagram-video-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const file=join(dir,'catalog.json'),dist=join(dir,'dist');await mkdir(dist);
 await writeFile(file,JSON.stringify({sections:[],artists:[],videos:[]}));
 const app=await startServers({catalogFile:file,distDir:dist,sitePort:0,adminPort:0,
  fetcher:async url=>url===source?html(page.replace('og:description','unused')):new Response('',{status:403}),
  instagramPost:async()=>({url:image,name:'electroclub.tmn',publishedAt:'2026-10-13',isVideo:false}),
 });t.after(()=>app.close());
 const response=await fetch(app.adminUrl+'/api/video-import',{method:'POST',headers:{origin:app.adminUrl,'content-type':'application/json'},body:JSON.stringify({url:source})});
 assert.equal(response.status,200);
 const result=await response.json();assert.equal(result.name,'electroclub.tmn');assert.equal(result.publishedAt,'2026-10-13');assert.equal(result.image,image);
});
