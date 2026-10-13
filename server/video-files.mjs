import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

export const MAX_VIDEO_BYTES=64*1024*1024;
export const localVideoPattern=/^\.\/videos\/clip-[a-f0-9]{16}\.mp4$/;

function mediaUrl(raw){
  let url;
  try{url=new URL(raw);}catch{throw Error('Instagram не отдал прямую ссылку на видео.');}
  if(url.protocol!=='https:'||url.username||url.password||url.port||!/(^|\.)(cdninstagram\.com|fbcdn\.net)$/.test(url.hostname))throw Error('Источник видео не поддерживается.');
  return url;
}

export async function downloadInstagramVideo(raw,distDir,fetcher=fetch){
  let url=mediaUrl(raw);
  for(let redirect=0;redirect<3;redirect++){
    const response=await fetcher(url,{redirect:'manual',signal:AbortSignal.timeout(45000),headers:{'User-Agent':'Mozilla/5.0'}});
    if(response.status>=300&&response.status<400&&response.headers.get('location')){
      const next=new URL(response.headers.get('location'),url).href;
      await response.body?.cancel();url=mediaUrl(next);continue;
    }
    if(!response.ok){await response.body?.cancel();throw Error('Instagram не отдал видеофайл.');}
    const type=(response.headers.get('content-type')||'').split(';')[0];
    if(!['video/mp4','application/octet-stream'].includes(type)){await response.body?.cancel();throw Error('Источник не отдал видео MP4.');}
    if(Number(response.headers.get('content-length')||0)>MAX_VIDEO_BYTES){await response.body?.cancel();throw Error('Видео больше 64 МБ.');}
    if(!response.body)throw Error('Источник вернул пустое видео.');
    const reader=response.body.getReader(),chunks=[];let total=0;
    try{
      while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>MAX_VIDEO_BYTES)throw Error('Видео больше 64 МБ.');chunks.push(value);}
    }finally{await reader.cancel().catch(()=>{});}
    const bytes=Buffer.concat(chunks);
    if(bytes.length<100||bytes.toString('ascii',4,8)!=='ftyp')throw Error('Видеофайл повреждён или имеет неподдерживаемый формат.');
    const filename=`clip-${createHash('sha256').update(bytes).digest('hex').slice(0,16)}.mp4`;
    const publicDir=resolve('public/videos'),builtDir=resolve(distDir,'videos');
    await Promise.all([mkdir(publicDir,{recursive:true}),mkdir(builtDir,{recursive:true})]);
    const save=path=>writeFile(path,bytes,{flag:'wx'}).catch(error=>{if(error.code!=='EEXIST')throw error;});
    await Promise.all([save(resolve(publicDir,filename)),save(resolve(builtDir,filename))]);
    return `./videos/${filename}`;
  }
  throw Error('Слишком много перенаправлений при загрузке видео.');
}
