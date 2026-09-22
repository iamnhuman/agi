'use client';
import {useState,useEffect} from 'react';
import {catalogUrl,adminUrl,showLocalAdmin} from '@/client/config';
import ArtistMap from './artist-map';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {defaultSections,type Artist,type Section} from '@/lib/types';
import {ArrowUpRight, Search, Grid2X2, List, Network, Asterisk, ArrowRight, Pencil} from 'lucide-react';

export default function Atlas({initial}:{initial:Artist[]}){
const [data,setData]=useState(initial),[sections,setSections]=useState<Section[]>(defaultSections),[error,setError]=useState(''),[selected,setSelected]=useState<Artist|null>(null);
async function refresh(){try{const r=await fetch(catalogUrl,{cache:'no-store'});const d:any=await r.json();if(!r.ok)throw Error(d.error);setData(d.artists);setSections(d.sections);setError('');}catch{setError('Не удалось загрузить изменения. Пока показана исходная коллекция.');}}
useEffect(()=>{refresh();const onFocus=()=>refresh();window.addEventListener('focus',onFocus);return ()=>window.removeEventListener('focus',onFocus);},[]);
const [section,setSection]=useState('all'),[q,setQ]=useState(''),[view,setView]=useState('grid'),[kind,setKind]=useState('all');
const [columns,setColumns]=useState(5);
const [listSize,setListSize]=useState<'sm'|'md'|'lg'>('md');
useEffect(()=>{const saved=Number(window.localStorage.getItem('iizm-site-columns'));if([3,5,7].includes(saved))setColumns(saved);const savedList=window.localStorage.getItem('iizm-site-list-size');if(savedList==='sm'||savedList==='md'||savedList==='lg')setListSize(savedList);},[]);
function changeColumns(value:number){setColumns(value);window.localStorage.setItem('iizm-site-columns',String(value));}
function changeListSize(value:'sm'|'md'|'lg'){setListSize(value);window.localStorage.setItem('iizm-site-list-size',value);}
const artists=data.filter(a=>(section==='all'||a.section===section)&&(kind==='all'||(a.kind||'artist')===kind)&&(a.name+' '+a.tags+' '+a.description).toLowerCase().includes(q.toLowerCase()));
useEffect(()=>{const context=(document as any).modelContext;if(!context?.registerTool)return;const lifecycle=new AbortController();try{Promise.resolve(context.registerTool({name:'filter_artists',description:'Filter the visible artist catalog by name or section.',inputSchema:{type:'object',properties:{query:{type:'string'},section:{type:'string'},kind:{type:'string',enum:['all','artist','media','collective']}},additionalProperties:false},annotations:{readOnlyHint:true},execute(input:any){if(!input||typeof input!=='object'||input.query!==undefined&&typeof input.query!=='string'||input.section!==undefined&&!['all',...sections.map(s=>s.id)].includes(input.section))throw Error('Invalid filter');if(input.kind!==undefined&&!['all','artist','media','collective'].includes(input.kind))throw Error('Invalid kind');setKind(input.kind||'all');setQ(input.query||'');setSection(input.section||'all');return {count:data.filter(a=>(!input.section||input.section==='all'||a.section===input.section)&&(!input.kind||input.kind==='all'||(a.kind||'artist')===input.kind)&&(a.name+' '+a.tags+' '+a.description).toLowerCase().includes((input.query||'').toLowerCase())).length};}},{signal:lifecycle.signal})).catch(()=>{});}catch{}return ()=>lifecycle.abort();},[data,sections]);
return <>
<header className="topbar">
<a className="brand" href="./">
<Asterisk/>иизм<span>АРТИСТЫ И МЕДИА</span>
</a>
<a href="#videos" className="header-section-link">Видео</a>{showLocalAdmin&&<a href={adminUrl} className="admin-link curator-link">Кураторская <ArrowUpRight size={16}/>
</a>}</header>
<main>
<section className="intro">
<div>
<div className="eyebrow">
<i/> НЕЗАВИСИМЫЙ АРХИВ · AI ART</div>
<h1>За пределами<br/>
<em>воображения.</em>
</h1>
</div>
<div className="intro-aside">
<span className="big-count">{data.length}<sup>↗</sup>
</span>
<p>Артисты и медиа<br/>о новой природе искусства.</p>
<span className="small">Собрано человеком. Создано с ИИ.</span>
</div>
</section>
<section className="catalog">{error&&<p className="error" role="alert">{error} <button onClick={refresh}>Повторить</button>
</p>}<div className="catalog-head">
<div className="filters">{[['all','Все записи'],...sections.map(s=>[s.id,s.name])].map(([id,title])=>
<button key={id} className={section===id?'active':''} onClick={()=>setSection(id)}>{title}<sup>{id==='all'?data.length:data.filter(a=>a.section===id).length}</sup>
</button>)}</div>
<div className="catalog-view-controls">{view==='grid'&&<div className="catalog-density" role="group" aria-label="Количество карточек в ряд">
<span>В ряд</span>{[3,5,7].map(value=><button key={value} type="button" aria-label={`${value} карточек в ряд`} aria-pressed={columns===value} onClick={()=>changeColumns(value)}>{value}</button>)}
</div>}{view==='list'&&<div className="catalog-density" role="group" aria-label="Размер элементов списка">
{(['sm','md','lg'] as const).map(value=><button key={value} type="button" aria-label={`Размер списка ${value.toUpperCase()}`} aria-pressed={listSize===value} onClick={()=>changeListSize(value)}>{value.toUpperCase()}</button>)}
</div>}<div className="view-switch">{[[Grid2X2,'grid','Карточки'],[List,'list','Список'],[Network,'map','Карта']].map(([Icon,id,label]:any)=>
<button key={id} aria-label={label} className={view===id?'active':''} onClick={()=>setView(id)}>
<Icon size={18}/>
</button>)}</div></div>
</div>
<div className="search-row">
<label>
<Search size={17}/>
<input aria-label="Поиск записи" placeholder="Найти артиста или медиа…" value={q} onChange={e=>setQ(e.target.value)}/>
</label>
<div className="catalog-type-controls">
<Select value={kind} onValueChange={setKind}>
<SelectTrigger aria-label="Тип записей">
<SelectValue/>
</SelectTrigger>
<SelectContent>
<SelectItem value="all">Все типы</SelectItem>
<SelectItem value="artist">Артисты</SelectItem>
<SelectItem value="media">Медиа</SelectItem>
<SelectItem value="collective">Объединения</SelectItem>
</SelectContent>
</Select>
<span>{artists.length} ЗАПИСЕЙ <span className="muted">/ В КОЛЛЕКЦИИ</span>
</span>
</div>
</div>{view==='map'?<ArtistMap artists={artists} sections={sections} onSelect={setSelected}/>:<div className={view==='list'?'artist-list':'artist-grid'} data-columns={view==='grid'?columns:undefined} data-size={view==='list'?listSize:undefined}>{artists.map((a,i)=>
<article className="artist-card" data-rating={a.rating||'A'} key={a.id}>
<button onClick={()=>setSelected(a)} aria-label={"Подробнее: "+a.name} title={a.image?a.name:'Аватарка отсутствует'} className={'art art-'+i%8}>
<span className="art-index">{String(i+1).padStart(3,'0')}</span>
{(a.kind||'artist')!=='artist'&&<span className={`entry-kind entry-kind--artwork${a.kind==='collective'?' entry-kind--collective':''}`}>{a.kind==='collective'?'Объединение':'Медиа'}</span>}
<div className="missing-avatar" role="img" aria-label="Аватарка отсутствует">
<span aria-hidden="true">×</span>
</div>{a.image&&<img src={a.image} alt={a.name} loading="lazy" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.display="none";}}/>}<span className="art-badges">
<span className="art-caption country-tag">{a.section==='world'?'en':a.section==='runet'?'ru':sections.find(s=>s.id===a.section)?.name}</span>
<span className={`rating-tag rating-${(a.rating||'A').toLowerCase()}`}>{a.rating||'A'}</span>
</span>
<span className="art-arrow">
<ArrowUpRight size={20}/>
</span>
</button>
<div className="card-info">
<div>
<h2>
<button className="artist-name" title={a.name} onClick={()=>setSelected(a)}>{a.name}</button>
</h2><p>
<a className="artist-social" href={a.url} target="_blank" rel="noreferrer">{a.platform} <ArrowUpRight size={14}/>
</a>
</p>
</div>{showLocalAdmin&&<a className="card-edit" title="Редактировать" aria-label={"Редактировать "+a.name} href={adminUrl+"/?edit="+encodeURIComponent(a.id)+"#catalog"}><Pencil size={15}/></a>}</div>
</article>)}</div>}{!artists.length&&<p className="empty">Ничего не найдено. Попробуйте другое имя.</p>}</section>
</main>
<footer>
<span>иизм © 2026</span>
<p>Красный крест — аватарка отсутствует.</p>{showLocalAdmin&&<a href={adminUrl}>Продолжить коллекцию <ArrowRight size={16}/>
</a>}</footer>
<Dialog open={!!selected} onOpenChange={open=>{if(!open)setSelected(null);}}>
<DialogContent className="editor-dialog artist-detail">
<DialogTitle>{selected?.name}</DialogTitle>
<DialogDescription>{sections.find(s=>s.id===selected?.section)?.name} · {selected?.kind==='collective'?'Объединение':selected?.kind==='media'?'Медиа':'Артист'} · {selected?.platform}</DialogDescription>
<div className="detail-badges">
<span className="country-tag">{sections.find(s=>s.id===selected?.section)?.name}</span>
<span className={`rating-tag rating-${(selected?.rating||'A').toLowerCase()}`}>{selected?.rating||'A'}</span>
</div>{selected?.image&&<img src={selected.image} alt={selected.name} referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.display='none';}}/>}{selected?.description&&<p className="detail-description">{selected.description}</p>}{selected?.tags&&<div className="tag-list">{selected.tags.split(',').filter(Boolean).map((t,i)=>
<span key={i}>{t.trim()}</span>)}</div>}<a href={selected?.url} target="_blank" rel="noreferrer" className="primary-btn">Открыть {selected?.platform} <ArrowUpRight size={18}/>
</a>
</DialogContent>
</Dialog>
</>;
}
