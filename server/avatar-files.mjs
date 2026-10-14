import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

export const MAX_AVATAR_BYTES=50*1024*1024;

// Read encoded dimensions; never upscale a thumbnail or infer its size from a URL.
export function avatarDimensions(bytes){
  let width=0,height=0;
  if(bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.toString('ascii',12,16)==='IHDR'){
    width=bytes.readUInt32BE(16);height=bytes.readUInt32BE(20);
  }else if(bytes.length>=30&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'){
    const kind=bytes.toString('ascii',12,16);
    if(kind==='VP8X'){width=1+bytes.readUIntLE(24,3);height=1+bytes.readUIntLE(27,3);}
    else if(kind==='VP8L'&&bytes[20]===47){const bits=bytes.readUInt32LE(21);width=1+(bits&16383);height=1+((bits>>>14)&16383);}
    else if(kind==='VP8 '&&bytes[23]===157&&bytes[24]===1&&bytes[25]===42){width=bytes.readUInt16LE(26)&16383;height=bytes.readUInt16LE(28)&16383;}
  }else if(bytes[0]===255&&bytes[1]===216){
    let offset=2;
    while(offset<bytes.length){
      if(bytes[offset++]!==255)break;
      while(bytes[offset]===255)offset++;
      const marker=bytes[offset++];
      if(marker===218||marker===217)break;
      if(marker===1||marker>=208&&marker<=216)continue;
      if(offset+2>bytes.length)break;
      const length=bytes.readUInt16BE(offset);
      if(length<2||offset+length>bytes.length)break;
      if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&length>=7){height=bytes.readUInt16BE(offset+3);width=bytes.readUInt16BE(offset+5);break;}
      offset+=length;
    }
  }
  return width>0&&height>0?{width,height}:null;
}

export function isRedditImageHost(hostname){
  return /(^|\.)(redditmedia\.com|redditstatic\.com)$/.test(hostname)||['i.redd.it','preview.redd.it','external-preview.redd.it'].includes(hostname);
}

export function validateAvatarBytes(bytes){
  if(bytes.length<100)throw Error('Файл изображения повреждён или пуст.');
  if(bytes.length>MAX_AVATAR_BYTES)throw Error('Размер изображения должен быть не больше 50 МБ.');
}

export async function saveAvatarBytes(bytes,type,distDir){
  const suffix={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp'}[type];
  if(!suffix)throw Error('Поддерживаются изображения JPG, PNG и WebP.');
  validateAvatarBytes(bytes);
  const filename=`upload-${createHash('sha256').update(bytes).digest('hex').slice(0,16)}${suffix}`;
  const publicDir=resolve('public/avatars'),builtDir=resolve(distDir,'avatars');
  await Promise.all([mkdir(publicDir,{recursive:true}),mkdir(builtDir,{recursive:true})]);
  await Promise.all([writeFile(resolve(publicDir,filename),bytes),writeFile(resolve(builtDir,filename),bytes)]);
  return `./avatars/${filename}`;
}

export function remoteAvatarUrl(raw){
  let url;
  try{url=new URL(String(raw).trim());}catch{throw Error('Вставьте прямую HTTPS-ссылку на изображение.');}
  if(url.protocol!=='https:'||url.username||url.password||url.port||!(/(^|\.)(cdninstagram\.com|fbcdn\.net|telesco\.pe|telegram-cdn\.org)$/.test(url.hostname)||isRedditImageHost(url.hostname)))throw Error('Поддерживаются прямые ссылки на изображения Instagram, Telegram и Reddit.');
  return url;
}

export async function downloadRemoteAvatarDetails(raw,distDir,fetcher=fetch){
  let url=remoteAvatarUrl(raw);
  for(let redirect=0;redirect<3;redirect++){
    const response=await fetcher(url,{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{'User-Agent':'Mozilla/5.0'}});
    if(response.status>=300&&response.status<400&&response.headers.get('location')){url=remoteAvatarUrl(new URL(response.headers.get('location'),url).href);continue;}
    if(!response.ok)throw Error('Не удалось скачать обложку по этой ссылке. Возможно, она устарела.');
    const type=(response.headers.get('content-type')||'').split(';')[0];
    const bytes=Buffer.from(await response.arrayBuffer());
    return {image:await saveAvatarBytes(bytes,type,distDir),...avatarDimensions(bytes)};
  }
  throw Error('Слишком много перенаправлений при загрузке обложки.');
}

export async function downloadRemoteAvatar(raw,distDir,fetcher=fetch){
  return (await downloadRemoteAvatarDetails(raw,distDir,fetcher)).image;
}
