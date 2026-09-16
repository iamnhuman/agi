import {parseArtistLink} from '@/lib/links';
import {isAdmin,sameOrigin} from '@/lib/admin';
function decode(s:string){return s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Math.min(Number(n),0x10ffff)));}
function meta(html:string,key:string){for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){const attrs:Record<string,string>={};for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g))attrs[m[1].toLowerCase()]=decode(m[3]);if(attrs.property===key||attrs.name===key)return attrs.content||'';}return '';}
export async function POST(request:Request){try{
 if(!sameOrigin(request)||!await isAdmin())return Response.json({error:'Нет доступа к импорту.'},{status:403});
 const body:any=await request.json();const link=parseArtistLink(String(body.url||''));
 let name=link.name,description='',image='',loaded=false;
 try{
 const response=await fetch(link.fetchUrl,{redirect:'manual',signal:AbortSignal.timeout(7000),headers:{'User-Agent':'Mozilla/5.0 (compatible; ArtAtlas/1.0)'}});
 if(response.ok&&response.headers.get('content-type')?.includes('text/html')){
 const reader=response.body?.getReader();let html='',bytes=0;const decoder=new TextDecoder();if(reader){try{while(bytes<400000){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;html+=decoder.decode(value,{stream:true});}}finally{await reader.cancel();}}
 const title=meta(html,'og:title');
 const valid=title&&!/^(instagram|telegram|log in|login|войти|telegram: contact)/i.test(title);
 if(valid){name=title.replace(/\s*[•|–]\s*Instagram.*$/i,'').replace(/\s*\(@[^)]+\).*$/,'').slice(0,120);description=meta(html,'og:description').slice(0,1500);const img=meta(html,'og:image');if(img.startsWith('https://'))image=img;loaded=true;}
 }
 }catch{/* The public page may block metadata; a URL-derived draft is still useful. */}
 return Response.json({artist:{name,url:link.url,platform:link.platform,description,image,tags:''},notice:loaded?'Доступные данные загружены. Проверьте карточку перед сохранением.':link.isPost?'Это публикация. Площадка не отдала данные автора — укажите его имя вручную.':'Имя и площадка определены по ссылке. Описание и обложку можно дополнить вручную.'});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Не удалось обработать ссылку.'},{status:400});}}
