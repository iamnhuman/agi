import {useEffect,useRef,useState} from 'react';
import {Plus,ArrowUpRight,Play,Pencil,Trash2,Search,ZoomIn,ZoomOut,ArrowDownWideNarrow,ArrowUpNarrowWide,CalendarDays,GalleryHorizontal,List} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {AlertDialog,AlertDialogContent,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {catalogUrl,adminUrl,showLocalAdmin} from '@/client/config';
import {drawTimelineRunway} from './timeline-runway';
import {orderVideos,type VideoOrder} from './video-order';
import type {Video} from '@/lib/types';
const blank:Video={id:'',name:'',url:'',platform:'',videoId:'',reference:false,isVideo:false,title:'',publishedAt:'',dateSource:'unknown',dateUrl:'',image:'',description:'',alternateUrls:[],sourceOrder:0};
const fallbackImage='./video-fallback.svg';
const platformShortNames:Record<string,string>={Instagram:'IG',YouTube:'YT',Telegram:'TG',VK:'VK'};
const MIN_SCENE_ZOOM=.25,MAX_SCENE_ZOOM=1.5;
function coverSource(video:Video){return video.image||video.videoId&&`https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`||fallbackImage;}
function coverError(event:React.SyntheticEvent<HTMLImageElement>,video:Video){
 const image=event.currentTarget,youtube=video.videoId&&`https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;
 if(image.src.endsWith('/video-fallback.svg'))return;
 image.src=youtube&&image.src!==youtube?youtube:fallbackImage;
}
function instagramEmbedUrl(video:Video){
 if(video.platform!=='Instagram'||video.reference)return '';
 try{
  const url=new URL(video.url);
  if(!['instagram.com','www.instagram.com'].includes(url.hostname.toLowerCase()))return '';
  const post=url.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]{5,30})\/?$/);
  return post?`https://www.instagram.com/${post[1]}/${post[2]}/embed/`:'';
 }catch{return '';}
}
function VideoName({name,onOpen,fitToWidth=true}:{name:string;onOpen:()=>void;fitToWidth?:boolean}){
 const ref=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  const button=ref.current;if(!button)return;
  button.style.removeProperty('font-size');
  if(!fitToWidth)return;
  const canvas=document.createElement('canvas'),context=canvas.getContext('2d');
  let active=true;
  const fit=()=>{
   if(!active||!context)return;
   button.style.removeProperty('font-size');
   const style=getComputedStyle(button),fontSize=parseFloat(style.fontSize);
   context.font=style.font;
   const longest=Math.max(...name.split(/\s+/).map(word=>context.measureText(word).width));
   if(longest>button.clientWidth)button.style.fontSize=`${Math.max(6,Math.floor(fontSize*button.clientWidth/longest))}px`;
  };
  const observer=new ResizeObserver(fit);observer.observe(button);
  document.fonts.ready.then(fit);fit();
  return()=>{active=false;observer.disconnect();};
 },[name,fitToWidth]);
 return <button ref={ref} type="button" title={name} onClick={onOpen}>{name}</button>;
}
export default function Videos({admin=false}:{admin?:boolean}){
 const [videos,setVideos]=useState<Video[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[q,setQ]=useState(''),[order,setOrder]=useState<VideoOrder>('desc'),[orientation,setOrientation]=useState<'vertical'|'horizontal'>('horizontal'),[draft,setDraft]=useState<Video|null>(null),[selected,setSelected]=useState<Video|null>(null),[deleting,setDeleting]=useState<Video|null>(null),[busy,setBusy]=useState(false),[formError,setFormError]=useState(''),[importMessage,setImportMessage]=useState('');
 const [sceneZoom,setSceneZoom]=useState(.65);
 const zoomProgress=(sceneZoom-MIN_SCENE_ZOOM)/(MAX_SCENE_ZOOM-MIN_SCENE_ZOOM);
 const timelineViewport=useRef<HTMLDivElement>(null),timelineCanvas=useRef<HTMLCanvasElement>(null);
 const timelinePointer=useRef<{x:number;y:number}|null>(null);
 const drag=useRef<{pointerId:number;startX:number;scrollLeft:number;active:boolean}|null>(null);
 const suppressDragClick=useRef(false);
 const changeSceneZoom=(amount:number)=>setSceneZoom(current=>Math.round(Math.max(MIN_SCENE_ZOOM,Math.min(MAX_SCENE_ZOOM,current+amount))*100)/100);
 async function load(){try{setError('');const r=await fetch(catalogUrl,{cache:'no-store'});if(!r.ok)throw Error('Не удалось загрузить видео.');const items=(await r.json()).videos||[];setVideos(items);if(admin){const editId=new URLSearchParams(location.search).get("edit");if(editId){const item=items.find((v:Video)=>v.id===editId);if(item)edit(item);const url=new URL(location.href);url.searchParams.delete("edit");history.replaceState(null,"",url);}}}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 useEffect(()=>{load();},[]);
 async function mutate(body:object){const r=await fetch('/api/catalog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error);return d;}
 const filtered=videos.filter(v=>(v.name+' '+v.title).toLowerCase().includes(q.toLowerCase()));
 const ordered=orderVideos(filtered,order);
 const dated=ordered.filter(v=>v.publishedAt);
 const undated=ordered.filter(v=>!v.publishedAt);
 const years=[...new Set(dated.map(v=>v.publishedAt.slice(0,4)))];
 useEffect(()=>{
  if(timelineViewport.current){timelineViewport.current.scrollLeft=0;timelineViewport.current.scrollTop=0;}
 },[order,q,orientation,videos]);
 useEffect(()=>{
  if(orientation!=='horizontal'||loading)return;
  const viewport=timelineViewport.current,canvas=timelineCanvas.current;
  if(!viewport||!canvas)return;
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let frame=0,lastPaint=0,visible=false,dirty=true;
  const paint=(time:number)=>{
   const cards=viewport.querySelector<HTMLElement>('.timeline-items');
   const firstCard=cards?.querySelector<HTMLElement>('.video-card');
   const canvasBounds=canvas.getBoundingClientRect();
   const cardMargin=firstCard?(parseFloat(getComputedStyle(firstCard).marginBottom)||0)*sceneZoom:0;
   const railY=cards?cards.getBoundingClientRect().bottom-canvasBounds.top-cardMargin+10:undefined;
   const dateTicks=[...viewport.querySelectorAll<HTMLElement>('.video-card')].flatMap(card=>{
    const date=card.querySelector('time')?.dateTime;
    if(!date)return [];
    const [year,month,day]=date.split('-');
    const bounds=card.getBoundingClientRect();
    if(bounds.width<90)return [];
    const x=bounds.left+bounds.width/2-canvasBounds.left;
    return x < -40 || x > canvasBounds.width+40 ? [] : [{x,label:`${day}.${month}.${year.slice(-2)}`}];
   });
   drawTimelineRunway(canvas,viewport.scrollLeft,railY,dateTicks,timelinePointer.current,reducedMotion?0:time);
   dirty=false;
   lastPaint=time;
  };
  const tick=(time:number)=>{
   frame=0;
   if(!visible||document.visibilityState!=='visible')return;
   if(dirty||!reducedMotion&&time-lastPaint>=65)paint(time);
   if(!reducedMotion)frame=requestAnimationFrame(tick);
  };
  const schedulePaint=()=>{
   dirty=true;
   if(visible&&document.visibilityState==='visible'&&!frame)frame=requestAnimationFrame(tick);
  };
  const onWheel=(event:WheelEvent)=>{
   if(event.ctrlKey||event.metaKey){
    event.preventDefault();
    changeSceneZoom(event.deltaY<0?.08:-.08);
    return;
   }
   const axis=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;
   const unit=event.deltaMode===1?16:event.deltaMode===2?viewport.clientWidth:1;
   const amount=axis*unit,max=Math.max(0,viewport.scrollWidth-viewport.clientWidth);
   if(!amount||!max)return;
   const next=Math.max(0,Math.min(max,viewport.scrollLeft+amount));
   if(Math.abs(next-viewport.scrollLeft)<.5)return;
   event.preventDefault();
   viewport.scrollLeft=next;
   schedulePaint();
  };
  const onPointerMove=(event:PointerEvent)=>{
   if(event.pointerType==='touch')return;
   const bounds=canvas.getBoundingClientRect();
   timelinePointer.current={x:event.clientX-bounds.left,y:event.clientY-bounds.top};
   schedulePaint();
  };
  const onPointerLeave=()=>{timelinePointer.current=null;schedulePaint();};
  const observer=new ResizeObserver(schedulePaint);
  const visibilityObserver=new IntersectionObserver(entries=>{
   visible=entries[0]?.isIntersecting??false;
   if(visible)schedulePaint();
   else if(frame){cancelAnimationFrame(frame);frame=0;}
  },{rootMargin:'100px'});
  observer.observe(viewport);
  visibilityObserver.observe(canvas);
  viewport.querySelectorAll('.timeline-items').forEach(items=>observer.observe(items));
  viewport.addEventListener('wheel',onWheel,{passive:false});
  viewport.addEventListener('scroll',schedulePaint,{passive:true});
  viewport.addEventListener('pointermove',onPointerMove,{passive:true});
  viewport.addEventListener('pointerleave',onPointerLeave,{passive:true});
  document.addEventListener('visibilitychange',schedulePaint);
  paint(performance.now());
  return()=>{observer.disconnect();visibilityObserver.disconnect();document.removeEventListener('visibilitychange',schedulePaint);viewport.removeEventListener('wheel',onWheel);viewport.removeEventListener('scroll',schedulePaint);viewport.removeEventListener('pointermove',onPointerMove);viewport.removeEventListener('pointerleave',onPointerLeave);if(frame)cancelAnimationFrame(frame);};
 },[orientation,loading,order,filtered.length,sceneZoom]);
 useEffect(()=>{
  if(orientation!=='horizontal'||loading||!timelineViewport.current)return;
  const viewport=timelineViewport.current;
  const observer=new IntersectionObserver(entries=>{
   for(const entry of entries)entry.target.classList.toggle('is-in-view',entry.isIntersecting);
  },{root:viewport,rootMargin:'0px 100px'});
  viewport.querySelectorAll('.video-card').forEach(card=>observer.observe(card));
  return()=>observer.disconnect();
 },[orientation,loading,order,filtered.length]);
 function startDrag(event:React.PointerEvent<HTMLDivElement>){
  if(event.pointerType!=='mouse'||event.button!==0)return;
  drag.current={pointerId:event.pointerId,startX:event.clientX,scrollLeft:event.currentTarget.scrollLeft,active:false};
 }
 function moveDrag(event:React.PointerEvent<HTMLDivElement>){
  const current=drag.current;
  if(!current||current.pointerId!==event.pointerId)return;
  if(!current.active){
   if(Math.abs(event.clientX-current.startX)<6)return;
   current.active=true;
   event.currentTarget.setPointerCapture(event.pointerId);
   event.currentTarget.dataset.dragging='true';
  }
  event.preventDefault();
  event.currentTarget.scrollLeft=current.scrollLeft+current.startX-event.clientX;
 }
 function stopDrag(event:React.PointerEvent<HTMLDivElement>){
  const current=drag.current;
  if(!current||current.pointerId!==event.pointerId)return;
  if(current.active){
   suppressDragClick.current=true;
   delete event.currentTarget.dataset.dragging;
   if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
   requestAnimationFrame(()=>{suppressDragClick.current=false;});
  }
  drag.current=null;
 }
 function edit(v?:Video){setDraft(v?{...v}:{...blank});setFormError('');setImportMessage('');}
 async function importDraft(){
  if(!draft?.url)return;
  setBusy(true);setFormError('');setImportMessage('');
  try{
   const response=await fetch('/api/video-import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:draft.url})});
   const result=await response.json();if(!response.ok)throw Error(result.error);
   setDraft(current=>({...current!,...result,name:current!.name||result.title||'',title:result.title||current!.title,publishedAt:result.publishedAt||current!.publishedAt,dateSource:result.publishedAt?result.dateSource:current!.dateSource,dateUrl:result.publishedAt?result.dateUrl:current!.dateUrl,image:result.image||current!.image,description:result.description||current!.description}));
   setImportMessage(result.imageSavedLocally?'Обложка найдена и сохранена локально. Проверьте данные.':result.image?'Обложка найдена, но сохранить её локально не удалось. '+(result.imageNotice||''):'Источник не отдал изображение. Загрузите свой файл или укажите ссылку на обложку.');
  }catch(error){setFormError((error as Error).message);}finally{setBusy(false);}
 }
 async function uploadCover(file:File){
  setBusy(true);setFormError('');
  try{const response=await fetch('/api/avatar-upload',{method:'POST',headers:{'Content-Type':file.type},body:file});const result=await response.json();if(!response.ok)throw Error(result.error);setDraft(current=>({...current!,image:result.image}));setImportMessage('Изображение загружено. Сохраните работу.');}
  catch(error){setFormError((error as Error).message);}finally{setBusy(false);}
 }
 async function cacheCover(){
  if(!draft?.image)return;
  setBusy(true);setFormError('');
  try{const response=await fetch('/api/video-image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:draft.image})});const result=await response.json();if(!response.ok)throw Error(result.error);setDraft(current=>({...current!,image:result.image}));setImportMessage('Обложка сохранена локально. Сохраните работу.');}
  catch(error){setFormError((error as Error).message);}finally{setBusy(false);}
 }
 function card(v:Video){
  const [year,month,day]=v.publishedAt?.split('-')||[];
  const compactDate=year&&month&&day?`${day}.${month}.${year.slice(-2)}`:'БЕЗ ДАТЫ';
  const playable=Boolean(v.videoId||v.isVideo);
  return <article className="video-card" key={v.id}>
   <div className="video-date"><time dateTime={v.publishedAt||undefined} title={v.publishedAt?new Date(v.publishedAt+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'}):'Дата неизвестна'}><span className="video-date-compact">{compactDate}</span><span className="video-date-full">{v.publishedAt?new Date(v.publishedAt+'T12:00:00').toLocaleDateString('ru-RU',{day:'2-digit',month:'short',...(order!=='dates'?{year:'numeric' as const}:{})}):'—'}</span></time><small>{!v.publishedAt?'Дата неизвестна':v.dateSource==='manual'?'Указана куратором':v.platform==='Telegram'?'Дата поста':'Дата публикации'}</small></div>
   <button className="video-thumb" aria-label={playable?'Открыть видео '+v.name:'Открыть материал '+v.name} onClick={()=>setSelected(v)}><img src={coverSource(v)} alt="" loading="lazy" referrerPolicy="no-referrer" onError={e=>coverError(e,v)}/>{playable&&<span className="video-play"><Play size={18}/></span>}</button>
   <div className="video-copy">
    <a href={v.url} target="_blank" rel="noreferrer" className="video-platform" aria-label={`Открыть источник: ${v.name} · ${v.platform}`} title={`Открыть в ${v.platform}`}><span className="video-platform-full">{v.platform}{v.reference?' · ссылка на источник':''}</span><span className="video-platform-short" aria-hidden="true">{platformShortNames[v.platform]||v.platform.slice(0,2).toUpperCase()}</span><ArrowUpRight size={12} aria-hidden="true"/></a>
    <h3><VideoName name={v.name} fitToWidth={orientation!=='horizontal'} onOpen={()=>setSelected(v)}/></h3>
   </div>
   {admin?<div className="video-actions"><button aria-label={'Редактировать видео '+v.name} onClick={()=>edit(v)}><Pencil size={17}/></button><button aria-label={'Удалить видео '+v.name} onClick={()=>setDeleting(v)}><Trash2 size={17}/></button></div>:showLocalAdmin&&<a className="card-edit video-card-edit" href={adminUrl+"/?edit="+encodeURIComponent(v.id)+"#videos"} aria-label={"Редактировать видео "+v.name} title="Редактировать материал"><Pencil size={16} aria-hidden="true"/></a>}
  </article>;
 }
 const instagramEmbed=selected?instagramEmbedUrl(selected):'';
 return <section className="video-section">
  <div className="video-heading"><div><div className="eyebrow">{admin?'КУРАТОРСКАЯ · УПРАВЛЕНИЕ ВИДЕО':'ПРИМЕНЕНИЕ ИИ · АРХИВ РАБОТ'}</div><h1>ИИ в творчестве<span>.</span></h1><p>{admin?'Добавляйте видео и публикации, редактируйте подписи и обложки карточек.':'Музыка, видео, визуальные работы и эксперименты с ИИ. Смотрите по дате публикации или времени добавления.'}</p></div>{admin&&<div className="video-admin-actions"><button className="primary-btn" onClick={()=>edit()}><Plus size={18}/>Добавить работу</button></div>}</div>
  <div className="video-toolbar">
   <label className="input-search" title="Поиск по автору или названию"><Search size={17}/><input aria-label="Поиск материалов" placeholder="Поиск работ…" value={q} onChange={e=>setQ(e.target.value)}/></label>
   <div className="video-toolbar-radios">
    <fieldset className="video-radio-group video-order-group"><legend className="sr-only">Порядок работ</legend><div>
     <span className="video-control-label" aria-hidden="true">ПОРЯДОК</span>
     <label title="Сначала новые добавления"><input type="radio" name="video-order" value="desc" aria-label="По убыванию" checked={order==='desc'} onChange={()=>setOrder('desc')}/><span><ArrowDownWideNarrow size={16} aria-hidden="true"/><b>По<br/>убыванию</b></span></label>
     <label title="Сначала ранние добавления"><input type="radio" name="video-order" value="asc" aria-label="По возрастанию" checked={order==='asc'} onChange={()=>setOrder('asc')}/><span><ArrowUpNarrowWide size={16} aria-hidden="true"/><b>По<br/>возрастанию</b></span></label>
     <label title="По датам публикации"><input type="radio" name="video-order" value="dates" aria-label="ИИ" aria-description="По датам публикации, от ранних к поздним" checked={order==='dates'} onChange={()=>setOrder('dates')}/><span><CalendarDays size={16} aria-hidden="true"/><b>ИИ<small>по датам</small></b></span></label>
    </div></fieldset>
    <fieldset className="video-radio-group video-view-group"><legend className="sr-only">ВИД</legend><div>
     <span className="video-control-label" aria-hidden="true">ВИД</span>
     <label title="Горизонтальная лента карточек"><input type="radio" name="video-orientation" value="horizontal" aria-label="Горизонтально" checked={orientation==='horizontal'} onChange={()=>setOrientation('horizontal')}/><span><GalleryHorizontal size={16} aria-hidden="true"/><b>Лента</b></span></label>
     <label title="Вертикальный список работ"><input type="radio" name="video-orientation" value="vertical" aria-label="Вертикально" checked={orientation==='vertical'} onChange={()=>setOrientation('vertical')}/><span><List size={16} aria-hidden="true"/><b>Список</b></span></label>
    </div></fieldset>
   </div>
  </div>
  <div className="video-summary">{filtered.length} материалов · {dated.length} с датой · {undated.length} без даты</div>{orientation==='horizontal'&&<p className="timeline-hint">Колесо мыши или перетягивание листает ленту · Ctrl/⌘ + колесо меняет масштаб <span aria-hidden="true">← листайте →</span></p>}
  {error&&<p role="alert" className="error">{error} <button onClick={load}>Повторить</button></p>}
  {loading?<p className="empty">Загружаем архив творческих работ…</p>:<div className={`timeline-layout timeline-layout--${orientation}${order!=='dates'?' timeline-layout--source':''}`}>
   {order==='dates'&&<nav className="timeline-years" aria-label="Годы таймлайна">{years.map(y=><a key={y} href={'#year-'+y}>{y}</a>)}{undated.length>0&&<a href="#year-unknown">Без даты <small>{undated.length}</small></a>}</nav>}
   <div className="timeline-scene" data-compact-labels={orientation==='horizontal'&&sceneZoom<.6?true:undefined} data-mini-cards={orientation==='horizontal'&&sceneZoom<.5?true:undefined} style={orientation==='horizontal'?{
    '--timeline-zoom':sceneZoom,
    '--timeline-text-scale':Math.max(1,1/sceneZoom),
    '--timeline-card-width':`${160+zoomProgress*30}px`,
    '--timeline-stage-top':`${Math.round(52+zoomProgress*20)}px`,
    '--timeline-stage-bottom':`${Math.round(16+zoomProgress*16)}px`,
    '--timeline-stage-mobile-top':`${Math.round(64+zoomProgress*12)}px`,
   } as React.CSSProperties:undefined}>
   {orientation==='horizontal'&&<canvas ref={timelineCanvas} className="timeline-runway" aria-hidden="true"/>}
   {orientation==='horizontal'&&<div className="timeline-zoom-controls"><label htmlFor="timeline-zoom">ЗУМ</label><button type="button" aria-label="Уменьшить масштаб" disabled={sceneZoom<=MIN_SCENE_ZOOM} onClick={()=>changeSceneZoom(-.1)}><ZoomOut size={18}/></button><input id="timeline-zoom" type="range" min={MIN_SCENE_ZOOM*100} max={MAX_SCENE_ZOOM*100} step="5" value={Math.round(sceneZoom*100)} onChange={event=>setSceneZoom(Number(event.target.value)/100)} aria-label="Масштаб видеоленты"/><output htmlFor="timeline-zoom" aria-live="polite">{Math.round(sceneZoom*100)}%</output><button type="button" aria-label="Увеличить масштаб" disabled={sceneZoom>=MAX_SCENE_ZOOM} onClick={()=>changeSceneZoom(.1)}><ZoomIn size={18}/></button></div>}
   <div ref={timelineViewport} className="timeline-content" aria-label={orientation==='horizontal'?'Горизонтальная видеолента':undefined} tabIndex={orientation==='horizontal'?0:undefined} onPointerDown={orientation==='horizontal'?startDrag:undefined} onPointerMove={orientation==='horizontal'?moveDrag:undefined} onPointerUp={orientation==='horizontal'?stopDrag:undefined} onPointerCancel={orientation==='horizontal'?stopDrag:undefined} onClickCapture={orientation==='horizontal'?event=>{if(suppressDragClick.current){event.preventDefault();event.stopPropagation();suppressDragClick.current=false;}}:undefined} onDragStart={orientation==='horizontal'?event=>event.preventDefault():undefined} onKeyDown={orientation==='horizontal'?event=>{if(event.key==='+'||event.key==='='){event.preventDefault();changeSceneZoom(.1);}else if(event.key==='-'){event.preventDefault();changeSceneZoom(-.1);}}:undefined}>
    {order!=='dates'?<section className="timeline-year timeline-year--source"><h2>{order==='desc'?'Новые добавления':'Ранние добавления'}<sup>{ordered.length}</sup></h2><p className="undated-note">{order==='desc'?'Сначала последние добавленные работы, затем ранние.':'Сначала первые добавленные работы, затем новые.'} Дата публикации не влияет на этот порядок.</p><div className="timeline-items">{ordered.map(card)}</div></section>:<>
     {years.map(y=><section id={'year-'+y} className="timeline-year" key={y}><h2>{y}<sup>{dated.filter(v=>v.publishedAt.startsWith(y)).length}</sup></h2><div className="timeline-items">{dated.filter(v=>v.publishedAt.startsWith(y)).map(card)}</div></section>)}
     {undated.length>0&&<section id="year-unknown" className="timeline-year"><h2>Дата не указана<sup>{undated.length}</sup></h2><p className="undated-note">Дата публикации неизвестна. Материалы расположены по времени добавления.</p><div className="timeline-items">{undated.map(card)}</div></section>}
    </>}
    {!filtered.length&&<p className="empty">Материалы не найдены. Измените поисковый запрос.</p>}
   </div>
   </div>
  </div>}
 <Dialog open={!!selected} onOpenChange={open=>{if(!open)setSelected(null);}}><DialogContent className={`editor-dialog video-dialog${instagramEmbed?' video-dialog--instagram':''}`}><DialogTitle>{selected?.name}</DialogTitle><DialogDescription>{selected?.title||selected?.platform}</DialogDescription>{selected?.videoId?<iframe title={selected.name} src={'https://www.youtube-nocookie.com/embed/'+selected.videoId} referrerPolicy="strict-origin-when-cross-origin" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen/>:instagramEmbed?<div className="instagram-player"><iframe key={instagramEmbed} title={`Instagram · ${selected?.name}`} src={instagramEmbed} scrolling="no" referrerPolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen/></div>:<p>Встроенный просмотр недоступен. Откройте материал у источника.</p>}{selected?.reference&&<p className="notice">В архиве указан профиль или сайт, а не отдельная публикация.</p>}<a className="primary-btn" href={selected?.url} target="_blank" rel="noreferrer">Открыть источник · {selected?.platform}<ArrowUpRight size={17}/></a>{selected?.alternateUrls.map((url,i)=><a key={url} href={url} target="_blank" rel="noreferrer">Резервный источник {i+1} ↗</a>)}{selected?.description&&<p>{selected.description}</p>}</DialogContent></Dialog>
 <Dialog open={!!draft} onOpenChange={open=>{if(!open&&!busy)setDraft(null);}}>
  <DialogContent className="editor-dialog video-editor-dialog">
   <DialogTitle>{draft?.id?'Редактировать видео':'Добавить видео'}</DialogTitle>
   <DialogDescription>Работа появится в разделе «ИИ в творчестве» после сохранения.</DialogDescription>
   {draft&&<form className="artist-form video-editor-form" onSubmit={async event=>{
    event.preventDefault();setBusy(true);setFormError('');
    try{await mutate({action:'video-save',video:draft});setDraft(null);await load();}
    catch(error){setFormError((error as Error).message);}finally{setBusy(false);}
   }}>
    <label>Ссылка на видео или публикацию<input required type="url" value={draft.url} onChange={event=>{setImportMessage('');setDraft({...draft,url:event.target.value,publishedAt:'',dateSource:'unknown',dateUrl:'',videoId:'',isVideo:false,image:'',title:'',description:''});}}/></label>
    <button type="button" disabled={busy||!draft.url} className="secondary-btn metadata-import-btn" onClick={importDraft}>{busy?'Загрузка…':'Подгрузить данные и обложку из YouTube, VK, Telegram или Instagram'}</button>
    <label>Автор / название<input required maxLength={160} value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})}/></label>
    <label>Название работы<input maxLength={250} value={draft.title} onChange={event=>setDraft({...draft,title:event.target.value})}/></label>
    <label>Дата публикации<input type="date" value={draft.publishedAt} onChange={event=>setDraft({...draft,publishedAt:event.target.value,dateSource:'manual',dateUrl:''})}/></label>
    <div className="video-cover-editor">
     <div className="video-cover-preview"><img src={coverSource(draft)} alt="Текущая обложка видео" referrerPolicy="no-referrer" onError={event=>coverError(event,draft)}/></div>
     <div className="video-cover-fields">
      <label>Изображение карточки<input type="url" placeholder="https://…" value={draft.image.startsWith('./')?'':draft.image} onChange={event=>setDraft({...draft,image:event.target.value})}/></label>
      {draft.image.startsWith('./')&&<span className="video-cover-local">Изображение сохранено локально.</span>}
      <div className="video-cover-actions"><label className="secondary-btn video-cover-upload">Загрузить файл<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event=>{const file=event.target.files?.[0];if(file)uploadCover(file);event.target.value='';}}/></label>
      {draft.image.startsWith('https://')&&<button type="button" className="secondary-btn" disabled={busy} onClick={cacheCover}>Сохранить по ссылке</button>}</div>
     </div>
    </div>
    <label>Описание<textarea value={draft.description} maxLength={1500} onChange={event=>setDraft({...draft,description:event.target.value})}/></label>
    {(formError||importMessage)&&<p className="notice" role="status">{formError||importMessage}</p>}
    <div className="form-actions"><button type="button" className="secondary-btn" onClick={()=>setDraft(null)} disabled={busy}>Отмена</button><button className="primary-btn" disabled={busy}>Сохранить работу</button></div>
   </form>}
  </DialogContent>
 </Dialog>
 <AlertDialog open={!!deleting} onOpenChange={open=>{if(!open&&!busy)setDeleting(null);}}><AlertDialogContent className="editor-dialog"><AlertDialogTitle>Удалить работу {deleting?.name}?</AlertDialogTitle><AlertDialogDescription>Работа исчезнет из архива.</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel disabled={busy}>Отмена</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={async e=>{e.preventDefault();setBusy(true);try{await mutate({action:'video-delete',id:deleting?.id});setDeleting(null);await load();}catch(e){setError((e as Error).message);setDeleting(null);}finally{setBusy(false);}}}>Удалить</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></section>;
}
