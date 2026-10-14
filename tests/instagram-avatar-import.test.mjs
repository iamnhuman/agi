import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {deflateSync,crc32} from 'node:zlib';
import {startServers} from '../server/http.mjs';

const notice='Instagram временно ограничил загрузку HD-аватарок. Доступна только уменьшенная версия; повторите позже.';
const thumbnail='https://scontent.cdninstagram.com/profile.jpg?stp=dst-jpg_s150x150_tt6';

function png(width,height){
 const chunk=(name,data)=>{const type=Buffer.from(name),size=Buffer.alloc(4),checksum=Buffer.alloc(4);size.writeUInt32BE(data.length);checksum.writeUInt32BE(crc32(Buffer.concat([type,data])));return Buffer.concat([size,type,data,checksum]);};
 const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('tEXt',Buffer.from('fixture\0'+randomUUID())),chunk('IDAT',deflateSync(Buffer.alloc(height*(1+width*3)))),chunk('IEND',Buffer.alloc(0))]);
}

async function fixture(t,avatar,actualSize=[avatar.width||150,avatar.height||150]){
 const dir=await mkdtemp(join(tmpdir(),'atlas-instagram-avatar-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const file=join(dir,'catalog.json'),dist=join(dir,'dist');
 const catalog={sections:[{id:'world',name:'Мир'}],artists:[],videos:[]};
 await writeFile(file,JSON.stringify(catalog));await mkdir(dist);
 const bytes=png(...actualSize);
 const filename=`upload-${createHash('sha256').update(bytes).digest('hex').slice(0,16)}.png`;
 t.after(()=>rm(resolve('public/avatars',filename),{force:true}));
 const fetched=[],lookedUp=[];
 const app=await startServers({catalogFile:file,distDir:dist,sitePort:0,adminPort:0,
  instagramAvatar:async name=>{lookedUp.push(name);if(avatar instanceof Error)throw avatar;return {username:name,...avatar};},
  fetcher:async raw=>{
   const url=new URL(raw);fetched.push(url.href);
   if(url.hostname==='scontent.cdninstagram.com')return new Response(bytes,{headers:{'content-type':'image/png'}});
   assert.equal(url.href,'https://www.instagram.com/artist');
   return new Response(`<meta property="og:title" content="Artist (@artist) • Instagram"><meta property="og:image" content="${thumbnail.replaceAll('&','&amp;')}">`,{headers:{'content-type':'text/html'}});
  }});
 t.after(()=>app.close());
 const request=()=>fetch(app.adminUrl+'/api/import',{method:'POST',headers:{origin:app.adminUrl,'content-type':'application/json'},body:JSON.stringify({url:'https://www.instagram.com/artist'})});
 return {request,fetched,lookedUp,file,catalog,filename,dist,bytes,app};
}

test('restricted HD lookup retains the public avatar and forwards its explanation to the editor',async t=>{
 const f=await fixture(t,{url:thumbnail,width:150,height:150,hd:false,notice});
 const response=await f.request();assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.imageNotice,notice);assert.equal(data.lowResolution,true);assert.equal(data.hdAvatar,false);
 assert.equal(data.avatarWidth,150);assert.equal(data.avatarHeight,150);
 assert.equal(data.artist.image,`./avatars/${f.filename}`);assert.equal(data.imageSavedLocally,true);
 assert.deepEqual(await readFile(join(f.dist,'avatars',f.filename)),f.bytes);
 assert.deepEqual(JSON.parse(await readFile(f.file)),f.catalog,'Importing a draft must not change saved records');
 assert.deepEqual(f.lookedUp,['artist']);
});

test('a verified HD result replaces the thumbnail without an obsolete restriction notice',async t=>{
 const hd='https://scontent.cdninstagram.com/profile-hd.jpg';
 const f=await fixture(t,{url:hd,width:1080,height:1080,hd:true,notice});
 const data=await (await f.request()).json();
 assert.equal(data.hdAvatar,true);assert.equal(data.lowResolution,false);
 assert.equal(data.avatarWidth,1080);assert.equal(data.imageNotice,undefined);
 assert.ok(f.fetched.includes(hd));assert.ok(!f.fetched.includes(thumbnail));
});

test('an unavailable session leaves the public thumbnail available with the session message',async t=>{
 const message='Instagram-сессия истекла. Подключите её заново.';
 const f=await fixture(t,new Error(message));
 const data=await (await f.request()).json();
 assert.equal(data.sessionExpired,true);assert.equal(data.imageNotice,message);
 assert.equal(data.lowResolution,true);assert.equal(data.imageSavedLocally,true);
});

test('the real downloaded dimensions determine HD status when Instagram omits them',async t=>{
 const f=await fixture(t,{url:'https://scontent.cdninstagram.com/original.jpg',width:0,height:0,hd:false},[1080,1080]);
 const data=await (await f.request()).json();
 assert.equal(data.hdAvatar,true);assert.equal(data.lowResolution,false);
 assert.equal(data.avatarWidth,1080);assert.equal(data.avatarHeight,1080);
});

test('a thumbnail is not called HD even when remote metadata claims 1080',async t=>{
 const f=await fixture(t,{url:thumbnail,width:1080,height:1080,hd:true},[150,150]);
 const data=await (await f.request()).json();
 assert.equal(data.hdAvatar,false);assert.equal(data.lowResolution,true);
 assert.equal(data.avatarWidth,150);assert.equal(data.avatarHeight,150);
});
