import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {parseSoundCloudUrl,soundcloudPlayerUrl} from '../lib/soundcloud.mjs';
import {videoLink,importVideo} from '../server/video-import.mjs';
import {downloadVideoImage} from '../server/video-images.mjs';
import {startServers} from '../server/http.mjs';

const track='https://soundcloud.com/artist/track',playlist='https://soundcloud.com/artist/sets/album';
const cover='https://i1.sndcdn.com/artworks-cover-t500x500.jpg';
const json=data=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
const html=body=>new Response(body,{headers:{'content-type':'text/html'}});
const blocked=()=>new Response('',{status:403});
const embed=(data={})=>json({provider_name:'SoundCloud',title:'Album by Artist',thumbnail_url:cover,...data});
const hydration=(url,data={})=>'<script>window.__sc_hydration = '+JSON.stringify([
 {hydratable:'user',data:{permalink_url:'https://soundcloud.com/artist',username:'Artist',created_at:'2000-01-01T00:00:00Z'}},
 {hydratable:url.includes('/sets/')?'playlist':'sound',data:{permalink_url:url,title:'Album',user:{username:'Artist'},created_at:'2025-02-03T23:45:00Z',release_date:'2003-01-01T00:00:00Z',artwork_url:cover,...data}},
])+';</script>';

test('SoundCloud links normalize tracks, playlists, profiles and sharing parameters',()=>{
 for(const [url,canonical,reference] of [
  ['http://www.soundcloud.com/Artist/Track/?utm_source=share#t=10',track,false],
  ['https://m.soundcloud.com/artist/sets/album?si=tracking',playlist,false],
  ['https://soundcloud.com/artist/sets','https://soundcloud.com/artist',true],
  ['https://soundcloud.com/artist','https://soundcloud.com/artist',true],
  ['https://on.soundcloud.com/AbCd123?utm_source=share','https://on.soundcloud.com/AbCd123',false],
  ['https://soundcloud.app.goo.gl/AbCd123','https://soundcloud.app.goo.gl/AbCd123',false],
 ]){
  const result=videoLink(url);
  assert.equal(result.platform,'SoundCloud');assert.equal(result.videoId,'');
  assert.equal(result.url,canonical);assert.equal(result.reference,reference);assert.equal(result.fetchUrl,canonical);
 }
 assert.equal(videoLink(track+'/s-AbCd123?utm_source=share').url,track+'/s-AbCd123');
 assert.equal(videoLink(playlist+'?secret_token=s-AbCd123&utm_source=share').url,playlist+'?secret_token=s-AbCd123');
 for(const url of ['https://soundcloud.com','https://soundcloud.com/search?q=music','https://soundcloud.com/artist/sets/album/extra','https://on.soundcloud.com/a/b','https://user:pass@soundcloud.com/artist/track','https://soundcloud.com:123/artist/track','https://soundcloud.com/artist/%2Ftrack'])assert.throws(()=>videoLink(url));
 assert.equal(videoLink('https://soundcloud.com.evil.test/artist/track').platform,'Сайт');
 assert.throws(()=>parseSoundCloudUrl('https://evil.test/artist/track'));
});

test('track and playlist widgets encode their URL and preserve private sharing tokens',()=>{
 for(const url of [track,playlist,playlist+'?secret_token=s-AbCd123']){
  const player=new URL(soundcloudPlayerUrl(url));
  assert.equal(player.origin,'https://w.soundcloud.com');
  assert.equal(player.pathname,'/player/');assert.equal(player.searchParams.get('url'),url);
  assert.equal(player.searchParams.get('auto_play'),'true');
 }
 for(const url of ['https://soundcloud.com/artist','https://on.soundcloud.com/AbCd','javascript:alert(1)','https://evil.test/track'])assert.equal(soundcloudPlayerUrl(url),'');
});

test('SoundCloud imports oEmbed metadata and the playlist publication date, never the release or nested track date',async()=>{
 const requested=[];
 const result=await importVideo(playlist,async(url,options)=>{
  requested.push(url);assert.equal(options.redirect,'manual');
  return new URL(url).pathname==='/oembed'?embed():html(hydration(playlist,{display_date:'2025-04-05T08:00:00Z',tracks:[{created_at:'1999-01-01T00:00:00Z'}]}));
 });
 assert.equal(requested.length,2);assert.equal(result.name,'Album by Artist');assert.equal(result.image,cover);
 assert.equal(result.publishedAt,'2025-04-05');assert.equal(result.dateSource,'source');assert.equal(result.dateUrl,playlist);
 assert.equal(result.platform,'SoundCloud');assert.equal(result.reference,false);assert.equal(result.isVideo,false);assert.equal(result.metadataLoaded,true);
 const noDate=await importVideo(playlist,async url=>url===playlist?html(hydration(playlist,{created_at:undefined,tracks:[{created_at:'2025-01-01T00:00:00Z'}]})):embed());
 assert.equal(noDate.publishedAt,'');assert.equal(noDate.dateSource,'unknown');assert.equal(noDate.dateUrl,'');
});

test('page metadata imports when oEmbed is blocked, with a full-size Open Graph cover',async()=>{
 const page=hydration(track,{artwork_url:'https://i1.sndcdn.com/artworks-cover-large.jpg'})+`<meta property="og:url" content="${track}"><meta property="og:image" content="${cover}">`;
 const result=await importVideo(track,async url=>url===track?html(page):blocked());
 assert.equal(result.name,'Album — Artist');assert.equal(result.image,cover);assert.equal(result.publishedAt,'2025-02-03');
 const minimal=await importVideo(track,async url=>url===track?html(`<meta property="og:url" content="${track}"><meta property="og:title" content="Track &amp; artist"><meta property="og:image" content="${cover}"><meta property="article:published_time" content="2025-06-07T00:00:00Z">`):blocked());
 assert.equal(minimal.name,'Track & artist');assert.equal(minimal.publishedAt,'2025-06-07');
});

test('JSON-LD selects the requested recording or playlist without borrowing another item’s date',async()=>{
 const page=`<script type="application/ld+json">${JSON.stringify({'@graph':[
  {'@type':'MusicRecording',url:track,datePublished:'2000-01-01'},
  {'@type':'MusicPlaylist',url:playlist,datePublished:'2025-06-07'},
 ]})}</script>`;
 const result=await importVideo(playlist,async url=>url===playlist?html(page):embed());
 assert.equal(result.publishedAt,'2025-06-07');
 const other=await importVideo(playlist,async url=>url===playlist?html(hydration(track)):embed());
 assert.equal(other.publishedAt,'');
});

test('profile references have their own artwork and no publication date',async()=>{
 const url='https://soundcloud.com/artist';
 const result=await importVideo(url,async source=>source===url?html(hydration(track)):embed({title:'Artist'}));
 assert.equal(result.reference,true);assert.equal(result.name,'Artist');assert.equal(result.image,cover);
 assert.equal(result.publishedAt,'');assert.equal(result.dateSource,'unknown');assert.equal(result.isVideo,false);
});

test('short links resolve to canonical playlists before requesting metadata',async()=>{
 const short='https://on.soundcloud.com/AbCd123',requested=[];
 const result=await importVideo(short,async url=>{
  requested.push(url);
  if(url===short)return new Response('',{status:302,headers:{location:playlist+'?si=tracking'}});
  return url===playlist?html(hydration(playlist)):embed();
 });
 assert.equal(result.url,playlist);assert.equal(result.fetchUrl,playlist);assert.equal(result.publishedAt,'2025-02-03');
 assert.deepEqual(requested.slice(0,2),[short,playlist]);
 assert.equal(new URL(requested[2]).searchParams.get('url'),playlist);
});

test('unavailable metadata leaves an editable draft without loading foreign redirects or covers',async()=>{
 for(const location of ['http://127.0.0.1/private','https://evil.test/track','https://soundcloud.com/login','https://soundcloud.com.evil.test/artist/track']){
  const requested=[];
  const result=await importVideo('https://on.soundcloud.com/AbCd',async url=>{requested.push(url);return new Response('',{status:302,headers:{location}});});
  assert.equal(requested.length,1);assert.equal(result.metadataLoaded,false);assert.match(result.notice,/SoundCloud.*вручную/);
 }
 const wrong=await importVideo(track,async url=>url===track?html('<title>SoundCloud - Hear the world’s sounds</title>'):embed({provider_name:'Other'}));
 assert.equal(wrong.metadataLoaded,false);assert.equal(wrong.image,'');assert.equal(wrong.publishedAt,'');
 const foreignImage=await importVideo(track,async url=>url===track?blocked():embed({thumbnail_url:'https://evil.test/image.jpg'}));
 assert.equal(foreignImage.image,'');assert.equal(foreignImage.name,'Album by Artist');
 const partial=await importVideo(track,async url=>url===track?blocked():embed());
 assert.equal(partial.image,cover);assert.equal(partial.publishedAt,'');assert.equal(partial.metadataLoaded,true);
});

test('SoundCloud image downloads reject lookalike hosts and redirects to other sites',async()=>{
 const requested=[];
 const fetcher=async url=>{requested.push(url.href);return new Response('',{status:302,headers:{location:'https://evil.test/photo.jpg'}});};
 await assert.rejects(downloadVideoImage(cover,'/tmp/unused',fetcher),/источник изображения/);
 for(const url of ['http://i1.sndcdn.com/photo.jpg','https://i1.sndcdn.com.evil.test/photo.jpg','https://user:pass@i1.sndcdn.com/photo.jpg','https://i1.sndcdn.com:123/photo.jpg'])await assert.rejects(downloadVideoImage(url,'/tmp/unused',fetcher),/источник изображения/);
 assert.deepEqual(requested,[cover]);
});

test('SoundCloud API imports, caches covers, persists source dates and catches duplicate aliases',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'atlas-soundcloud-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const file=join(dir,'catalog.json'),dist=join(dir,'dist');await mkdir(dist);
 await writeFile(file,JSON.stringify({sections:[],artists:[],videos:[]}));
 const bytes=Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1cAAAAASUVORK5CYII=','base64'),Buffer.from(randomUUID())]);
 const fetcher=async url=>new URL(url).hostname==='i1.sndcdn.com'?new Response(bytes,{headers:{'content-type':'image/png'}}):new URL(url).pathname==='/oembed'?embed():html(hydration(playlist));
 const app=await startServers({catalogFile:file,distDir:dist,sitePort:0,adminPort:0,fetcher});t.after(()=>app.close());
 const post=(path,body)=>fetch(app.adminUrl+path,{method:'POST',headers:{origin:app.adminUrl,'content-type':'application/json'},body:JSON.stringify(body)});
 const response=await post('/api/video-import',{url:playlist});assert.equal(response.status,200);
 const imported=await response.json();assert.equal(imported.imageSavedLocally,true);assert.match(imported.image,/^\.\/avatars\/upload-[a-f0-9]{16}\.png$/);
 t.after(()=>rm(resolve('public',imported.image.slice(2)),{force:true}));
 assert.deepEqual(await readFile(join(dist,imported.image.slice(2))),bytes);
 const saved=await post('/api/catalog',{action:'video-save',video:imported});assert.equal(saved.status,200);
 const {video}=await saved.json();assert.equal(video.platform,'SoundCloud');assert.equal(video.reference,false);assert.equal(video.isVideo,false);assert.equal(video.dateSource,'source');assert.equal(video.dateUrl,playlist);
 const catalog=await(await fetch(app.siteUrl+'/api/catalog')).json();assert.equal(catalog.videos[0].image,imported.image);assert.equal(catalog.videos[0].publishedAt,'2025-02-03');
 const duplicate=await post('/api/catalog',{action:'video-save',video:{...imported,url:'https://www.soundcloud.com/artist/sets/album/?utm_source=share'}});assert.equal(duplicate.status,400);assert.match((await duplicate.json()).error,/уже есть/);
 const direct=await post('/api/video-image',{url:cover});assert.equal(direct.status,200);assert.equal((await direct.json()).image,imported.image);
 assert.equal((await fetch(app.siteUrl+'/'+imported.image.slice(2))).status,200);
});
