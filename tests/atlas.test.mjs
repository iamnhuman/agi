import test from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCatalogStore} from '../server/catalog.mjs';
import {parseArtistLink} from '../server/links.mjs';
import {importArtist} from '../server/import.mjs';
import {startServers} from '../server/http.mjs';
import {MAX_AVATAR_BYTES,remoteAvatarUrl,validateAvatarBytes} from '../server/avatar-files.mjs';

const original = JSON.parse(await readFile(new URL('../data/catalog.json',import.meta.url),'utf8'));
const draft = (name='atlas_test') => ({id:'',name,url:`https://www.instagram.com/${name}`,section:'world',description:'',image:'',tags:''});
async function fixture(t) {
  const dir=await mkdtemp(join(tmpdir(),'iizm-test-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const file=join(dir,'catalog.json');
  await writeFile(file,JSON.stringify(original));
  return {dir,file};
}

test('import URLs are restricted, normalized and preserve post identifiers',()=>{
  assert.equal(parseArtistLink('muniraalkharaz').url,'https://www.instagram.com/muniraalkharaz');
  assert.equal(parseArtistLink('@muniraalkharaz').url,'https://www.instagram.com/muniraalkharaz');
  assert.equal(parseArtistLink('http://telegram.me/s/symbimind/123?x=1').url,'https://t.me/symbimind/123');
  assert.equal(parseArtistLink('https://www.instagram.com/p/AbC12/').name,'');
  for(const url of ['http://localhost:3333','https://instagram.com.evil.test/name','https://name:pass@instagram.com/name','https://t.me/+secret','https://t.me/c/123','https://t.me/s/share','https://www.instagram.com/accounts/login','https://t.me/s/']) assert.throws(()=>parseArtistLink(url));
});

test('remote covers accept only Instagram and Telegram image CDNs',()=>{
  assert.equal(remoteAvatarUrl('https://cdn4.telesco.pe/file/photo.jpg').hostname,'cdn4.telesco.pe');
  assert.equal(remoteAvatarUrl('https://scontent.cdninstagram.com/photo.jpg').hostname,'scontent.cdninstagram.com');
  assert.equal(remoteAvatarUrl('https://instagram.fkiv9-2.fna.fbcdn.net/photo.jpg').hostname,'instagram.fkiv9-2.fna.fbcdn.net');
  for(const url of ['http://cdn4.telesco.pe/a.jpg','https://localhost/a.jpg','https://cdninstagram.com.evil.test/a.jpg'])assert.throws(()=>remoteAvatarUrl(url));
});

test('large local covers are accepted up to 50 MiB',()=>{
  assert.doesNotThrow(()=>validateAvatarBytes({length:9*1024*1024}));
  assert.doesNotThrow(()=>validateAvatarBytes({length:MAX_AVATAR_BYTES}));
  assert.throws(()=>validateAvatarBytes({length:MAX_AVATAR_BYTES+1}),/50 МБ/);
});

test('durable edits, fixed geography, duplicate checks and concurrent saves',async t=>{
  const {file}=await fixture(t);const store=createCatalogStore(file);
  await assert.rejects(store.mutate({action:'section',name:'Новый раздел'}),/только «Мир» и «Рунет»/);
  const {artist}=await store.mutate({action:'save',artist:draft()});
  assert.equal(artist.rating,'A');
  assert.equal((await createCatalogStore(file).read()).artists[0].name,'atlas_test');
  await assert.rejects(store.mutate({action:'save',artist:draft()}),/уже есть/);
  const edited={...artist,name:'Новое имя',section:'runet',image:'./avatars/instagram-0123456789abcdef.jpg'};
  await store.mutate({action:'save',artist:edited});
  assert.equal((await store.read()).artists[0].section,'runet');
  assert.equal((await store.read()).artists[0].image,edited.image);
  await store.mutate({action:'save',artist:{...edited,rating:'AAA'}});
  assert.equal((await store.read()).artists[0].rating,'AAA');
  await store.mutate({action:'save',artist:{...edited,rating:'AAA+'}});
  assert.equal((await store.read()).artists[0].rating,'AAA+');
  await store.mutate({action:'save',artist:{...edited,rating:'CRINGE'}});
  assert.equal((await store.read()).artists[0].rating,'A');
  await assert.rejects(store.mutate({action:'save',artist:{...edited,rating:'B'}}),/тег A/);
  await store.mutate({action:'save',artist:{...edited,image:'./avatars/upload-0123456789abcdef.webp'}});
  assert.equal((await store.read()).artists[0].image,'./avatars/upload-0123456789abcdef.webp');
  await Promise.all(Array.from({length:4},(_,i)=>store.mutate({action:'save',artist:draft(`atlas_parallel_${i}`)})));
  assert.equal((await store.read()).artists.length,original.artists.length+5);
  await store.mutate({action:'delete',id:artist.id});
  assert.equal((await createCatalogStore(file).read()).artists.length,original.artists.length+4);
  const before=await readFile(file,'utf8');
  await assert.rejects(store.mutate({action:'save',artist:{...draft('bad_image'),image:'javascript:alert(1)'}}),/HTTPS/);
  assert.equal(await readFile(file,'utf8'),before);
});

test('metadata import and blocked-page fallback both create usable drafts',async()=>{
  const full=await importArtist('https://t.me/symbimind',async()=>new Response('<meta content="SYMBIMIND" property="og:title"><meta property="og:description" content="Art &amp; AI"><meta property="og:image" content="https://cdn4.telesco.pe/file/photo.jpg">',{headers:{'content-type':'text/html'}}));
  assert.equal(full.artist.name,'SYMBIMIND');assert.equal(full.artist.description,'Art & AI');assert.equal(full.profileAvatar,true);assert.equal(full.artist.image,'https://cdn4.telesco.pe/file/photo.jpg');
  const blocked=await importArtist('https://instagram.com/test_artist/',async()=>new Response('',{status:403}));
  assert.equal(blocked.artist.name,'test_artist');assert.equal(blocked.artist.platform,'Instagram');
  const redirected=await importArtist('https://t.me/artist',async(_url,options)=>{assert.equal(options.redirect,'manual');return new Response('',{status:302,headers:{location:'http://127.0.0.1/'}});});
  assert.equal(redirected.artist.name,'artist');
});

test('two anonymous local URLs; public port read-only; writes reject foreign origins and hosts',async t=>{
  const {dir,file}=await fixture(t);const dist=join(dir,'dist');await mkdir(dist);
  await writeFile(join(dist,'index.html'),'<html><head></head><body>CATALOG</body></html>');
  await writeFile(join(dist,'admin.html'),'<html><head></head><body>CURATOR</body></html>');
  const app=await startServers({catalogFile:file,distDir:dist,sitePort:0,adminPort:0});t.after(()=>app.close());
  assert.match(await (await fetch(app.siteUrl)).text(),/CATALOG/);
  assert.match(await (await fetch(app.adminUrl)).text(),/CURATOR/);
  const body={action:'save',artist:draft('http_test')};
  const post=(base,origin=base)=>fetch(base+'/api/catalog',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await post(app.siteUrl)).status,403);
  assert.equal((await post(app.adminUrl,'https://evil.example')).status,403);
  const wrongHost = await new Promise((resolve,reject)=>{const req=http.get(app.adminUrl+'/api/catalog',{headers:{host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);});
  assert.equal(wrongHost,403);
  const saved=await post(app.adminUrl);assert.equal(saved.status,200);
  const {artist}=await saved.json();
  const rated=await fetch(app.adminUrl+'/api/catalog',{method:'POST',headers:{origin:app.adminUrl,'content-type':'application/json'},body:JSON.stringify({action:'save',artist:{...artist,rating:'AAA+'}})});
  assert.equal(rated.status,200);
  assert.equal((await rated.json()).artist.rating,'AAA+');
  assert.equal((await (await fetch(app.adminUrl+'/api/catalog')).json()).artists.find(a=>a.id===artist.id).rating,'AAA+');
  assert.ok((await (await fetch(app.siteUrl+'/api/catalog')).json()).artists.some(a=>a.id===artist.id));
  assert.equal((await fetch(app.adminUrl+'/api/catalog',{method:'POST',headers:{origin:app.adminUrl,'content-type':'application/json'},body:JSON.stringify({long:'x'.repeat(25000)})})).status,413);
});

test('media records retain their type through editing and legacy records remain artists',async t=>{
  const {file}=await fixture(t);const store=createCatalogStore(file);
  const {artist:media}=await store.mutate({action:'save',artist:{...draft('test_media'),kind:'media',section:'runet'}});
  assert.equal(media.kind,'media');
  const {artist:collective}=await store.mutate({action:'save',artist:{...draft('test_collective'),kind:'collective',section:'world'}});
  assert.equal(collective.kind,'collective');
  const {kind,...legacyClientEdit}=media;
  await store.mutate({action:'save',artist:{...legacyClientEdit,name:'Edited media'}});
  assert.equal((await createCatalogStore(file).read()).artists.find(a=>a.id===media.id).kind,'media');
  const {artist:person}=await store.mutate({action:'save',artist:draft('test_person')});
  assert.equal(person.kind,'artist');
  await assert.rejects(store.mutate({action:'save',artist:{...draft('invalid_type'),kind:'other'}}),/тип/);
});

test('video dates, comments, persistence and alternate sources',async t=>{
  const {videoLink,videoMetadata,validVideoDate}=await import('../server/video-import.mjs');
  assert.equal(videoLink('https://youtu.be/1iZ8CmAsgr0&t=68').videoId,'1iZ8CmAsgr0');
  assert.equal(validVideoDate('2025-02-30'),false);
  assert.equal(validVideoDate('2024-02-29'),true);
  const comment=videoLink('https://t.me/quietspam/285?comment=6203');
  assert.equal(videoMetadata('<time datetime="2025-01-01T00:00:00Z"></time>',comment).publishedAt,'');
  const post=videoLink('https://t.me/hypernormis/291/313');
  assert.equal(post.fetchUrl,'https://t.me/hypernormis/313?embed=1&mode=tme');
  const {file}=await fixture(t);const store=createCatalogStore(file);
  const {video}=await store.mutate({action:'video-save',video:{name:'Test video',url:'https://youtu.be/abcdefghijk',publishedAt:'2024-02-29',dateSource:'manual',description:''}});
  assert.equal((await createCatalogStore(file).read()).videos.find(v=>v.id===video.id).publishedAt,'2024-02-29');
  await store.mutate({action:'video-save',video:{...video,publishedAt:''}});
  assert.equal((await store.read()).videos.find(v=>v.id===video.id).dateSource,'unknown');
  await store.mutate({action:'video-delete',id:video.id});
  assert.ok(!(await store.read()).videos.some(v=>v.id===video.id));
});

 test('Instagram import uses username rather than display name',async()=>{
 const fetcher=async()=>new Response('<meta property="og:title" content="icy (@icysaw) • Instagram photos and videos">',{headers:{'content-type':'text/html'}});
 assert.equal((await importArtist('https://instagram.com/icysaw/',fetcher)).artist.name,'icysaw');
 assert.equal((await importArtist('https://instagram.com/p/ABC123/',fetcher)).artist.name,'icysaw');
 });

test('HD avatar must belong to the requested Instagram account',async()=>{
 const {instagramAvatar,lowResolutionInstagramImage}=await import('../server/import.mjs');
 const html='<script type="application/json">'+JSON.stringify({users:[{username:'other',profile_pic_url_hd:'https://scontent.cdninstagram.com/wrong.jpg'},{username:'icysaw',hd_profile_pic_versions:[{url:'https://scontent.cdninstagram.com/320.jpg',width:320},{url:'https://scontent.cdninstagram.com/1080.jpg',width:1080}]}]})+'</script>';
 assert.equal(instagramAvatar(html,'icysaw','small.jpg'),'https://scontent.cdninstagram.com/1080.jpg');
 assert.equal(instagramAvatar(html,'missing','small.jpg'),'small.jpg');
 assert.equal(lowResolutionInstagramImage('https://cdninstagram.com/photo.jpg?stp=dst-jpg_s100x100_tt6'),true);
});

test('Instagram profile import never substitutes a timeline post for an avatar',async()=>{
 const small='https://scontent.cdninstagram.com/avatar.jpg?stp=dst-jpg_s100x100_tt6';
 const html='<meta property="og:title" content="icy (@icysaw) • Instagram photos and videos"><meta property="og:image" content="'+small+'"><script type="application/json">'+JSON.stringify({profile:{username:'icysaw'},polaris_timeline_connection:{edges:[{node:{image_versions2:{candidates:[{width:1440,height:1920,url:'https://instagram.example.fna.fbcdn.net/feed-photo.webp'}]}}}]}})+'</script>';
 const result=await importArtist('https://instagram.com/icysaw/',async()=>new Response(html,{headers:{'content-type':'text/html'}}));
 assert.equal(result.artist.image,small);
 assert.equal(result.lowResolution,true);
});

test('Instagram profile img is matched by username and HTML entities are decoded',async()=>{
 const {instagramAvatar}=await import('../server/import.mjs');
 const html=`<img alt="gulmannn's profile picture" src="https://instagram.example.fna.fbcdn.net/photo.jpg?x=1&amp;y=2">`;
 assert.equal(instagramAvatar(html,'gulmannn','small.jpg'),'https://instagram.example.fna.fbcdn.net/photo.jpg?x=1&y=2');
 assert.equal(instagramAvatar(html,'someone_else','small.jpg'),'small.jpg');
});
