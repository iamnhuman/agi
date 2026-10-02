import {saveAvatarBytes} from './avatar-files.mjs';

// Only image hosts used by the supported video platforms may be fetched by the
// local admin server. A page's Open Graph image is otherwise untrusted input.
const imageHosts=/(^|\.)(ytimg\.com|ggpht\.com|telesco\.pe|telegram-cdn\.org|userapi\.com|vkuserphoto\.ru|vk-cdn\.net|vk\.com|cdninstagram\.com|fbcdn\.net)$/;

function imageUrl(raw){
  let url;
  try{url=new URL(String(raw).trim());}catch{throw Error('Нужна прямая HTTPS-ссылка на изображение.');}
  if(url.protocol!=='https:'||url.username||url.password||url.port||!imageHosts.test(url.hostname))throw Error('Этот источник изображения не поддерживается. Загрузите файл вручную.');
  return url;
}

export async function downloadVideoImage(raw,distDir,fetcher=fetch){
  let url=imageUrl(raw);
  for(let redirect=0;redirect<3;redirect++){
    const response=await fetcher(url,{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{'User-Agent':'Mozilla/5.0'}});
    const location=response.headers.get('location');
    if(response.status>=300&&response.status<400&&location){url=imageUrl(new URL(location,url).href);continue;}
    if(!response.ok)throw Error('Источник не отдал изображение.');
    const type=(response.headers.get('content-type')||'').split(';')[0];
    const size=Number(response.headers.get('content-length')||0);
    if(size>12*1024*1024)throw Error('Изображение больше 12 МБ.');
    if(!['image/jpeg','image/png','image/webp'].includes(type))throw Error('Источник не отдал JPG, PNG или WebP.');
    const reader=response.body.getReader(),chunks=[];let total=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>12*1024*1024)throw Error('Изображение больше 12 МБ.');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
    return saveAvatarBytes(Buffer.concat(chunks),type,distDir);
  }
  throw Error('Слишком много перенаправлений при загрузке изображения.');
}
