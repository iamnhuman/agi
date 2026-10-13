import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {completedProfileUrl} from '../lib/profile-url.mjs';
import {parseArtistLink,linkKey} from '../server/links.mjs';
import {remoteAvatarUrl,downloadRemoteAvatar} from '../server/avatar-files.mjs';
import {importArtist} from '../server/import.mjs';
import {createCatalogStore} from '../server/catalog.mjs';
import {startServers} from '../server/http.mjs';

const json=data=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
const blocked=()=>new Response('',{status:403});
const community=(data={})=>({kind:'t5',data:{display_name:'aivideo',public_description:'AI video community',community_icon:'https://styles.redditmedia.com/t5_test/styles/communityIcon_test.png?width=256&amp;s=signature',...data}});
const post=(data={})=>[{kind:'Listing',data:{children:[{kind:'t3',data:{id:'abc123',title:'AI artwork',selftext:'A new photo',...data}}]}},{kind:'Listing',data:{children:[]}}];

async function fixture(t){
  const dir=await mkdtemp(join(tmpdir(),'atlas-reddit-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const file=join(dir,'catalog.json');
  await writeFile(file,JSON.stringify({sections:[{id:'world',name:'Мир'}],artists:[],videos:[]}));
  return {dir,file};
}

test('Reddit communities, profiles, posts and host variants normalize consistently',()=>{
  for(const source of ['https://www.reddit.com/r/aivideo/','reddit.com/r/aivideo','r/aivideo','http://old.reddit.com/r/AIVideo/top/?t=all','https://new.reddit.com/r/aivideo/about']){
    const link=parseArtistLink(source);
    assert.equal(link.url,'https://www.reddit.com/r/aivideo');
    assert.equal(link.platform,'Reddit');
    assert.equal(link.isPost,false);
    assert.equal(link.fetchUrl,'https://www.reddit.com/r/aivideo/about.json?raw_json=1');
  }
  for(const source of ['u/Artist_Name','https://m.reddit.com/user/Artist_Name/'])assert.equal(parseArtistLink(source).url,'https://www.reddit.com/user/artist_name');
  const sources=['https://www.reddit.com/r/aivideo/comments/AbC123/title/comment1/?utm_source=share','redd.it/abc123','https://reddit.com/gallery/abc123','https://www.reddit.com/comments/abc123/title'];
  for(const source of sources){
    assert.equal(parseArtistLink(source).url,'https://www.reddit.com/comments/abc123');
    assert.equal(linkKey(source),linkKey(sources[0]));
  }
  assert.equal(completedProfileUrl('r/aivideo'),'https://www.reddit.com/r/aivideo');
  assert.equal(completedProfileUrl('@instagram_name'),'https://www.instagram.com/instagram_name');
  assert.equal(completedProfileUrl('old.reddit.com/r/aivideo'),'https://old.reddit.com/r/aivideo');
});

test('Reddit parsing rejects foreign hosts, credentials, private routes and incomplete posts',()=>{
  for(const source of ['https://reddit.com.evil.test/r/aivideo','https://evil.reddit.com/r/aivideo','https://name:pass@reddit.com/r/aivideo','https://reddit.com:444/r/aivideo','https://reddit.com/login','https://reddit.com/r/aivideo/wiki','https://reddit.com/r/aivideo/comments/','https://reddit.com/message/inbox','https://redd.it/r/aivideo','https://reddit.com/user/artist/submitted','https://reddit.com/r/aivideo+sensitive'])assert.throws(()=>parseArtistLink(source));
});

test('Reddit images retain signed queries and only approved image hosts are fetched',()=>{
  for(const host of ['styles.redditmedia.com','www.redditstatic.com','i.redd.it','preview.redd.it','external-preview.redd.it'])assert.equal(remoteAvatarUrl(`https://${host}/photo.png?width=256&s=signature`).hostname,host);
  for(const source of ['https://reddit.com/r/aivideo','https://v.redd.it/video','https://i.redd.it.evil.test/photo.png','https://redditmedia.com.evil.test/photo.png','https://photo:pass@i.redd.it/photo.png','http://i.redd.it/photo.png','https://i.redd.it:444/photo.png','https://localhost/photo.png'])assert.throws(()=>remoteAvatarUrl(source));
});

test('community import uses its own icon and decodes HTML entities in the CDN URL',async()=>{
  const requested=[];
  const result=await importArtist('r/aivideo',async(url,options)=>{
    requested.push(url);assert.equal(options.redirect,'manual');return json(community());
  });
  assert.deepEqual(requested,['https://www.reddit.com/r/aivideo/about.json?raw_json=1']);
  assert.equal(result.artist.name,'r/aivideo');
  assert.equal(Object.hasOwn(result.artist,'description'),false);
  assert.equal(result.artist.image,'https://styles.redditmedia.com/t5_test/styles/communityIcon_test.png?width=256&s=signature');
  assert.equal(result.profileAvatar,true);assert.equal(result.metadataLoaded,true);
});

test('a community with no icon can use its published banner',async()=>{
  const result=await importArtist('r/aivideo',async()=>json(community({community_icon:'',icon_img:'',banner_background_image:'https://styles.redditmedia.com/t5_test/styles/bannerBackgroundImage_test.jpg'})));
  assert.match(result.artist.image,/bannerBackgroundImage_test\.jpg$/);
});

test('profile imports select the requested user avatar',async()=>{
  const result=await importArtist('u/Artist',async()=>json({kind:'t2',data:{name:'Artist',icon_img:'https://www.redditstatic.com/avatars/artist.png',subreddit:{public_description:'Artist bio'}}}));
  assert.equal(result.artist.name,'u/Artist');assert.equal(Object.hasOwn(result.artist,'description'),false);
  assert.equal(result.artist.image,'https://www.redditstatic.com/avatars/artist.png');assert.equal(result.profileAvatar,true);
  const wrong=await importArtist('u/Artist',async()=>json({kind:'t2',data:{name:'SomeoneElse',icon_img:'https://i.redd.it/wrong.png'}}));
  assert.equal(wrong.metadataLoaded,false);assert.equal(wrong.artist.image,'');
});

test('post images use original photos, gallery order and full preview sources',async()=>{
  const direct=await importArtist('redd.it/abc123',async()=>json(post({url_overridden_by_dest:'https://i.redd.it/photo.png'})));
  assert.equal(direct.artist.image,'https://i.redd.it/photo.png');assert.equal(direct.artist.name,'AI artwork');assert.equal(direct.profileAvatar,false);assert.equal(direct.coverLoaded,true);
  const gallery=await importArtist('https://reddit.com/gallery/abc123',async()=>json(post({gallery_data:{items:[{media_id:'second'},{media_id:'first'}]},media_metadata:{first:{s:{u:'https://i.redd.it/first.png'}},second:{s:{u:'https://preview.redd.it/second.png?width=1080&amp;s=signed'}}}})));
  assert.equal(gallery.artist.image,'https://preview.redd.it/second.png?width=1080&s=signed');
  const preview=await importArtist('redd.it/abc123',async()=>json(post({url:'https://v.redd.it/video',preview:{images:[{source:{url:'https://external-preview.redd.it/poster.jpg?width=1920&amp;s=signed'}}]}})));
  assert.equal(preview.artist.image,'https://external-preview.redd.it/poster.jpg?width=1920&s=signed');
});

test('HTML fallback uses the community icon rather than an image from the feed',async()=>{
  const html='<meta property="og:title" content="r/aivideo - AI videos"><meta property="og:image" content="https://i.redd.it/feed-photo.png"><meta name="description" content="Community &amp; AI"><faceplate-img alt="r/aivideo icon" src="https://styles.redditmedia.com/t5_test/styles/communityIcon_real.png?x=1&amp;y=2">';
  const result=await importArtist('r/aivideo',async url=>url.includes('.json')?blocked():new Response(html,{headers:{'content-type':'text/html'}}));
  assert.equal(result.artist.image,'https://styles.redditmedia.com/t5_test/styles/communityIcon_real.png?x=1&y=2');
  assert.equal(Object.hasOwn(result.artist,'description'),false);assert.equal(result.metadataLoaded,true);
  const feedOnly=await importArtist('r/aivideo',async url=>url.includes('.json')?blocked():new Response(html.replace(/<faceplate-img[^>]*>/,''),{headers:{'content-type':'text/html'}}));
  assert.equal(feedOnly.artist.image,'');
});

test('blocked metadata produces a savable Reddit draft without substituting an image',async()=>{
  const result=await importArtist('r/aivideo',async()=>blocked());
  assert.equal(result.artist.name,'r/aivideo');assert.equal(result.artist.url,'https://www.reddit.com/r/aivideo');
  assert.equal(result.metadataLoaded,false);assert.equal(result.artist.image,'');assert.match(result.imageNotice,/Reddit ограничил/);
  const partial=await importArtist('r/aivideo',async url=>url.startsWith('https://www.reddit.com/')&&url.includes('.json')?json(community({community_icon:''})):blocked());
  assert.equal(partial.metadataLoaded,true);assert.equal(Object.hasOwn(partial.artist,'description'),false);assert.equal(partial.artist.image,'');
});

test('Reddit share links follow validated redirects and reject redirects to private hosts',async()=>{
  const shared='https://www.reddit.com/r/aivideo/s/AbCdEf1234';
  const result=await importArtist(shared,async url=>url===shared?new Response('',{status:302,headers:{location:'/r/aivideo/comments/abc123/title/?utm_source=share'}}):url.includes('.json')?json(post({url:'https://i.redd.it/post.png'})):blocked());
  assert.equal(result.artist.url,'https://www.reddit.com/comments/abc123');assert.equal(result.artist.image,'https://i.redd.it/post.png');
  assert.notEqual(linkKey(shared),linkKey(shared.replace('AbCdEf','abcdef')));
  const requested=[];
  const rejected=await importArtist('r/aivideo',async url=>{requested.push(url);return new Response('',{status:302,headers:{location:'http://127.0.0.1/private'}});});
  assert.equal(rejected.artist.image,'');assert.ok(requested.every(url=>new URL(url).hostname.endsWith('reddit.com')));
});

test('Reddit login redirects and the generic welcome page are not imported as community data',async()=>{
  const requested=[];
  const login=await importArtist('r/aivideo',async url=>{requested.push(url);return new Response('',{status:302,headers:{location:'https://www.reddit.com/login/?dest=/r/aivideo'}});});
  assert.ok(requested.every(url=>!url.includes('/login/')));assert.equal(login.metadataLoaded,false);assert.equal(Object.hasOwn(login.artist,'description'),false);
  const welcome=await importArtist('r/aivideo',async url=>url.includes('.json')?blocked():new Response('<title>Welcome to Reddit</title><meta name="description" content="Log in or sign up">',{headers:{'content-type':'text/html'}}));
  assert.equal(welcome.metadataLoaded,false);assert.equal(Object.hasOwn(welcome.artist,'description'),false);
});

test('saving Reddit links persists the platform and catches duplicate aliases',async t=>{
  const {file}=await fixture(t);const store=createCatalogStore(file);
  const artist={name:'r/aivideo',url:'r/aivideo',section:'world',image:'',tags:'',kind:'media',rating:'AA'};
  const saved=await store.mutate({action:'save',artist});
  assert.equal(saved.artist.platform,'Reddit');assert.equal(saved.artist.kind,'media');assert.equal(saved.artist.rating,'AA');
  const reloaded=await createCatalogStore(file).read();assert.equal(reloaded.artists[0].url,'https://www.reddit.com/r/aivideo');
  await assert.rejects(store.mutate({action:'save',artist:{...artist,url:'https://old.reddit.com/r/AIVIDEO/'}}),/уже есть/);
  await store.mutate({action:'save',artist:{...artist,name:'Post',url:'redd.it/abc123'}});
  await assert.rejects(store.mutate({action:'save',artist:{...artist,name:'Post',url:'https://reddit.com/r/aivideo/comments/abc123/title/'}}),/уже есть/);
});

test('the import and image-download APIs save Reddit covers locally and persist the card',async t=>{
  const {dir,file}=await fixture(t);const dist=join(dir,'dist');await mkdir(dist);
  // A valid PNG with unique trailing bytes keeps the fixture isolated from real uploads.
  const bytes=Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1cAAAAASUVORK5CYII=','base64'),Buffer.from(randomUUID())]);
  const filename=`upload-${createHash('sha256').update(bytes).digest('hex').slice(0,16)}.png`;
  t.after(()=>rm(resolve('public/avatars',filename),{force:true}));
  const fetcher=async url=>new URL(url).hostname==='styles.redditmedia.com'?new Response(bytes,{headers:{'content-type':'image/png'}}):json(community());
  const app=await startServers({catalogFile:file,distDir:dist,sitePort:0,adminPort:0,fetcher});t.after(()=>app.close());
  const postApi=(path,body)=>fetch(app.adminUrl+path,{method:'POST',headers:{origin:app.adminUrl,'content-type':'application/json'},body:JSON.stringify(body)});
  const response=await postApi('/api/import',{url:'https://www.reddit.com/r/aivideo/'});assert.equal(response.status,200);
  const imported=await response.json();assert.equal(imported.imageSavedLocally,true);assert.equal(imported.artist.image,`./avatars/${filename}`);
  assert.deepEqual(await readFile(join(dist,'avatars',filename)),bytes);
  const direct=await postApi('/api/avatar-from-url',{url:'https://styles.redditmedia.com/icon.png'});assert.equal(direct.status,200);assert.equal((await direct.json()).image,imported.artist.image);
  const saved=await postApi('/api/catalog',{action:'save',artist:{...imported.artist,section:'world',kind:'media',rating:'AA'}});assert.equal(saved.status,200);
  const catalog=await (await fetch(app.siteUrl+'/api/catalog')).json();assert.equal(catalog.artists[0].platform,'Reddit');assert.equal(catalog.artists[0].image,imported.artist.image);
  assert.equal((await fetch(app.siteUrl+'/avatars/'+filename)).status,200);
});

test('cover downloads reject a redirect outside the image-host allowlist before fetching it',async()=>{
  const requested=[];
  await assert.rejects(downloadRemoteAvatar('https://i.redd.it/photo.png','/tmp/unused',async url=>{requested.push(url.href);return new Response('',{status:302,headers:{location:'http://127.0.0.1/private'}});}),/Поддерживаются прямые ссылки/);
  assert.deepEqual(requested,['https://i.redd.it/photo.png']);
});
