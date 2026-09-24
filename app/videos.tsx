import {useEffect,useRef,useState} from 'react';
import {Plus,ArrowUpRight,Play,Pencil,Trash2,Search,ZoomIn,ZoomOut} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {AlertDialog,AlertDialogContent,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {catalogUrl,adminUrl,showLocalAdmin} from '@/client/config';
import {drawTimelineRunway} from './timeline-runway';
import type {Video} from '@/lib/types';
const blank:Video={id:'',name:'',url:'',platform:'',videoId:'',reference:false,title:'',publishedAt:'',dateSource:'unknown',dateUrl:'',image:'',description:'',alternateUrls:[],sourceOrder:0};
export default function Videos({admin=false}:{admin?:boolean}){
 const [videos,setVideos]=useState<Video[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[q,setQ]=useState(''),[order,setOrder]=useState('source'),[orientation,setOrientation]=useState<'vertical'|'horizontal'>('horizontal'),[draft,setDraft]=useState<Video|null>(null),[selected,setSelected]=useState<Video|null>(null),[deleting,setDeleting]=useState<Video|null>(null),[busy,setBusy]=useState(false),[formError,setFormError]=useState('');
 const [sceneZoom,setSceneZoom]=useState(.65);
 const timelineViewport=useRef<HTMLDivElement>(null),timelineCanvas=useRef<HTMLCanvasElement>(null);
 const drag=useRef<{pointerId:number;startX:number;scrollLeft:number;active:boolean}|null>(null);
 const suppressDragClick=useRef(false);
 const changeSceneZoom=(amount:number)=>setSceneZoom(current=>Math.round(Math.max(.65,Math.min(1.5,current+amount))*100)/100);
 async function load(){try{setError('');const r=await fetch(catalogUrl,{cache:'no-store'});if(!r.ok)throw Error('Не удалось загрузить видео.');const items=(await r.json()).videos||[];setVideos(items);if(admin){const editId=new URLSearchParams(location.search).get("edit");if(editId){const item=items.find((v:Video)=>v.id===editId);if(item)edit(item);const url=new URL(location.href);url.searchParams.delete("edit");history.replaceState(null,"",url);}}}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 useEffect(()=>{load();},[]);
 async function mutate(body:object){const r=await fetch('/api/catalog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error);return d;}
 const filtered=videos.filter(v=>(v.name+' '+v.title).toLowerCase().includes(q.toLowerCase()));
 const originalOrder=[...filtered].sort((a,b)=>a.sourceOrder-b.sourceOrder);
 const dated=filtered.filter(v=>v.publishedAt).sort((a,b)=>a.publishedAt.localeCompare(b.publishedAt)||a.sourceOrder-b.sourceOrder);
 const undated=filtered.filter(v=>!v.publishedAt).sort((a,b)=>a.sourceOrder-b.sourceOrder);
 const years=[...new Set(dated.map(v=>v.publishedAt.slice(0,4)))];
 useEffect(()=>{
  if(orientation!=='horizontal'||loading)return;
  const viewport=timelineViewport.current,canvas=timelineCanvas.current;
  if(!viewport||!canvas)return;
  let frame=0;
  const paint=()=>{
   frame=0;
   const cards=viewport.querySelector<HTMLElement>('.timeline-items');
   const firstCard=cards?.querySelector<HTMLElement>('.video-card');
   const cardMargin=firstCard?parseFloat(getComputedStyle(firstCard).marginBottom)||0:0;
   const railY=cards?cards.getBoundingClientRect().bottom-canvas.getBoundingClientRect().top-cardMargin+10:undefined;
   drawTimelineRunway(canvas,viewport.scrollLeft,railY);
  };
  const schedulePaint=()=>{if(!frame)frame=requestAnimationFrame(paint);};
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
  observer.observe(viewport);
  viewport.querySelectorAll('.timeline-items').forEach(items=>observer.observe(items));
  viewport.addEventListener('wheel',onWheel,{passive:false});
  viewport.addEventListener('scroll',schedulePaint,{passive:true});
  schedulePaint();
  return()=>{observer.disconnect();viewport.removeEventListener('wheel',onWheel);viewport.removeEventListener('scroll',schedulePaint);if(frame)cancelAnimationFrame(frame);};
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
 function edit(v?:Video){setDraft(v?{...v}:{...blank});setFormError('');}
 function card(v:Video){const [year,month,day]=v.publishedAt?.split('-')||[];const compactDate=year&&month&&day?`${day}.${month}.${year.slice(-2)}`:'БЕЗ ДАТЫ';return <article className="video-card" key={v.id}><div className="video-date">{order==='source'&&<span className="source-number">№ {v.sourceOrder+1}</span>}<time dateTime={v.publishedAt||undefined} title={v.publishedAt?new Date(v.publishedAt+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'}):'Дата неизвестна'}><span className="video-date-compact">{compactDate}</span><span className="video-date-full">{v.publishedAt?new Date(v.publishedAt+'T12:00:00').toLocaleDateString('ru-RU',{day:'2-digit',month:'short',...(order==='source'?{year:'numeric' as const}:{})}):'—'}</span></time><small>{!v.publishedAt?'Дата неизвестна':v.dateSource==='manual'?'Указана куратором':v.platform==='Telegram'?'Дата поста':'Дата публикации'}</small></div><button className="video-thumb" aria-label={'Открыть видео '+v.name} onClick={()=>setSelected(v)}><span className="video-placeholder"><Play size={24}/></span>{v.image&&<img src={v.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={e=>e.currentTarget.style.display='none'}/>}<span className="video-play"><Play size={18}/></span></button><div className="video-copy"><span className="video-platform">{v.platform}{v.reference?' · ссылка на источник':''}</span><h3><button onClick={()=>setSelected(v)}>{v.name}</button></h3>{v.title&&v.title!==v.name&&<p>{v.title}</p>}<a href={v.url} target="_blank" rel="noreferrer">Открыть источник <ArrowUpRight size={14}/></a></div>{!admin&&showLocalAdmin&&<a className="card-edit" href={adminUrl+"/?edit="+encodeURIComponent(v.id)+"#videos"} aria-label={"Редактировать видео "+v.name}><Pencil size={16} aria-hidden="true"/></a>}{admin&&<div className="video-actions"><button aria-label={'Редактировать видео '+v.name} onClick={()=>edit(v)}><Pencil size={17}/></button><button aria-label={'Удалить видео '+v.name} onClick={()=>setDeleting(v)}><Trash2 size={17}/></button></div>}</article>;}
 return <section className="video-section">
  <div className="video-heading"><div><div className="eyebrow">ТВОРЧЕСКИЙ ИИ · АРХИВ РАБОТ</div><h1>Творчество с ИИ<span>.</span></h1><p>Музыка, видео, визуальные работы и эксперименты с ИИ. Смотрите по дате публикации или времени добавления.</p></div>{admin&&<button className="primary-btn" onClick={()=>edit()}><Plus size={18}/>Добавить работу</button>}</div>
  <div className="video-toolbar">
   <label className="input-search"><Search size={17}/><input aria-label="Поиск материалов" placeholder="Поиск по автору, названию или платформе…" value={q} onChange={e=>setQ(e.target.value)}/></label>
   <div className="video-toolbar-radios">
    <fieldset className="video-radio-group"><legend>ПОРЯДОК</legend><div>
     <label><input type="radio" name="video-order" value="source" checked={order==='source'} onChange={()=>setOrder('source')}/><span>Добавление</span></label>
     <label><input type="radio" name="video-order" value="dates" checked={order==='dates'} onChange={()=>setOrder('dates')}/><span>По датам</span></label>
    </div></fieldset>
    <fieldset className="video-radio-group"><legend>ЛЕНТА</legend><div>
     <label><input type="radio" name="video-orientation" value="vertical" checked={orientation==='vertical'} onChange={()=>setOrientation('vertical')}/><span>Вертикально</span></label>
     <label><input type="radio" name="video-orientation" value="horizontal" checked={orientation==='horizontal'} onChange={()=>setOrientation('horizontal')}/><span>Горизонтально</span></label>
    </div></fieldset>
   </div>
  </div>
  <div className="video-summary">{filtered.length} материалов · {dated.length} с датой · {undated.length} без даты</div>{orientation==='horizontal'&&<p className="timeline-hint">Колесо мыши или перетягивание листает ленту · Ctrl/⌘ + колесо меняет масштаб <span aria-hidden="true">← листайте →</span></p>}
  {error&&<p role="alert" className="error">{error} <button onClick={load}>Повторить</button></p>}
  {loading?<p className="empty">Загружаем архив творческих работ…</p>:<div className={`timeline-layout timeline-layout--${orientation}${order==='source'?' timeline-layout--source':''}`}>
   {order!=='source'&&<nav className="timeline-years" aria-label="Годы таймлайна">{years.map(y=><a key={y} href={'#year-'+y}>{y}</a>)}{undated.length>0&&<a href="#year-unknown">Без даты <small>{undated.length}</small></a>}</nav>}
   <div className="timeline-scene" style={orientation==='horizontal'?{'--timeline-zoom':sceneZoom} as React.CSSProperties:undefined}>
   {orientation==='horizontal'&&<canvas ref={timelineCanvas} className="timeline-runway" aria-hidden="true"/>}
   {orientation==='horizontal'&&<div className="timeline-zoom-controls"><label htmlFor="timeline-zoom">ЗУМ</label><button type="button" aria-label="Уменьшить масштаб" disabled={sceneZoom<=.65} onClick={()=>changeSceneZoom(-.1)}><ZoomOut size={18}/></button><input id="timeline-zoom" type="range" min="65" max="150" step="5" value={Math.round(sceneZoom*100)} onChange={event=>setSceneZoom(Number(event.target.value)/100)} aria-label="Масштаб видеоленты"/><output htmlFor="timeline-zoom" aria-live="polite">{Math.round(sceneZoom*100)}%</output><button type="button" aria-label="Увеличить масштаб" disabled={sceneZoom>=1.5} onClick={()=>changeSceneZoom(.1)}><ZoomIn size={18}/></button></div>}
   <div ref={timelineViewport} className="timeline-content" aria-label={orientation==='horizontal'?'Горизонтальная видеолента':undefined} tabIndex={orientation==='horizontal'?0:undefined} onPointerDown={orientation==='horizontal'?startDrag:undefined} onPointerMove={orientation==='horizontal'?moveDrag:undefined} onPointerUp={orientation==='horizontal'?stopDrag:undefined} onPointerCancel={orientation==='horizontal'?stopDrag:undefined} onClickCapture={orientation==='horizontal'?event=>{if(suppressDragClick.current){event.preventDefault();event.stopPropagation();suppressDragClick.current=false;}}:undefined} onDragStart={orientation==='horizontal'?event=>event.preventDefault():undefined} onKeyDown={orientation==='horizontal'?event=>{if(event.key==='+'||event.key==='='){event.preventDefault();changeSceneZoom(.1);}else if(event.key==='-'){event.preventDefault();changeSceneZoom(-.1);}}:undefined}>
    {order==='source'?<section className="timeline-year timeline-year--source"><h2>Порядок добавления<sup>{originalOrder.length}</sup></h2><p className="undated-note">Работы расположены в порядке добавления, даже если дата публикации неизвестна.</p><div className="timeline-items">{originalOrder.map(card)}</div></section>:<>
     {years.map(y=><section id={'year-'+y} className="timeline-year" key={y}><h2>{y}<sup>{dated.filter(v=>v.publishedAt.startsWith(y)).length}</sup></h2><div className="timeline-items">{dated.filter(v=>v.publishedAt.startsWith(y)).map(card)}</div></section>)}
     {undated.length>0&&<section id="year-unknown" className="timeline-year"><h2>Дата не указана<sup>{undated.length}</sup></h2><p className="undated-note">Дата публикации неизвестна. Материалы расположены по времени добавления.</p><div className="timeline-items">{undated.map(card)}</div></section>}
    </>}
    {!filtered.length&&<p className="empty">Материалы не найдены. Измените поисковый запрос.</p>}
   </div>
   </div>
  </div>}
 <Dialog open={!!selected} onOpenChange={open=>{if(!open)setSelected(null);}}><DialogContent className="editor-dialog video-dialog"><DialogTitle>{selected?.name}</DialogTitle><DialogDescription>{selected?.title||selected?.platform}</DialogDescription>{selected?.videoId?<iframe title={selected.name} src={'https://www.youtube-nocookie.com/embed/'+selected.videoId} referrerPolicy="strict-origin-when-cross-origin" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen/>:<p>Встроенный просмотр недоступен. Откройте материал у источника.</p>}{selected?.reference&&<p className="notice">В архиве указан профиль или сайт, а не отдельная публикация.</p>}<a className="primary-btn" href={selected?.url} target="_blank" rel="noreferrer">Открыть источник · {selected?.platform}<ArrowUpRight size={17}/></a>{selected?.alternateUrls.map((url,i)=><a key={url} href={url} target="_blank" rel="noreferrer">Резервный источник {i+1} ↗</a>)}{selected?.description&&<p>{selected.description}</p>}</DialogContent></Dialog>
 <Dialog open={!!draft} onOpenChange={open=>{if(!open&&!busy)setDraft(null);}}><DialogContent className="editor-dialog"><DialogTitle>{draft?.id?'Редактировать работу':'Новая работа'}</DialogTitle><DialogDescription>Дата публикации задаёт положение в ленте. Если дата неизвестна, оставьте поле пустым.</DialogDescription>{draft&&<form className="artist-form" onSubmit={async e=>{e.preventDefault();setBusy(true);setFormError('');try{await mutate({action:'video-save',video:draft});setDraft(null);await load();}catch(e){setFormError((e as Error).message);}finally{setBusy(false);}}}><label>Ссылка на работу или публикацию<input required type="url" value={draft.url} onChange={e=>setDraft({...draft,url:e.target.value,publishedAt:'',dateSource:'unknown',dateUrl:'',videoId:'',image:'',title:''})}/></label><button type="button" disabled={busy||!draft.url} className="secondary-btn" onClick={async()=>{setBusy(true);setFormError('');try{const r=await fetch('/api/video-import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:draft.url})});const d=await r.json();if(!r.ok)throw Error(d.error);setDraft(v=>({...v!,...d,name:v!.name||d.title||''}));if(!d.publishedAt)setFormError('Дата не найдена. Её можно указать вручную или сохранить работу без даты.');}catch(e){setFormError((e as Error).message);}finally{setBusy(false);}}}>Получить название и дату</button><label>Автор / название<input required maxLength={160} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label>Дата публикации<input type="date" value={draft.publishedAt} onChange={e=>setDraft({...draft,publishedAt:e.target.value,dateSource:'manual',dateUrl:''})}/></label><label>Описание<textarea value={draft.description} maxLength={1500} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>{formError&&<p className="notice" role="status">{formError}</p>}<div className="form-actions"><button type="button" className="secondary-btn" onClick={()=>setDraft(null)} disabled={busy}>Отмена</button><button className="primary-btn" disabled={busy}>Сохранить работу</button></div></form>}</DialogContent></Dialog>
 <AlertDialog open={!!deleting} onOpenChange={open=>{if(!open&&!busy)setDeleting(null);}}><AlertDialogContent className="editor-dialog"><AlertDialogTitle>Удалить работу {deleting?.name}?</AlertDialogTitle><AlertDialogDescription>Работа исчезнет из архива.</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel disabled={busy}>Отмена</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={async e=>{e.preventDefault();setBusy(true);try{await mutate({action:'video-delete',id:deleting?.id});setDeleting(null);await load();}catch(e){setError((e as Error).message);setDeleting(null);}finally{setBusy(false);}}}>Удалить</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></section>;
}
