import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

export const MAX_AVATAR_BYTES=50*1024*1024;

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
  if(url.protocol!=='https:'||url.username||url.password||url.port||!/(^|\.)(cdninstagram\.com|fbcdn\.net|telesco\.pe|telegram-cdn\.org)$/.test(url.hostname))throw Error('Поддерживаются прямые ссылки на изображения Instagram и Telegram.');
  return url;
}

export async function downloadRemoteAvatar(raw,distDir,fetcher=fetch){
  let url=remoteAvatarUrl(raw);
  for(let redirect=0;redirect<3;redirect++){
    const response=await fetcher(url,{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{'User-Agent':'Mozilla/5.0'}});
    if(response.status>=300&&response.status<400&&response.headers.get('location')){url=remoteAvatarUrl(new URL(response.headers.get('location'),url).href);continue;}
    if(!response.ok)throw Error('Не удалось скачать обложку по этой ссылке. Возможно, она устарела.');
    const type=(response.headers.get('content-type')||'').split(';')[0];
    return saveAvatarBytes(Buffer.from(await response.arrayBuffer()),type,distDir);
  }
  throw Error('Слишком много перенаправлений при загрузке обложки.');
}
