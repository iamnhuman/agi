'use client';
import {useState,useEffect,useRef,type PointerEvent,type CSSProperties} from 'react';
import {catalogUrl,adminUrl,showLocalAdmin} from '@/client/config';
import ArtistMap from './artist-map';
import {defaultSections,type Artist,type Section} from '@/lib/types';
import {ArrowUpRight, Search, Grid2X2, List, Network, Layers3, ArrowRight, Pencil, Radio, UsersRound, ZoomIn, ZoomOut} from 'lucide-react';
import CommandDeck from '@/client/command-deck';

const glitchGlyphs=['█','▓','▒','░','╳','╱','╲','┼','┆','║','◆','◇','△','▽','◉','※','×','+','=','/','\\','0','1','И','З','М'];
const glitchColumns=Array.from({length:21},(_,i)=>Array.from({length:28+(i*7)%14},(_,j)=>glitchGlyphs[(i*13+j*7+(j*j)%11)%glitchGlyphs.length]).join('\n'));
const zalgoAbove=['\u0300','\u0301','\u0302','\u0308','\u030b','\u030d','\u0310','\u033f','\u0342','\u0352'];
const zalgoBelow=['\u0316','\u0317','\u0318','\u0323','\u0324','\u0327','\u0330','\u0331','\u0347','\u0359'];
function mutateSignal(columns:string[]){return columns.map(column=>{const symbols=column.split('');for(let i=0;i<Math.max(2,Math.floor(symbols.length/8));i++){const offset=Math.floor(Math.random()*symbols.length);if(symbols[offset]!=='\n')symbols[offset]=glitchGlyphs[Math.floor(Math.random()*glitchGlyphs.length)];}return symbols.join('');});}
function zalgoSignal(tick:number,layer=0){return [...'СИГНАЛ ПОВРЕЖДЁН'].map((letter,index)=>{
  if(letter===' ')return ' ';
  const seed=tick*3+index*7+layer*11;
  const glyph=(seed%5===0||layer>0&&seed%3===0)?glitchGlyphs[seed%glitchGlyphs.length]:letter;
  return glyph+zalgoAbove[seed%zalgoAbove.length]+zalgoAbove[(seed+4)%zalgoAbove.length]+zalgoBelow[(seed+3)%zalgoBelow.length]+(seed%2?zalgoBelow[(seed+7)%zalgoBelow.length]:'')+(seed%4===0?'\u0338':'');
}).join('');}

export default function Atlas({initial}:{initial:Artist[]}){
const [data,setData]=useState(initial),[sections,setSections]=useState<Section[]>(defaultSections),[error,setError]=useState('');
async function refresh(){try{const r=await fetch(catalogUrl,{cache:'no-store'});const d:any=await r.json();if(!r.ok)throw Error(d.error);setData(d.artists);setSections(d.sections);setError('');}catch{setError('Связь с архивом потеряна. Показаны последние доступные досье.');}}
useEffect(()=>{refresh();const onFocus=()=>refresh();window.addEventListener('focus',onFocus);return ()=>window.removeEventListener('focus',onFocus);},[]);
const [section,setSection]=useState('all'),[q,setQ]=useState(''),[view,setView]=useState('grid'),[kind,setKind]=useState('all');
const [signalOpen,setSignalOpen]=useState(false);
const [signalColumns,setSignalColumns]=useState(glitchColumns),[signalTick,setSignalTick]=useState(0);
useEffect(()=>{if(!signalOpen)return;setSignalColumns(mutateSignal);const timer=window.setInterval(()=>{setSignalColumns(mutateSignal);setSignalTick(tick=>tick+1);},110);return()=>window.clearInterval(timer);},[signalOpen]);
const deckRef=useRef<HTMLDivElement|null>(null);
const [deckZoom,setDeckZoom]=useState(1);
const deckDrag=useRef<{pointerId:number;startX:number;scrollLeft:number;active:boolean}|null>(null);
const suppressDeckClick=useRef(false);
const changeDeckZoom=(step:number)=>setDeckZoom(current=>Math.round(Math.max(.65,Math.min(1.5,current+step))*100)/100);
useEffect(()=>{if(view!=='deck'||!deckRef.current)return;const deck=deckRef.current;const onWheel=(event:WheelEvent)=>{
 if(event.ctrlKey||event.metaKey){event.preventDefault();changeDeckZoom(event.deltaY<0?.1:-.1);return;}
 const axis=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;
 const unit=event.deltaMode===1?16:event.deltaMode===2?deck.clientWidth:1;
 const limit=deck.scrollWidth-deck.clientWidth;
 if(!axis||limit<=0)return;
 const next=Math.max(0,Math.min(limit,deck.scrollLeft+axis*unit));
 if(Math.abs(next-deck.scrollLeft)<.5)return;
 event.preventDefault();deck.scrollLeft=next;
};deck.addEventListener('wheel',onWheel,{passive:false});return ()=>deck.removeEventListener('wheel',onWheel);},[view]);
function startDeckDrag(event:PointerEvent<HTMLDivElement>){if(event.pointerType!=='mouse'||event.button!==0)return;deckDrag.current={pointerId:event.pointerId,startX:event.clientX,scrollLeft:event.currentTarget.scrollLeft,active:false};}
function moveDeckDrag(event:PointerEvent<HTMLDivElement>){const drag=deckDrag.current;if(!drag||drag.pointerId!==event.pointerId)return;if(!drag.active){if(Math.abs(event.clientX-drag.startX)<6)return;drag.active=true;event.currentTarget.setPointerCapture(event.pointerId);event.currentTarget.dataset.dragging='true';}event.preventDefault();event.currentTarget.scrollLeft=drag.scrollLeft+drag.startX-event.clientX;}
function stopDeckDrag(event:PointerEvent<HTMLDivElement>){const drag=deckDrag.current;if(!drag||drag.pointerId!==event.pointerId)return;if(drag.active){suppressDeckClick.current=true;delete event.currentTarget.dataset.dragging;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);requestAnimationFrame(()=>{suppressDeckClick.current=false;});}deckDrag.current=null;}
const [cardSize,setCardSize]=useState<'sm'|'md'|'lg'>('sm');
const [listSize,setListSize]=useState<'sm'|'md'|'lg'>('sm');
function changeView(next:string){if(next===view)return;setView(next);setCardSize('sm');setListSize('sm');}
const artists=data.filter(a=>(section==='all'||a.section===section)&&(kind==='all'||(a.kind||'artist')===kind)&&(a.name+' '+a.tags+' '+a.description).toLowerCase().includes(q.toLowerCase()));
useEffect(()=>{const context=(document as any).modelContext;if(!context?.registerTool)return;const lifecycle=new AbortController();try{Promise.resolve(context.registerTool({name:'filter_artists',description:'Filter the visible artist catalog by name or section.',inputSchema:{type:'object',properties:{query:{type:'string'},section:{type:'string'},kind:{type:'string',enum:['all','artist','media','collective']}},additionalProperties:false},annotations:{readOnlyHint:true},execute(input:any){if(!input||typeof input!=='object'||input.query!==undefined&&typeof input.query!=='string'||input.section!==undefined&&!['all',...sections.map(s=>s.id)].includes(input.section))throw Error('Invalid filter');if(input.kind!==undefined&&!['all','artist','media','collective'].includes(input.kind))throw Error('Invalid kind');setKind(input.kind||'all');setQ(input.query||'');setSection(input.section||'all');return {count:data.filter(a=>(!input.section||input.section==='all'||a.section===input.section)&&(!input.kind||input.kind==='all'||(a.kind||'artist')===input.kind)&&(a.name+' '+a.tags+' '+a.description).toLowerCase().includes((input.query||'').toLowerCase())).length};}},{signal:lifecycle.signal})).catch(()=>{});}catch{}return ()=>lifecycle.abort();},[data,sections]);
return <>
<CommandDeck mode="catalog" total={data.length}/>
<main>
<section className="catalog" id="catalog">{error&&<p className="error" role="alert">{error} <button onClick={refresh}>Восстановить связь</button>
</p>}<div className="catalog-head">
<div className="filters">{[['all','Все досье'],...sections.map(s=>[s.id,s.name])].map(([id,title])=>
<button key={id} className={section===id?'active':''} onClick={()=>setSection(id)}>{title}<sup>{id==='all'?data.length:data.filter(a=>a.section===id).length}</sup>
</button>)}</div>
<div className="catalog-view-controls">{view==='grid'&&<div className="catalog-density" role="group" aria-label="Размер карточек">
<span>Размер</span>{(['sm','md','lg'] as const).map(value=><button key={value} type="button" aria-label={`Размер карточек: ${value.toUpperCase()}`} aria-pressed={cardSize===value} onClick={()=>setCardSize(value)}>{value.toUpperCase()}</button>)}
</div>}{view==='list'&&<div className="catalog-density" role="group" aria-label="Размер элементов списка">
<span>Размер</span>{(['sm','md','lg'] as const).map(value=><button key={value} type="button" aria-label={`Размер списка ${value.toUpperCase()}`} aria-pressed={listSize===value} onClick={()=>setListSize(value)}>{value.toUpperCase()}</button>)}
</div>}<div className="view-switch">{[[Grid2X2,'grid','Карточки-досье'],[List,'list','Реестр'],[Network,'map','Тактическая карта'],[Layers3,'deck','Трёхмерная колода']].map(([Icon,id,label]:any)=>
<button key={id} aria-label={label} className={view===id?'active':''} onClick={()=>changeView(id)}>
<Icon size={18}/>
</button>)}</div></div>
</div>
<div className="search-row">
<label className="input-search">
<Search size={17}/>
<input aria-label="Поиск записи" placeholder="Поиск по досье: артист или медиа…" value={q} onChange={e=>setQ(e.target.value)}/>
</label>
<div className="catalog-type-controls">
<span className="catalog-result-count"><span className="catalog-result-number">{artists.length}</span> ДОСЬЕ <span className="muted">/ В БАЗЕ</span>
</span>
<div className="catalog-type-radios" role="radiogroup" aria-label="Тип записей">{[['all','Все'],['artist','Артисты'],['media','Медиа'],['collective','Гэнги']].map(([id,label])=><label key={id} className={kind===id?'is-active':''}><input type="radio" name="catalog-kind" value={id} checked={kind===id} onChange={()=>setKind(id)}/><span>{label}</span></label>)}</div>
</div>
</div>{view==='map'?<ArtistMap artists={artists} sections={sections}/>:<>{view==='deck'&&<div className="deck-toolbar"><span>КОЛОДА · колесо / перетягивание · Ctrl/⌘ + колесо — зум</span><div className="deck-zoom-controls" role="group" aria-label="Масштаб 3D-колоды"><label htmlFor="deck-zoom">ЗУМ</label><button type="button" aria-label="Уменьшить масштаб 3D-колоды" disabled={deckZoom<=.65} onClick={()=>changeDeckZoom(-.1)}><ZoomOut size={18}/></button><input id="deck-zoom" type="range" min="65" max="150" step="5" value={Math.round(deckZoom*100)} onChange={event=>setDeckZoom(Number(event.target.value)/100)} aria-label="Масштаб 3D-колоды"/><output htmlFor="deck-zoom" aria-live="polite">{Math.round(deckZoom*100)}%</output><button type="button" aria-label="Увеличить масштаб 3D-колоды" disabled={deckZoom>=1.5} onClick={()=>changeDeckZoom(.1)}><ZoomIn size={18}/></button></div></div>}<div ref={deckRef} className={view==='list'?'artist-list':view==='deck'?'artist-grid artist-deck':'artist-grid'} data-size={view==='grid'?cardSize:view==='list'?listSize:undefined} style={view==='deck'?{'--deck-zoom':deckZoom} as React.CSSProperties:undefined} aria-label={view==='deck'?'Горизонтальная 3D-колода досье':undefined} tabIndex={view==='deck'?0:undefined} onPointerDown={view==='deck'?startDeckDrag:undefined} onPointerMove={view==='deck'?moveDeckDrag:undefined} onPointerUp={view==='deck'?stopDeckDrag:undefined} onPointerCancel={view==='deck'?stopDeckDrag:undefined} onClickCapture={view==='deck'?event=>{if(suppressDeckClick.current){event.preventDefault();event.stopPropagation();suppressDeckClick.current=false;}}:undefined} onDragStart={view==='deck'?event=>event.preventDefault():undefined} onKeyDown={view==='deck'?event=>{if(event.key==='+'||event.key==='='){event.preventDefault();changeDeckZoom(.1);}else if(event.key==='-'){event.preventDefault();changeDeckZoom(-.1);}}:undefined}>{artists.map((a,i)=>
<article className="artist-card" data-rating={a.rating||'A'} data-kind={a.kind||'artist'} data-section={a.section} key={a.id}>
<a href={a.url} target="_blank" rel="noopener noreferrer" aria-label={"Открыть источник: "+a.name} className={'art art-'+i%8}>
<span className="art-index">{String(i+1).padStart(3,'0')}</span>
<div className="missing-avatar" role="img" aria-label="Аватарка отсутствует">
<span aria-hidden="true">×</span>
</div>{a.image&&<img src={a.image} alt={a.name} loading="lazy" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.display="none";}}/>}{a.kind==='collective'?<span className="record-type record-type--avatar"><UsersRound size={13} aria-hidden="true"/> Гэнг</span>:a.kind==='media'?<span className="record-type record-type--avatar"><Radio size={13} aria-hidden="true"/> Медиа</span>:null}<span className="art-badges">
<span className={`rating-tag rating-${(a.rating||'A').toLowerCase()}`}>{a.rating||'A'}</span>
</span>
</a>
<div className="card-info">
{(a.section==='world'||a.section==='runet')&&<img className="region-watermark" src={a.section==='world'?'./badges/region-en-eagle-cutout.png':'./badges/region-ru-emblem-cutout.png'} alt="" aria-hidden="true" loading="lazy" decoding="async"/>}
<div>
<h2>
<a className="artist-name" title={a.name} href={a.url} target="_blank" rel="noopener noreferrer">{a.name}</a>
</h2><p>
<a className="artist-social" href={a.url} target="_blank" rel="noreferrer">{a.platform} <ArrowUpRight size={14}/>
</a>
{a.kind==='collective'?<span className="list-kind-tag"><UsersRound size={11} aria-hidden="true"/>Гэнг</span>:a.kind==='media'?<span className="list-kind-tag"><Radio size={11} aria-hidden="true"/>Медиа</span>:null}
</p>
</div>{showLocalAdmin&&<a className="card-edit" title="Редактировать" aria-label={"Редактировать "+a.name} href={adminUrl+"/?edit="+encodeURIComponent(a.id)+"#catalog"}><Pencil size={15}/></a>}</div>
</article>)}</div></>}{!artists.length&&<p className="empty">Сигнал не обнаружен. Измените запрос или фильтр.</p>}</section>
</main>
<footer>
<span>иизм © 2026 · АРХИВ ИИ-СЦЕНЫ</span>
<div className="manifesto" data-open={signalOpen} onPointerLeave={event=>{if(event.pointerType==='mouse')setSignalOpen(false);}} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setSignalOpen(false);}}><div id="toyota-transmission" className="manifesto-transmission" aria-hidden={!signalOpen}><div className="manifesto-spires">{signalColumns.map((column,i)=><pre key={i} style={{'--column':i} as CSSProperties}>{column}</pre>)}</div><div className="manifesto-zalgo" aria-hidden="true"><span>{zalgoSignal(signalTick)}</span><span>{zalgoSignal(signalTick+3,1)}</span><span>{zalgoSignal(signalTick+7,2)}</span></div></div><button type="button" className="toyota-mark" aria-label="Toyota: показать сигнал" aria-controls="toyota-transmission" aria-expanded={signalOpen} onPointerEnter={event=>{if(event.pointerType==='mouse')setSignalOpen(true);}} onKeyDown={event=>{if(event.key==='Escape')setSignalOpen(false);}} onClick={()=>{if(window.matchMedia('(hover: none)').matches)setSignalOpen(open=>!open);else setSignalOpen(true);}}><svg viewBox="0 0 240 160" aria-hidden="true"><ellipse cx="120" cy="70" rx="106" ry="61"/><ellipse cx="120" cy="55" rx="56" ry="22"/><ellipse cx="120" cy="64" rx="27" ry="53"/></svg><span>TOYOTA</span></button></div>{showLocalAdmin&&<a href={adminUrl}>Войти в штаб <ArrowRight size={16}/>
</a>}</footer>
</>;
}
