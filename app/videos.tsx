import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Plus,ArrowUpRight,Play,Pencil,Trash2,Search,ZoomIn,ZoomOut,ArrowDownWideNarrow,ArrowUpNarrowWide,GalleryHorizontal,LayoutGrid} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Popover,PopoverTrigger,PopoverContent} from '@/components/ui/popover';
import {AlertDialog,AlertDialogContent,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {catalogUrl,adminUrl,showLocalAdmin} from '@/client/config';
import {drawTimelineRunway} from './timeline-runway';
import {cardMaterial} from './card-material';
import DossierInstruments,{trackDossierPointer,resetDossierPointer} from './dossier-instruments';
import {orderVideos,type VideoOrder} from './video-order';
import type {Video} from '@/lib/types';
import VideoPlayer from './video-player';
import TimelineNavigator from './timeline-navigator';
import TimelineGridFlow from './timeline-grid-flow';
const blank:Video={id:'',name:'',url:'',platform:'',videoId:'',reference:false,isVideo:false,publishedAt:'',dateSource:'unknown',dateUrl:'',image:'',alternateUrls:[],sourceOrder:0};
const fallbackImage='./video-fallback.svg';
const platformShortNames:Record<string,string>={Instagram:'IG',YouTube:'YT',Telegram:'TG',VK:'VK'};
const MIN_SCENE_ZOOM=.25,MAX_SCENE_ZOOM=1.5;
const MIN_GRID_ZOOM=.5,MAX_GRID_ZOOM=1.5;
function coverSource(video:Video){return video.image||video.videoId&&`https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`||fallbackImage;}
function coverError(event:React.SyntheticEvent<HTMLImageElement>,video:Video){
 const image=event.currentTarget,youtube=video.videoId&&`https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;
 if(image.src.endsWith('/video-fallback.svg'))return;
 image.src=youtube&&image.src!==youtube?youtube:fallbackImage;
}
function VideoName({name,onOpen,url}:{name:string;onOpen:()=>void;url?:string}){
 const ref=useRef<HTMLButtonElement|HTMLAnchorElement>(null),windowRef=useRef<HTMLSpanElement>(null),copyRef=useRef<HTMLSpanElement>(null);
 useEffect(()=>{
  const button=ref.current,viewport=windowRef.current,copy=copyRef.current;
  if(!button||!viewport||!copy)return;
  const canvas=document.createElement('canvas'),context=canvas.getContext('2d');
  let active=true;
  const fit=()=>{
   if(!active)return;
   button.style.removeProperty('font-size');
   if(context&&button.clientWidth>0){
    const style=getComputedStyle(button),fontSize=parseFloat(style.fontSize);
    context.font=style.font;
    const longest=Math.max(...name.split(/\s+/).map(word=>context.measureText(word).width));
    if(longest>button.clientWidth)button.style.fontSize=`${Math.max(6,Math.floor(fontSize*(button.clientWidth-2)/longest))}px`;
   }
   const travel=Math.max(0,copy.scrollHeight-viewport.clientHeight);
   button.dataset.overflow=travel>1?'true':'false';
   button.style.setProperty('--video-name-travel',`${travel}px`);
   button.style.setProperty('--video-name-duration',`${Math.max(4,Math.min(18,travel/20*2+1.5))}s`);
  };
  const observer=new ResizeObserver(fit);
  observer.observe(button);observer.observe(viewport);observer.observe(copy);
  document.fonts.ready.then(fit);fit();
  return()=>{active=false;observer.disconnect();};
 },[name,url]);
 const content=<span ref={windowRef} className="video-name-window"><span ref={copyRef} className="video-name-copy">{name.split(/(\s+)/).map((part,index)=>/^\s+$/.test(part)?part:<span className="video-name-word" key={index}>{part}</span>)}</span></span>;
 return url?<a ref={node=>{ref.current=node;}} className="video-name-button" href={url} target="_blank" rel="noopener noreferrer" title={name+' · открыть в новой вкладке'}>{content}</a>:<button ref={node=>{ref.current=node;}} className="video-name-button" type="button" title={name} onClick={onOpen}>{content}</button>;
}
export default function Videos({admin=false,onTotalChange}:{admin?:boolean;onTotalChange?:(total:number)=>void}){
 const [videos,setVideos]=useState<Video[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[q,setQ]=useState(''),[order,setOrder]=useState<VideoOrder>('desc'),[orientation,setOrientation]=useState<'vertical'|'horizontal'>('horizontal'),[draft,setDraft]=useState<Video|null>(null),[selected,setSelected]=useState<Video|null>(null),[deleting,setDeleting]=useState<Video|null>(null),[busy,setBusy]=useState(false),[formError,setFormError]=useState(''),[importMessage,setImportMessage]=useState('');
 const [sceneZoom,setSceneZoom]=useState(.65);
 const [gridZoom,setGridZoom]=useState(1);
 const [draftPosition,setDraftPosition]=useState(''),[initialDraftPosition,setInitialDraftPosition]=useState('');
 const [positionDraft,setPositionDraft]=useState<Video|null>(null),[positionValue,setPositionValue]=useState(''),[positionError,setPositionError]=useState(''),[moving,setMoving]=useState(false),[moveNotice,setMoveNotice]=useState(''),[revealId,setRevealId]=useState<string|null>(null);
 const positionInputRef=useRef<HTMLInputElement>(null),videoRefs=useRef(new Map<string,HTMLElement>()),skipPositionFocusRestore=useRef(false);
 const editorReturn=useRef<{videoId:string;focus:HTMLElement|null;pageX:number;pageY:number;railX:number;railY:number}|null>(null),skipEditorFocusRestore=useRef(false);
 const zoomProgress=(sceneZoom-MIN_SCENE_ZOOM)/(MAX_SCENE_ZOOM-MIN_SCENE_ZOOM);
 const timelineScene=useRef<HTMLDivElement>(null),timelineViewport=useRef<HTMLDivElement>(null),timelineCanvas=useRef<HTMLCanvasElement>(null);
 const gridFrame=useRef<HTMLDivElement>(null);
 const gridZoomAnchor=useRef<{id:string;top:number}|null>(null),previousGridZoom=useRef(gridZoom);
 const previousSceneZoom=useRef(sceneZoom);
 const drag=useRef<{pointerId:number;startX:number;scrollLeft:number;active:boolean}|null>(null);
 const suppressDragClick=useRef(false);
 const changeSceneZoom=(amount:number)=>setSceneZoom(current=>Math.round(Math.max(MIN_SCENE_ZOOM,Math.min(MAX_SCENE_ZOOM,current+amount))*100)/100);
 const changeGridZoom=(amount:number)=>{
  const visible=[...gridFrame.current?.querySelectorAll<HTMLElement>('.video-card')||[]].find(card=>{const bounds=card.getBoundingClientRect();return bounds.bottom>80&&bounds.top<window.innerHeight;});
  gridZoomAnchor.current=visible?{id:visible.dataset.videoId||'',top:visible.getBoundingClientRect().top}:null;
  setGridZoom(current=>Math.round(Math.max(MIN_GRID_ZOOM,Math.min(MAX_GRID_ZOOM,current+amount))*100)/100);
 };
 async function load(){try{setError('');const r=await fetch(catalogUrl,{cache:'no-store'});if(!r.ok)throw Error('Не удалось загрузить видео.');const data=await r.json(),items:Video[]=data.videos||[];setVideos(items);onTotalChange?.(items.length);if(admin){const editId=new URLSearchParams(location.search).get("edit");if(editId){const item=items.find((v:Video)=>v.id===editId);if(item)edit(item,items);const url=new URL(location.href);url.searchParams.delete("edit");history.replaceState(null,"",url);}}}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 useEffect(()=>{load();},[]);
 // Zoom changes the panel height. Keep its centre in view without moving the rail.
 useLayoutEffect(()=>{
  const changed=previousSceneZoom.current!==sceneZoom;
  previousSceneZoom.current=sceneZoom;
  if(!changed||orientation!=='horizontal')return;
  const scene=timelineScene.current;
  if(!scene)return;
  const center=()=>scene.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
  center();
  // Name screens finish fitting after layout; account for their final height too.
  const frame=requestAnimationFrame(center);
  return()=>cancelAnimationFrame(frame);
 },[sceneZoom,orientation]);
 useLayoutEffect(()=>{
  const changed=previousGridZoom.current!==gridZoom;
  previousGridZoom.current=gridZoom;
  const anchor=gridZoomAnchor.current;gridZoomAnchor.current=null;
  if(!changed||orientation!=='vertical'||!anchor)return;
  const restore=()=>{
   const card=videoRefs.current.get(anchor.id);
   if(card)window.scrollBy({top:card.getBoundingClientRect().top-anchor.top,behavior:'instant'});
  };
  restore();
  const frame=requestAnimationFrame(restore);
  return()=>cancelAnimationFrame(frame);
 },[gridZoom,orientation]);
 async function mutate(body:object){const r=await fetch('/api/catalog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error);return d;}
 const matchesVideo=(v:Video)=>v.name.toLowerCase().includes(q.toLowerCase());
 const filtered=videos.filter(matchesVideo),allOrdered=orderVideos(videos,order);
 const ordered=allOrdered.filter(matchesVideo),positions=new Map(allOrdered.map((video,index)=>[video.id,index+1]));
 useEffect(()=>{
  if(orientation!=='vertical'||loading)return;
  const frame=gridFrame.current;
  if(!frame)return;
  const wheel=(event:WheelEvent)=>{
   if(!event.ctrlKey&&!event.metaKey)return;
   event.preventDefault();
   changeGridZoom(event.deltaY<0?.1:-.1);
  };
  frame.addEventListener('wheel',wheel,{passive:false});
  return()=>frame.removeEventListener('wheel',wheel);
 },[orientation,loading]);
 // Catalog refreshes must keep the reader's position in the current view.
 useEffect(()=>{
  if(timelineViewport.current){timelineViewport.current.scrollLeft=0;timelineViewport.current.scrollTop=0;}
 },[order,q,orientation]);
 useEffect(()=>{
  if(!revealId)return;
  const frame=requestAnimationFrame(()=>{
   const card=videoRefs.current.get(revealId);
   card?.scrollIntoView({block:'nearest',inline:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
   card?.querySelector<HTMLButtonElement>('.video-position-button')?.focus({preventScroll:true});
   setRevealId(null);
  });
  return()=>cancelAnimationFrame(frame);
 },[revealId,videos,orientation]);
 function editPosition(video:Video){
  skipPositionFocusRestore.current=false;setPositionDraft(video);setPositionValue(String(positions.get(video.id)));setPositionError('');
 }
 async function applyPosition(event:React.FormEvent){
  event.preventDefault();if(!positionDraft||moving)return;
  const value=positionValue.trim(),position=Number(value);
  if(!/^\d+$/.test(value)||!Number.isInteger(position)||position<1||position>videos.length){setPositionError(`Укажите целую позицию от 1 до ${videos.length}.`);return;}
  setMoving(true);setPositionError('');
  try{
   const data=await mutate({action:'video-move',id:positionDraft.id,position,reverseNumbering:order==='desc'}) as {videos:Video[];position:number};
   skipPositionFocusRestore.current=true;setVideos(data.videos);
   setMoveNotice(`${positionDraft.name} — позиция ${data.position}.`);setRevealId(positionDraft.id);setPositionDraft(null);
  }catch(error){setPositionError((error as Error).message);}finally{setMoving(false);}
 }
 useEffect(()=>{
  if(orientation!=='horizontal'||loading)return;
  const viewport=timelineViewport.current,canvas=timelineCanvas.current;
  if(!viewport||!canvas)return;
  let frame=0,lastPaint=-Infinity,visible=false,dirty=true;
  let railY:number|undefined,dateTicks:Array<{x:number;label:string}>=[];
  const paint=(time:number)=>{
   // Date geometry changes on scrolling/resizing, not on every animation frame.
   if(dirty){
    const cards=viewport.querySelector<HTMLElement>('.timeline-items');
    const firstCard=cards?.querySelector<HTMLElement>('.video-card');
    const canvasBounds=canvas.getBoundingClientRect();
    const cardMargin=firstCard?(parseFloat(getComputedStyle(firstCard).marginBottom)||0)*sceneZoom:0;
    railY=cards?cards.getBoundingClientRect().bottom-canvasBounds.top-cardMargin+10:undefined;
    dateTicks=[...viewport.querySelectorAll<HTMLElement>('.video-card')].flatMap(card=>{
     const date=card.querySelector('time')?.dateTime;
     if(!date)return [];
     const [year,month,day]=date.split('-');
     const bounds=card.getBoundingClientRect();
     if(bounds.width<90)return [];
     const x=bounds.left+bounds.width/2-canvasBounds.left;
     return x < -40 || x > canvasBounds.width+40 ? [] : [{x,label:`${day}.${month}.${year.slice(-2)}`}];
    });
   }
   drawTimelineRunway(canvas,railY,dateTicks,time);
   dirty=false;
   lastPaint=time;
  };
  const tick=(time:number)=>{
   frame=0;
   if(!visible||document.visibilityState!=='visible')return;
   if(dirty||time-lastPaint>=1000/30)paint(time);
   frame=requestAnimationFrame(tick);
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
  document.addEventListener('visibilitychange',schedulePaint);
  paint(performance.now());
  return()=>{observer.disconnect();visibilityObserver.disconnect();document.removeEventListener('visibilitychange',schedulePaint);viewport.removeEventListener('wheel',onWheel);viewport.removeEventListener('scroll',schedulePaint);if(frame)cancelAnimationFrame(frame);};
 },[orientation,loading,order,q,videos,filtered.length,sceneZoom]);
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
 function edit(v?:Video,items=videos){
  editorReturn.current={videoId:v?.id||'',focus:document.activeElement instanceof HTMLElement?document.activeElement:null,pageX:window.scrollX,pageY:window.scrollY,railX:timelineViewport.current?.scrollLeft||0,railY:timelineViewport.current?.scrollTop||0};
  skipEditorFocusRestore.current=false;
  const position=v?orderVideos(items,order).findIndex(item=>item.id===v.id)+1:order==='desc'?1:items.length+1;
  setDraft(v?{...v}:{...blank});setDraftPosition(String(position));setInitialDraftPosition(String(position));setFormError('');setImportMessage('');
 }
 async function importDraft(){
  if(!draft?.url)return;
  setBusy(true);setFormError('');setImportMessage('');
  try{
   const response=await fetch('/api/video-import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:draft.url})});
   const result=await response.json();if(!response.ok)throw Error(result.error);
   setDraft(current=>({...current!,...result,name:current!.name||result.name||'',publishedAt:result.publishedAt||current!.publishedAt,dateSource:result.publishedAt?result.dateSource:current!.dateSource,dateUrl:result.publishedAt?result.dateUrl:current!.dateUrl,image:result.image||current!.image}));
   setImportMessage((result.media?'Видео сохранено для просмотра на сайте. ':result.videoNotice?'Не удалось сохранить видео: '+result.videoNotice+' ':'')+(result.imageSavedLocally?'Обложка найдена и сохранена локально. Проверьте данные.':result.image?'Обложка найдена, но сохранить её локально не удалось. '+(result.imageNotice||''):'Источник не отдал изображение. Загрузите свой файл или укажите ссылку на обложку.'));
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
  const playable=Boolean(v.videoId||v.media);
  const cover=<><img className="video-cover-image" src={coverSource(v)} alt="" loading="lazy" referrerPolicy="no-referrer" onError={e=>coverError(e,v)}/>{playable&&<span className="video-play video-cover-icon"><Play size={20} aria-hidden="true"/></span>}{v.section&&<span className="video-region-badge video-cover-icon" data-section={v.section} title={v.section==='world'?'Мир':'Рунет'}><img src={v.section==='world'?'./badges/region-en-eagle-cutout.png':'./badges/region-ru-emblem-cutout.png'} alt={v.section==='world'?'Мир':'Рунет'}/></span>}</>;
  return <article className="video-card" ref={node=>{if(node)videoRefs.current.set(v.id,node);else videoRefs.current.delete(v.id);}} data-video-id={v.id} data-curator={admin||undefined} data-position={admin?positions.get(v.id):undefined} style={cardMaterial(v.id)} key={v.id} onPointerMove={trackDossierPointer} onPointerLeave={resetDossierPointer}>
   {admin&&<Popover open={positionDraft?.id===v.id} onOpenChange={open=>{if(moving)return;if(open)editPosition(v);else setPositionDraft(null);}}>
    <PopoverTrigger asChild><button className="video-position-number video-position-button" type="button" disabled={moving} aria-label={`Изменить позицию ${v.name}, сейчас ${positions.get(v.id)}`} title="Изменить номер карточки"><span aria-hidden="true">#</span>{positions.get(v.id)}</button></PopoverTrigger>
    <PopoverContent className="admin-position-editor" side="top" align="start" aria-label={`Позиция ${v.name}`} onOpenAutoFocus={event=>{event.preventDefault();positionInputRef.current?.focus();positionInputRef.current?.select();}} onCloseAutoFocus={event=>{if(skipPositionFocusRestore.current)event.preventDefault();}} onInteractOutside={event=>{if(moving)event.preventDefault();}} onEscapeKeyDown={event=>{if(moving)event.preventDefault();}}>
     <form onSubmit={applyPosition} noValidate aria-busy={moving}>
      <label htmlFor={`video-position-${v.id}`}>Номер в текущем порядке</label>
      <p id={`video-position-hint-${v.id}`}>От 1 до {videos.length}, во всём архиве. Дата публикации сохранится.</p>
      <input ref={positionInputRef} id={`video-position-${v.id}`} type="number" inputMode="numeric" min={1} max={videos.length} step={1} value={positionValue} disabled={moving} aria-invalid={!!positionError} aria-describedby={`video-position-hint-${v.id}`} onChange={event=>{setPositionValue(event.target.value);setPositionError('');}}/>
      {positionError&&<p className="error" role="alert">{positionError}</p>}
      <div className="admin-position-editor-actions"><button type="button" className="secondary-btn" disabled={moving} onClick={()=>setPositionDraft(null)}>Отмена</button><button type="submit" className="primary-btn" disabled={moving}>{moving?'Сохраняем…':'Применить'}</button></div>
     </form>
    </PopoverContent>
   </Popover>}
   <div className="video-date"><time dateTime={v.publishedAt||undefined} title={v.publishedAt?new Date(v.publishedAt+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'}):'Дата неизвестна'}><span className="video-date-compact">{compactDate}</span><span className="video-date-full">{v.publishedAt?new Date(v.publishedAt+'T12:00:00').toLocaleDateString('ru-RU',{day:'2-digit',month:'short',year:'numeric'}):'—'}</span></time><small>{!v.publishedAt?'Дата неизвестна':v.dateSource==='manual'?'Указана куратором':v.platform==='Telegram'?'Дата поста':'Дата публикации'}</small></div>
   {playable?<button className="video-thumb" aria-label={'Открыть видео '+v.name} onClick={()=>setSelected(v)}>{cover}</button>:<a className="video-thumb" href={v.url} target="_blank" rel="noopener noreferrer" aria-label={'Открыть ссылку '+v.name+' в новой вкладке'}>{cover}</a>}
   <div className="video-copy">
    <a href={v.url} target="_blank" rel="noreferrer" className="video-platform" aria-label={`Открыть источник: ${v.name} · ${v.platform}`} title={`Открыть в ${v.platform}`}><span className="video-platform-full">{v.platform}</span><span className="video-platform-short" aria-hidden="true">{platformShortNames[v.platform]||v.platform.slice(0,2).toUpperCase()}</span><ArrowUpRight size={12} aria-hidden="true"/></a>
    <div className="video-name-screen"><h3><VideoName name={v.name} onOpen={()=>setSelected(v)} url={playable?undefined:v.url}/></h3></div>
   </div>
   <DossierInstruments id={v.id}/>
   {admin?<div className="video-actions"><button disabled={moving} aria-label={'Редактировать видео '+v.name} onClick={()=>edit(v)}><Pencil size={17}/></button><button disabled={moving} aria-label={'Удалить видео '+v.name} onClick={()=>setDeleting(v)}><Trash2 size={17}/></button></div>:showLocalAdmin&&<a className="card-edit video-card-edit" href={adminUrl+"/?edit="+encodeURIComponent(v.id)+"#videos"} aria-label={"Редактировать видео "+v.name} title="Редактировать материал"><Pencil size={16} aria-hidden="true"/></a>}
  </article>;
 }
 return <section className="video-section">
  <div className="video-heading"><div><div className="eyebrow">{admin?'КУРАТОРСКАЯ · УПРАВЛЕНИЕ ВИДЕО':'ПРИМЕНЕНИЕ ИИ · АРХИВ РАБОТ'}</div><h1>ИИ в творчестве<span>.</span></h1><p>{admin?'Добавляйте видео и публикации, редактируйте подписи и обложки карточек.':'Музыка, видео, визуальные работы и эксперименты с ИИ. Смотрите работы по возрастанию или убыванию порядка в архиве.'}</p></div>{admin&&<div className="video-admin-actions"><button className="primary-btn" onClick={()=>edit()}><Plus size={18}/>Добавить работу</button></div>}</div>
  <div className="video-toolbar">
   <label className="input-search" title="Поиск по автору или названию"><Search size={17}/><input aria-label="Поиск материалов" placeholder="Поиск работ…" value={q} onChange={e=>setQ(e.target.value)}/></label>
   <div className="video-toolbar-radios">
    <fieldset className="video-radio-group video-order-group"><legend className="sr-only">Порядок работ</legend><div>
     <span className="video-control-label" aria-hidden="true">ПОРЯДОК</span>
     <label title="Сначала новые добавления"><input type="radio" name="video-order" value="desc" aria-label="По убыванию" checked={order==='desc'} onChange={()=>setOrder('desc')}/><span><ArrowDownWideNarrow size={16} aria-hidden="true"/><b>По<br/>убыванию</b></span></label>
     <label title="Сначала ранние добавления"><input type="radio" name="video-order" value="asc" aria-label="По возрастанию" checked={order==='asc'} onChange={()=>setOrder('asc')}/><span><ArrowUpNarrowWide size={16} aria-hidden="true"/><b>По<br/>возрастанию</b></span></label>
    </div></fieldset>
    <fieldset className="video-radio-group video-view-group"><legend className="sr-only">ВИД</legend><div>
     <span className="video-control-label" aria-hidden="true">ВИД</span>
     <label title="Горизонтальная лента карточек"><input type="radio" name="video-orientation" value="horizontal" aria-label="Горизонтально" checked={orientation==='horizontal'} onChange={()=>setOrientation('horizontal')}/><span><GalleryHorizontal size={16} aria-hidden="true"/><b>Лента</b></span></label>
     <label title="Сетка работ"><input type="radio" name="video-orientation" value="vertical" aria-label="Сетка" checked={orientation==='vertical'} onChange={()=>setOrientation('vertical')}/><span><LayoutGrid size={16} aria-hidden="true"/><b>Сетка</b></span></label>
    </div></fieldset>
   </div>
  </div>
  <div className="video-summary">{filtered.length} материалов</div>{orientation==='horizontal'&&<p className="timeline-hint">Колесо мыши или перетягивание листает ленту · Ctrl/⌘ + колесо меняет масштаб <span aria-hidden="true">← листайте →</span></p>}
  {admin&&moveNotice&&<p className="notice" role="status">{moveNotice}</p>}
  {error&&<p role="alert" className="error">{error} <button onClick={load}>Повторить</button></p>}
  {loading?<p className="empty">Загружаем архив творческих работ…</p>:<div className={`timeline-layout timeline-layout--${orientation} timeline-layout--source`}>
   <div ref={timelineScene} className="timeline-scene" data-compact-labels={orientation==='horizontal'&&sceneZoom<.6?true:undefined} data-mini-cards={orientation==='horizontal'&&sceneZoom<.5?true:undefined} data-grid-compact-labels={orientation==='vertical'&&gridZoom<.8?true:undefined} style={orientation==='horizontal'?{
    '--timeline-zoom':sceneZoom,
    '--timeline-text-scale':Math.max(1,Math.min(2,1/sceneZoom)),
    '--timeline-card-width':`${160+zoomProgress*30}px`,
    '--timeline-stage-top':`${Math.round(52+zoomProgress*20)}px`,
    '--timeline-stage-bottom':`${Math.round(16+zoomProgress*16)}px`,
    '--timeline-stage-mobile-top':`${Math.round(64+zoomProgress*12)}px`,
   } as React.CSSProperties:{'--timeline-grid-zoom':gridZoom,'--timeline-grid-label-scale':Math.min(1.5,Math.max(1,1/gridZoom))} as React.CSSProperties}>
   {orientation==='horizontal'&&<canvas ref={timelineCanvas} className="timeline-runway" aria-hidden="true"/>}
   {orientation==='horizontal'&&<div className="timeline-scene-controls">
    <TimelineNavigator viewportRef={timelineViewport}/>
    <div className="timeline-zoom-controls timeline-control-panel"><label htmlFor="timeline-zoom">ЗУМ</label><button type="button" aria-label="Уменьшить масштаб" disabled={sceneZoom<=MIN_SCENE_ZOOM} onClick={()=>changeSceneZoom(-.1)}><ZoomOut size={18}/></button><input id="timeline-zoom" type="range" min={MIN_SCENE_ZOOM*100} max={MAX_SCENE_ZOOM*100} step="5" value={Math.round(sceneZoom*100)} onChange={event=>setSceneZoom(Number(event.target.value)/100)} aria-label="Масштаб видеоленты"/><button type="button" aria-label="Увеличить масштаб" disabled={sceneZoom>=MAX_SCENE_ZOOM} onClick={()=>changeSceneZoom(.1)}><ZoomIn size={18}/></button><output htmlFor="timeline-zoom" aria-live="polite">{Math.round(sceneZoom*100)}%</output></div>
   </div>}
   {orientation==='vertical'&&<div className="timeline-grid-controls"><div className="timeline-zoom-controls timeline-grid-zoom-controls timeline-control-panel">
    <label htmlFor="timeline-grid-zoom">ЗУМ</label>
    <button type="button" aria-label="Уменьшить карточки сетки" disabled={gridZoom<=MIN_GRID_ZOOM} onClick={()=>changeGridZoom(-.1)}><ZoomOut size={18}/></button>
    <input id="timeline-grid-zoom" type="range" min={MIN_GRID_ZOOM*100} max={MAX_GRID_ZOOM*100} step="10" value={Math.round(gridZoom*100)} onChange={event=>changeGridZoom(Number(event.target.value)/100-gridZoom)} aria-label="Масштаб сетки карточек"/>
    <button type="button" aria-label="Увеличить карточки сетки" disabled={gridZoom>=MAX_GRID_ZOOM} onClick={()=>changeGridZoom(.1)}><ZoomIn size={18}/></button>
    <button className="timeline-grid-zoom-reset" type="button" aria-label="Сбросить масштаб сетки до 100%" title="Вернуть 100%" onClick={()=>changeGridZoom(1-gridZoom)}>{Math.round(gridZoom*100)}%</button>
   </div></div>}
   <div ref={timelineViewport} className="timeline-content" aria-label={orientation==='horizontal'?'Горизонтальная видеолента':undefined} tabIndex={orientation==='horizontal'?0:undefined} onPointerDown={orientation==='horizontal'?startDrag:undefined} onPointerMove={orientation==='horizontal'?moveDrag:undefined} onPointerUp={orientation==='horizontal'?stopDrag:undefined} onPointerCancel={orientation==='horizontal'?stopDrag:undefined} onClickCapture={orientation==='horizontal'?event=>{if(suppressDragClick.current){event.preventDefault();event.stopPropagation();suppressDragClick.current=false;}}:undefined} onDragStart={orientation==='horizontal'?event=>event.preventDefault():undefined} onKeyDown={orientation==='horizontal'?event=>{if(event.key==='+'||event.key==='='){event.preventDefault();changeSceneZoom(.1);}else if(event.key==='-'){event.preventDefault();changeSceneZoom(-.1);}}:undefined}>
    <section className="timeline-year timeline-year--source"><h2>{order==='desc'?'По убыванию':'По возрастанию'}<sup>{ordered.length}</sup></h2>{orientation==='vertical'?<div ref={gridFrame} className="timeline-grid-frame"><div className="timeline-items">{ordered.map(card)}</div><TimelineGridFlow frameRef={gridFrame} layoutKey={`${gridZoom}:${ordered.map(video=>video.id).join(',')}`}/></div>:<div className="timeline-items">{ordered.map(card)}</div>}</section>
    {!filtered.length&&<p className="empty">Материалы не найдены. Измените поисковый запрос.</p>}
   </div>
   </div>
  </div>}
 <Dialog open={!!selected} onOpenChange={open=>{if(!open)setSelected(null);}}>{selected&&<VideoPlayer key={selected.id} video={selected}/>}</Dialog>
 <Dialog open={!!draft} onOpenChange={open=>{if(!open&&!busy)setDraft(null);}}>
  <DialogContent className="editor-dialog video-editor-dialog" onCloseAutoFocus={event=>{
   event.preventDefault();
   if(skipEditorFocusRestore.current)return;
   const point=editorReturn.current;if(!point)return;
   const focus=point.videoId?videoRefs.current.get(point.videoId)?.querySelector<HTMLButtonElement>('.video-actions button'):point.focus;
   if(focus?.isConnected)focus.focus({preventScroll:true});
   timelineViewport.current?.scrollTo({left:point.railX,top:point.railY,behavior:'instant'});
   window.scrollTo({left:point.pageX,top:point.pageY,behavior:'instant'});
  }}>
   <DialogTitle>{draft?.id?'Редактировать видео':'Добавить видео'}</DialogTitle>
   <DialogDescription>Работа появится в разделе «ИИ в творчестве» после сохранения.</DialogDescription>
   {draft&&<form className="artist-form video-editor-form" onSubmit={async event=>{
    event.preventDefault();
    const value=draftPosition.trim(),position=Number(value),total=videos.length+(draft.id?0:1);
    if(!/^\d+$/.test(value)||!Number.isInteger(position)||position<1||position>total){setFormError(`Укажите целый номер от 1 до ${total}.`);return;}
    const changedPosition=position!==Number(initialDraftPosition);
    setBusy(true);setFormError('');
    try{
     const result=await mutate({action:'video-save',video:draft,...(changedPosition?{position,reverseNumbering:order==='desc'}:{})});
     await load();
     skipEditorFocusRestore.current=changedPosition||!draft.id;
     setDraft(null);
     if(changedPosition||!draft.id){setRevealId(result.video.id);}
     if(changedPosition){setMoveNotice(`${result.video.name} — позиция ${position}.`);}
    }catch(error){setFormError((error as Error).message);}finally{setBusy(false);}
   }}>
    <label>Номер в списке<input aria-label="Номер в списке" aria-describedby="video-editor-position-hint" required type="number" inputMode="numeric" min={1} max={videos.length+(draft.id?0:1)} step={1} value={draftPosition} onChange={event=>setDraftPosition(event.target.value)}/></label>
    <p className="video-editor-position-hint" id="video-editor-position-hint">В порядке «{order==='desc'?'По убыванию':'По возрастанию'}», от 1 до {videos.length+(draft.id?0:1)}. Остальные карточки сдвинутся автоматически.</p>
    <label>Ссылка на видео или публикацию<input required type="url" value={draft.url} onChange={event=>{setImportMessage('');setDraft({...draft,url:event.target.value,publishedAt:'',dateSource:'unknown',dateUrl:'',videoId:'',isVideo:false,media:'',image:''});}}/></label>
    <button type="button" disabled={busy||!draft.url} className="secondary-btn metadata-import-btn" onClick={importDraft}>{busy?'Загрузка…':'Подгрузить данные и обложку из YouTube, VK, Telegram или Instagram'}</button>
    <label>Автор / название<input required maxLength={160} value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})}/></label>
    <label>Регион<select aria-label="Регион" value={draft.section||''} onChange={event=>setDraft({...draft,section:event.target.value as Video['section']})}><option value="">Не указан</option><option value="runet">Рунет</option><option value="world">Мир</option></select></label>
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
    {(formError||importMessage)&&<p className="notice" role="status">{formError||importMessage}</p>}
    <div className="form-actions"><button type="button" className="secondary-btn" onClick={()=>setDraft(null)} disabled={busy}>Отмена</button><button className="primary-btn" disabled={busy}>Сохранить работу</button></div>
   </form>}
  </DialogContent>
 </Dialog>
 <AlertDialog open={!!deleting} onOpenChange={open=>{if(!open&&!busy)setDeleting(null);}}><AlertDialogContent className="editor-dialog"><AlertDialogTitle>Удалить работу {deleting?.name}?</AlertDialogTitle><AlertDialogDescription>Работа исчезнет из архива.</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel disabled={busy}>Отмена</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={async e=>{e.preventDefault();setBusy(true);try{await mutate({action:'video-delete',id:deleting?.id});setDeleting(null);await load();}catch(e){setError((e as Error).message);setDeleting(null);}finally{setBusy(false);}}}>Удалить</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></section>;
}
