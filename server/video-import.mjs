export function videoLink(raw){
 let u;try{u=new URL(String(raw).trim().replace(/(youtu\.be\/[\w-]{11})&/,'$1?'));}catch{throw Error('Укажите полную ссылку на видео.');}
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port)throw Error('Некорректная ссылка.');
 u.protocol='https:';const host=u.hostname.replace(/^www\./,'').toLowerCase();
 if(host==='localhost'||!host.includes('.')||/^\d+\.\d+\.\d+\.\d+$/.test(host)||host.includes(':'))throw Error('Нужна публичная ссылка.');
 const parts=u.pathname.split('/').filter(Boolean);let videoId='';
 if(host==='youtu.be')videoId=parts[0]||'';
 if(host==='youtube.com')videoId=u.searchParams.get('v')||(['shorts','embed'].includes(parts[0])?parts[1]:'')||'';
 if(videoId&&!/^[\w-]{11}$/.test(videoId))throw Error('Некорректный адрес YouTube.');
 const platform=videoId?'YouTube':host==='t.me'?'Telegram':host==='instagram.com'?'Instagram':host==='vk.com'?'VK':'Сайт';
 let fetchUrl='';
 if(videoId)fetchUrl=`https://www.youtube.com/watch?v=${videoId}`;
 if(platform==='Telegram'&&/^[\w]+$/.test(parts[0]||'')&&/^\d+$/.test(parts.at(-1)||''))fetchUrl=`https://t.me/${parts[0]}/${parts.at(-1)}?embed=1&mode=tme`;
 if(platform==='Instagram'&&['p','reel'].includes(parts[0])&&/^[\w-]+$/.test(parts[1]||''))fetchUrl=`https://www.instagram.com/${parts[0]}/${parts[1]}/`;
 const reference=!fetchUrl;return {url:u.href,platform,videoId,fetchUrl,reference};
}
function decode(s){return s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Math.min(+n,0x10ffff)));}
export function videoMetadata(html,link){
 const meta={};for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){const a={};for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g))a[m[1]]=decode(m[3]);const key=a.property||a.itemprop||a.name;if(key&&!meta[key])meta[key]=a.content;}
 let date='',title=meta['og:title']||'',image=meta['og:image']||'';
 if(link.platform==='YouTube')date=meta.datePublished||html.match(/"publishDate"\s*:\s*"(\d{4}-\d{2}-\d{2})/)?.[1]||'';
 if(link.platform==='Telegram'){
  date=html.match(/<time\b[^>]*datetime="([^"]+)"/)?.[1]||'';
  image=decode(html.match(/background-image:url\('([^']+)'\)/)?.[1]||image);
  title='';
 }
 if(link.platform==='Instagram')date=meta['article:published_time']||html.match(/"uploadDate"\s*:\s*"(\d{4}-\d{2}-\d{2}[^" ]*)"/)?.[1]||'';
 if(new URL(link.url).searchParams.has('comment'))date='';
 date=/^\d{4}-\d{2}-\d{2}/.test(date)?date.slice(0,10):'';
 if(!image.startsWith('https://'))image='';
 return {title:title.replace(/ - YouTube$/,''),image,publishedAt:date,dateSource:date?'source':'unknown',dateUrl:date?link.fetchUrl:''};
}
export async function importVideo(raw,fetcher=fetch){
 const link=videoLink(raw);let metadata={title:'',image:'',publishedAt:'',dateSource:'unknown',dateUrl:''};
 if(link.fetchUrl)try{
 const r=await fetcher(link.fetchUrl,{redirect:'manual',signal:AbortSignal.timeout(12000),headers:{'User-Agent':'Mozilla/5.0'}});
 if(r.ok){const reader=r.body.getReader();let html='',n=0;const decoder=new TextDecoder();try{while(n<2500000){const x=await reader.read();if(x.done)break;const b=x.value.subarray(0,2500000-n);n+=b.length;html+=decoder.decode(b,{stream:true});}}finally{await reader.cancel();}metadata=videoMetadata(html,link);}else await r.body?.cancel();
 }catch{}
 return {...link,...metadata};
}
export function validVideoDate(value){return value===''||typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
