import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {videoLink,importVideo} from '../server/video-import.mjs';
import {downloadVideoImage} from '../server/video-images.mjs';
import {createCatalogStore} from '../server/catalog.mjs';
import {startServers} from '../server/http.mjs';

const json=data=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
const blocked=()=>new Response('',{status:403});
const html=body=>new Response(body,{headers:{'content-type':'text/html'}});
const image='https://preview.redd.it/video-poster.png?width=1080&s=signed';
const created=Date.parse('2025-02-03T23:45:00Z')/1000;
const post=(data={})=>[{kind:'Listing',data:{children:[{kind:'t3',data:{id:'abc123',title:'AI video & music',created_utc:created,is_video:true,preview:{images:[{source:{url:image.replace('&','&amp;')}}]},...data}}]}},{kind:'Listing',data:{children:[]}}];
const source='https://www.reddit.com/r/aphextwin/comments/abc123/ai_video/';

test('video links recognize Reddit posts, galleries, short links and host aliases',()=>{
  for(const url of [source,'https://old.reddit.com/r/AphexTwin/comments/ABC123/title/?utm_source=share','https://new.reddit.com/comments/abc123/title/','https://m.reddit.com/gallery/abc123','https://redd.it/abc123']){
    const link=videoLink(url);
    assert.equal(link.platform,'Reddit');assert.equal(link.reference,false);
    assert.equal(link.url,'https://www.reddit.com/comments/abc123');assert.equal(link.videoId,'');
    assert.equal(link.fetchUrl,'https://www.reddit.com/comments/abc123.json?raw_json=1&limit=1');
  }
  for(const url of ['https://reddit.com/r/aphextwin','https://reddit.com/user/Artist'])assert.equal(videoLink(url).reference,true);
  for(const url of ['https://reddit.com/login','https://reddit.com/r/aphextwin/comments/','https://redd.it/r/aphextwin'])assert.throws(()=>videoLink(url));
  assert.equal(videoLink('https://reddit.com.evil.test/r/aphextwin/comments/abc123').platform,'Сайт');
});

test('Reddit video metadata imports the title, signed full-size preview and post date',async()=>{
  const requested=[];
  const result=await importVideo(source,async(url,options)=>{
    requested.push(url);assert.equal(options.redirect,'manual');return json(post());
  });
  assert.deepEqual(requested,['https://www.reddit.com/comments/abc123.json?raw_json=1&limit=1']);
  assert.equal(result.name,'AI video & music');assert.equal(result.image,image);
  assert.equal(result.publishedAt,'2025-02-03');assert.equal(result.dateSource,'source');
  assert.equal(result.dateUrl,result.fetchUrl);assert.equal(result.isVideo,true);assert.equal(result.metadataLoaded,true);
});

test('Reddit gallery covers respect gallery order and photos are not marked as videos',async()=>{
  const result=await importVideo('https://reddit.com/gallery/abc123',async()=>json(post({is_video:false,preview:undefined,gallery_data:{items:[{media_id:'second'},{media_id:'first'}]},media_metadata:{first:{s:{u:'https://i.redd.it/first.png'}},second:{s:{u:'https://i.redd.it/second.png'}}}})));
  assert.equal(result.image,'https://i.redd.it/second.png');assert.equal(result.isVideo,false);assert.equal(result.publishedAt,'2025-02-03');
});

test('crossposts use original media while retaining their own title and publication date',async()=>{
  const result=await importVideo(source,async()=>json(post({is_video:false,preview:undefined,crosspost_parent_list:[{title:'Original title',created_utc:1,is_video:true,preview:{images:[{source:{url:image}}]}}]})));
  assert.equal(result.name,'AI video & music');assert.equal(result.image,image);assert.equal(result.isVideo,true);assert.equal(result.publishedAt,'2025-02-03');
});

test('community and profile reference cards use their own covers without a publication date',async()=>{
  const result=await importVideo('https://reddit.com/r/aphextwin',async()=>json({kind:'t5',data:{display_name:'AphexTwin',community_icon:'https://styles.redditmedia.com/icon.png',created_utc:created}}));
  assert.equal(result.reference,true);assert.equal(result.name,'r/AphexTwin');assert.equal(result.isVideo,false);
  assert.equal(result.image,'https://styles.redditmedia.com/icon.png');assert.equal(result.publishedAt,'');assert.equal(result.dateUrl,'');
});

test('HTML metadata fills in Reddit data when JSON is blocked',async()=>{
  const markup='<meta property="og:title" content="New AI clip : Reddit"><meta property="og:image" content="'+image.replace('&','&amp;')+'"><shreddit-post id="t3_abc123" created-timestamp="2025-04-05T12:00:00Z" post-type="video">';
  const result=await importVideo(source,async url=>url.includes('.json')?blocked():html(markup));
  assert.equal(result.name,'New AI clip');assert.equal(result.image,image);assert.equal(result.publishedAt,'2025-04-05');assert.equal(result.isVideo,true);
  assert.equal(result.dateUrl,result.fetchUrl);
});

test('the public RSS fallback loads post data when Reddit blocks JSON and HTML',async()=>{
  const rss='<feed><updated>2026-10-15T00:00:00Z</updated><entry><id>t1_comment</id><published>2026-01-01T00:00:00Z</published><title>Wrong comment</title></entry><entry><id>t3_abc123</id><published>2025-02-03T23:45:00Z</published><title>Clip &amp; music</title><content type="html">&lt;img src=&quot;'+image.replace('&','&amp;amp;')+'&quot;&gt;&lt;a href=&quot;https://v.redd.it/clip&quot;&gt;[link]&lt;/a&gt;</content></entry></feed>';
  const requested=[];
  const result=await importVideo(source,async url=>{requested.push(url);return url.endsWith('/.rss')?new Response(rss,{headers:{'content-type':'application/atom+xml; charset=UTF-8'}}):blocked();});
  assert.equal(result.name,'Clip & music');assert.equal(result.image,image);assert.equal(result.publishedAt,'2025-02-03');assert.equal(result.isVideo,true);
  assert.equal(requested.at(-1),'https://www.reddit.com/comments/abc123/.rss');
  const wrong=await importVideo(source,async()=>new Response(rss.replace('t3_abc123','t3_other'),{headers:{'content-type':'application/atom+xml'}}));
  assert.equal(wrong.metadataLoaded,false);assert.equal(wrong.publishedAt,'');
});

test('oEmbed can supply the title when other public Reddit sources are unavailable',async()=>{
  const result=await importVideo(source,async url=>new URL(url).pathname==='/oembed'?json({provider_name:'reddit',title:'Public embed title',thumbnail_url:image}):blocked());
  assert.equal(result.name,'Public embed title');assert.equal(result.image,image);assert.equal(result.publishedAt,'');assert.equal(result.metadataLoaded,true);
  const foreign=await importVideo(source,async url=>new URL(url).pathname==='/oembed'?json({provider_name:'other',title:'Wrong title',thumbnail_url:image}):blocked());
  assert.equal(foreign.metadataLoaded,false);
});

test('partial JSON data survives unavailable fallbacks and missing dates remain unknown',async()=>{
  for(const created_utc of [undefined,null,0,'',-1,Number.MAX_VALUE]){
    const result=await importVideo(source,async url=>url.includes('.json')?json(post({created_utc})):blocked());
    assert.equal(result.name,'AI video & music');assert.equal(result.image,image);
    assert.equal(result.publishedAt,'');assert.equal(result.dateSource,'unknown');assert.equal(result.dateUrl,'');
  }
  const result=await importVideo(source,async url=>url.includes('.json')?json(post({created_utc:undefined})):html('<meta property="og:title" content="Fallback"><meta property="article:published_time" content="2025-07-08T10:00:00Z">'));
  assert.equal(result.image,image);assert.equal(result.name,'AI video & music');assert.equal(result.publishedAt,'2025-07-08');
});

test('comment links retain their target and never inherit the parent post date or video flag',async()=>{
  for(const url of [source+'COMMENT1/',source+'?comment=COMMENT1']){
    const result=await importVideo(url,async()=>json(post()));
    assert.equal(result.url,'https://www.reddit.com/comments/abc123/_/comment1');
    assert.equal(videoLink(result.url).url,result.url);
    assert.equal(result.publishedAt,'');assert.equal(result.dateSource,'unknown');assert.equal(result.dateUrl,'');assert.equal(result.isVideo,false);
  }
});

test('share links resolve to the Reddit post before loading its data',async()=>{
  const shared='https://www.reddit.com/r/aphextwin/s/AbCdEf1234';
  const result=await importVideo(shared,async url=>url===shared?new Response('',{status:302,headers:{location:source}}):json(post()));
  assert.equal(result.url,'https://www.reddit.com/comments/abc123');assert.equal(result.publishedAt,'2025-02-03');assert.equal(result.image,image);
});

test('blocked Reddit pages leave an editable draft and redirects cannot fetch other hosts',async()=>{
  for(const response of [blocked,()=>html('<title>Welcome to Reddit</title>'),()=>new Response('',{status:302,headers:{location:'http://127.0.0.1/private'}})]){
    const requested=[];
    const result=await importVideo(source,async url=>{requested.push(url);return response();});
    assert.equal(result.platform,'Reddit');assert.equal(result.metadataLoaded,false);assert.equal(result.image,'');assert.equal(result.publishedAt,'');assert.match(result.notice,/Reddit.*вручную/);
    assert.ok(requested.every(url=>['www.reddit.com','old.reddit.com'].includes(new URL(url).hostname)));
  }
  const wrong=await importVideo(source,async()=>json(post({id:'other'})));
  assert.equal(wrong.metadataLoaded,false);assert.equal(wrong.image,'');
});

test('video cover downloads reject foreign hosts and redirects before fetching them',async()=>{
  const requested=[];
  const fetcher=async url=>{requested.push(url.href);return new Response('',{status:302,headers:{location:'https://example.com/image.png'}});};
  await assert.rejects(downloadVideoImage(image,'/tmp/unused',fetcher),/источник изображения/);
  assert.deepEqual(requested,[image]);
  for(const url of ['http://i.redd.it/photo.png','https://i.redd.it.evil.test/photo.png','https://v.redd.it/video','https://user:pass@preview.redd.it/photo.png']){
    await assert.rejects(downloadVideoImage(url,'/tmp/unused',fetcher),/источник изображения/);
  }
  assert.equal(requested.length,1);
});

test('video import API caches Reddit covers and saves source metadata with duplicate detection',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'atlas-reddit-video-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const file=join(dir,'catalog.json'),dist=join(dir,'dist');await mkdir(dist);
  await writeFile(file,JSON.stringify({sections:[],artists:[],videos:[]}));
  const bytes=Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1cAAAAASUVORK5CYII=','base64'),Buffer.from(randomUUID())]);
  const filename=`upload-${createHash('sha256').update(bytes).digest('hex').slice(0,16)}.png`;
  t.after(()=>rm(resolve('public/avatars',filename),{force:true}));
  const fetcher=async url=>new URL(url).hostname==='preview.redd.it'?new Response(bytes,{headers:{'content-type':'image/png'}}):json(post());
  const app=await startServers({catalogFile:file,distDir:dist,sitePort:0,adminPort:0,fetcher});t.after(()=>app.close());
  const postApi=(path,body)=>fetch(app.adminUrl+path,{method:'POST',headers:{origin:app.adminUrl,'content-type':'application/json'},body:JSON.stringify(body)});
  const importedResponse=await postApi('/api/video-import',{url:source});assert.equal(importedResponse.status,200);
  const imported=await importedResponse.json();assert.equal(imported.imageSavedLocally,true);assert.equal(imported.image,`./avatars/${filename}`);
  assert.deepEqual(await readFile(join(dist,'avatars',filename)),bytes);
  const direct=await postApi('/api/video-image',{url:image});assert.equal(direct.status,200);assert.equal((await direct.json()).image,imported.image);
  const savedResponse=await postApi('/api/catalog',{action:'video-save',video:imported});assert.equal(savedResponse.status,200);
  const {video}=await savedResponse.json();assert.equal(video.platform,'Reddit');assert.equal(video.dateSource,'source');assert.equal(video.isVideo,true);
  const catalog=await (await fetch(app.siteUrl+'/api/catalog')).json();assert.equal(catalog.videos[0].image,imported.image);assert.equal(catalog.videos[0].publishedAt,'2025-02-03');
  assert.equal((await createCatalogStore(file).read()).videos[0].platform,'Reddit');
  const duplicate=await postApi('/api/catalog',{action:'video-save',video:{...imported,url:'https://redd.it/abc123'}});assert.equal(duplicate.status,400);assert.match((await duplicate.json()).error,/уже есть/);
  assert.equal((await fetch(app.siteUrl+'/avatars/'+filename)).status,200);
});
