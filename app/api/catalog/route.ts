import {readCatalog,database} from '@/lib/catalog';
import {isAdmin,sameOrigin} from '@/lib/admin';
import {parseArtistLink} from '@/lib/links';
import type {Artist} from '@/lib/types';
export async function GET(){try{return Response.json(await readCatalog(),{headers:{'Cache-Control':'no-store'}});}catch(e){console.error(e);return Response.json({error:'Не удалось загрузить изменения. Попробуйте ещё раз.'},{status:503});}}
export async function POST(request:Request){
 try{
 if(!sameOrigin(request)||!await isAdmin())return Response.json({error:'Нет доступа к редактированию.'},{status:403});
 if(Number(request.headers.get('content-length')||0)>20000)return Response.json({error:'Слишком большой запрос.'},{status:413});
 const data:any=await request.json();const db=database();const catalog=await readCatalog();
 if(data.action==='section'){
 const name=String(data.name||'').trim().slice(0,60);if(!name)throw new Error('Введите название раздела.');
 if(catalog.sections.some(s=>s.name.toLowerCase()===name.toLowerCase()))throw new Error('Такой раздел уже существует.');
 const id=crypto.randomUUID();await db.prepare('INSERT INTO sections (id,name) VALUES (?,?)').bind(id,name).run();return Response.json({section:{id,name}});
 }
 if(data.action==='delete'){
 if(!catalog.artists.some(a=>a.id===data.id))throw new Error('Артист уже удалён.');
 await db.prepare('INSERT INTO artists (id,payload,deleted) VALUES (?,?,1) ON CONFLICT(id) DO UPDATE SET deleted=1').bind(data.id,'{}').run();return Response.json({ok:true});
 }
 if(data.action!=='save')throw new Error('Неизвестное действие.');
 const a=data.artist;if(!a||typeof a.url!=='string')throw new Error('Укажите ссылку.');
 const link=parseArtistLink(a.url);const name=String(a.name||'').trim().slice(0,120);if(!name)throw new Error('Укажите имя артиста.');
 if(!catalog.sections.some(s=>s.id===a.section))throw new Error('Выберите существующий раздел.');
 const id=a.id||crypto.randomUUID();if(a.id&&!catalog.artists.some(x=>x.id===a.id))throw new Error('Артист не найден.');
 if(catalog.artists.some(x=>x.id!==id&&parseArtistLink(x.url).url.toLowerCase()===link.url.toLowerCase())&&!a.id)throw new Error('Эта ссылка уже есть в каталоге. Найдите карточку через поиск.');
 const image=String(a.image||'').trim();if(image){const u=new URL(image);if(u.protocol!=='https:'||u.username||u.password)throw new Error('Для изображения нужна HTTPS-ссылка.');}
 const artist:Artist={id,name,url:link.url,platform:link.platform,section:a.section,image:image.slice(0,2000),description:String(a.description||'').slice(0,1500),tags:String(a.tags||'').slice(0,250)};
 await db.prepare('INSERT INTO artists (id,payload,deleted) VALUES (?,?,0) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,deleted=0').bind(id,JSON.stringify(artist)).run();
 return Response.json({artist});
 }catch(e){console.error(e);return Response.json({error:e instanceof Error?e.message:'Не удалось сохранить изменения.'},{status:400});}
}
