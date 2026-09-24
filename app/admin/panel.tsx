'use client';
import {useEffect,useState,type CSSProperties} from 'react';
import {siteUrl} from '@/client/config';
import {Plus,Search,ArrowUpRight,Pencil,Trash2,Link2,LoaderCircle,RefreshCw,Radio,UsersRound} from 'lucide-react';
import AiConquerLogo from '@/client/ai-conquer-logo';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import type {Artist,ArtistRating,Section} from '@/lib/types';
const blank:Artist={kind:'artist',rating:'A',id:'',name:'',url:'',section:'world',platform:'Instagram',description:'',image:'',tags:''};
function completedProfileUrl(value:string){const input=value.trim(),username=input.replace(/^@/,'');if(/^[a-zA-Z0-9._]+$/.test(username))return `https://www.instagram.com/${username}`;if(/^(?:www\.)?(?:instagram\.com|t\.me|telegram\.me)(?=\/|[?#]|$)/i.test(input))return `https://${input}`;return input;}
function sizeFromImageUrl(src:string){const match=src.match(/[_-]s(\d+)x(\d+)(?:[_-]|$)/i);return match?`${match[1]} × ${match[2]}`:'';}
function ArtworkPreview({src,label,fresh=false}:{src:string;label:string;fresh?:boolean}){
 const [size,setSize]=useState(()=>sizeFromImageUrl(src));
 useEffect(()=>setSize(sizeFromImageUrl(src)),[src]);
 return <figure className={`artwork-preview${fresh?' artwork-preview--fresh':''}`}>
 <div>{src?<img src={src} alt={label} referrerPolicy="no-referrer" onLoad={e=>setSize(`${e.currentTarget.naturalWidth} × ${e.currentTarget.naturalHeight}`)} onError={()=>setSize('Не удалось открыть')}/>:<span>Нет изображения</span>}</div>
 <figcaption><strong>{label}</strong><span>{size||'Загрузка превью…'}</span></figcaption>
 </figure>;
}
export default function Admin(){
 const [columns,setColumns]=useState<number>(()=>{try{const saved=Number(localStorage.getItem('iizm-admin-columns'));return saved===7?6:saved===5?4:[1,3,4,6].includes(saved)?saved:6;}catch{return 6;}});
 function changeColumns(value:number){setColumns(value);try{localStorage.setItem('iizm-admin-columns',String(value));}catch{}}

 const [artists,setArtists]=useState<Artist[]>([]),[sections,setSections]=useState<Section[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[q,setQ]=useState('');
 const [groups,setGroups]=useState<string[]>([]),[kinds,setKinds]=useState<NonNullable<Artist['kind']>[]>([]);
 function toggleGroup(value:string){setGroups(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value]);}
 function toggleKind(value:NonNullable<Artist['kind']>){setKinds(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value]);}
 const [draft,setDraft]=useState<Artist|null>(null),[link,setLink]=useState(''),[busy,setBusy]=useState(false),[formError,setFormError]=useState(''),[importNote,setImportNote]=useState(''),[deleting,setDeleting]=useState<Artist|null>(null),[artworkBefore,setArtworkBefore]=useState('');
 async function load(){setLoading(true);setError('');try{const r=await fetch('/api/catalog');const d:any=await r.json();if(!r.ok)throw Error(d.error);setArtists(d.artists);setSections(d.sections);const editId=new URLSearchParams(location.search).get("edit");if(editId){const item=d.artists.find((a:Artist)=>a.id===editId);if(item)start(item);const url=new URL(location.href);url.searchParams.delete("edit");history.replaceState(null,"",url);}}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 useEffect(()=>{load();},[]);
 async function mutate(body:object){const r=await fetch('/api/catalog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d:any=await r.json();if(!r.ok)throw Error(d.error);return d;}
 function start(a?:Artist){setDraft(a?{...a,kind:a.kind||'artist',rating:(a.rating as string)==='CRINGE'?'A':a.rating||'A'}:{...blank,kind:kinds.length===1?kinds[0]:'artist',section:groups.length===1?groups[0]:'world'});setLink(a?.url||'');setArtworkBefore('');setFormError('');setImportNote('');}
 async function uploadArtwork(file:File){setFormError('');setImportNote('');if(file.size>50*1024*1024){setFormError('Файл должен быть не больше 50 МБ.');return;}const previous=draft?.image||'';setBusy(true);try{const r=await fetch('/api/avatar-upload',{method:'POST',headers:{'Content-Type':file.type},body:file});const d=await r.json();if(!r.ok)throw Error(d.error);setArtworkBefore(previous);setDraft(prev=>({...prev!,image:d.image}));setImportNote(`Обложка ${file.name} (${(file.size/1024/1024).toFixed(1)} МБ) загружена. Сохраните карточку.`);}catch(e){setFormError((e as Error).message);}finally{setBusy(false);}}
 async function downloadArtwork(){if(!draft?.image)return;const previous=draft.image;setBusy(true);setFormError('');try{const r=await fetch('/api/avatar-from-url',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:draft.image})});const d=await r.json();if(!r.ok)throw Error(d.error);setArtworkBefore(previous);setDraft(prev=>({...prev!,image:d.image}));setImportNote('Обложка скачана по ссылке и сохранена локально. Сохраните карточку.');}catch(e){setFormError((e as Error).message);}finally{setBusy(false);}}
 async function refreshArtwork(){if(!draft?.url)return;const previous=draft.image;setBusy(true);setFormError('');setImportNote('');try{const r=await fetch('/api/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:draft.url})});const d:any=await r.json();if(!r.ok)throw Error(d.error);if((d.profileAvatar||d.hdAvatar||d.artist?.platform==='Telegram')&&d.artist.image&&d.imageSavedLocally){setArtworkBefore(previous);setDraft(prev=>({...prev!,image:d.artist.image}));setImportNote(d.artist.platform==='Telegram'?'Аватарка Telegram найдена и сохранена локально. Проверьте новое превью и сохраните карточку.':d.hdAvatar&&d.avatarWidth?`Найдена настоящая HD-аватарка ${d.avatarWidth} × ${d.avatarHeight}. Сохраните карточку.`:d.avatarWidth?`Instagram подтвердил аватарку, но отдаёт её только ${d.avatarWidth} × ${d.avatarHeight}. Сохраните карточку, если она лучше текущей.`:'HD-аватарка профиля найдена и сохранена локально. Сохраните карточку.');}else if(d.imageNotice){setFormError(d.imageNotice);}else{setImportNote(`${d.artist?.platform||'Площадка'} не отдала доступную аватарку. Текущее фото оставлено без изменений.`);}}catch(e){setFormError((e as Error).message);}finally{setBusy(false);}}
 async function importLink(refresh=false){setBusy(true);setFormError('');setImportNote('');try{const source=refresh?draft?.url:completedProfileUrl(link);const r=await fetch('/api/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:source})});const d:any=await r.json();if(!r.ok)throw Error(d.error);if(!refresh)setLink(d.artist.url);setDraft(prev=>refresh?{...prev!,platform:d.artist.platform,...((d.metadataLoaded||d.artist.platform==='Instagram')&&d.artist.name?{name:d.artist.name}:{}),...(d.artist.description?{description:d.artist.description}:{}),...(d.artist.image&&(!prev?.image||!d.lowResolution)?{image:d.artist.image}:{})}:{...prev!,...d.artist});if(d.imageNotice&&!d.hdAvatar)setFormError(d.imageNotice);else setImportNote(d.hdAvatar&&d.imageSavedLocally?'HD-аватарка профиля найдена и сохранена локально. Проверьте карточку перед сохранением.':d.imageSavedLocally?'Обложка найдена и сохранена локально. Проверьте карточку перед сохранением.':d.lowResolution?"Instagram отдал только уменьшенную аватарку. Можно загрузить файл вручную.":refresh?d.metadataLoaded?"Доступные данные обновлены. Проверьте их и сохраните карточку. Поля без новых данных оставлены без изменений.":"Площадка не отдала данные аккаунта. Существующие поля сохранены.":d.notice);}catch(e){setFormError((e as Error).message);}finally{setBusy(false);}}
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setFormError('');try{const expectedRating=draft?.rating||'A';const artist=draft?{...draft,url:completedProfileUrl(draft.url)}:draft;const d=await mutate({action:'save',artist});if(d.artist.rating!==expectedRating)throw Error('Сервер не применил тег рейтинга. Перезапустите локальный сайт и повторите сохранение.');setArtists(prev=>prev.some(a=>a.id===d.artist.id)?prev.map(a=>a.id===d.artist.id?d.artist:a):[d.artist,...prev]);setDraft(null);setNotice(`Карточка сохранена с тегом ${d.artist.rating}.`);}catch(e){setFormError((e as Error).message);}finally{setBusy(false);}}
 const filtered=artists.filter(a=>(groups.length===0||groups.includes(a.section))&&(kinds.length===0||kinds.includes(a.kind||'artist'))&&(a.name+' '+a.url+' '+a.tags).toLowerCase().includes(q.toLowerCase()));
 return <>
<header className="topbar">
<a className="brand" href={siteUrl} aria-label="AI & CONQUER — ASI ALERT, главная"><AiConquerLogo/></a>
<nav className="primary-nav" aria-label="Разделы сайта">
<a href={siteUrl+'/#catalog'} className="primary-nav-link">ИИ-артисты и медиа</a>
<a href={siteUrl+'/#videos'} className="primary-nav-link">Видеоразведка</a>
</nav>
<div className="header-actions"><span className="admin-link curator-link is-current" aria-current="page">Кураторский штаб</span></div>
</header>
<main className={`admin-main${columns===1?'':' admin-main--grid'}`}>
<div className="admin-heading">
<div>
<div className="eyebrow">ВАША КОЛЛЕКЦИЯ</div>
<h1>Кураторская<span>.</span>
</h1>
<p>Изменения сохраняются локально и сразу появляются на сайте.</p>
<div className="collection-count"><strong>{artists.length}</strong><span>записей в коллекции</span></div>
</div>
<button className="primary-btn" onClick={()=>start()}>
<Plus size={18}/> Добавить запись</button>
</div>{notice&&<p className="notice" role="status">{notice}</p>}{error&&<div className="error" role="alert">{error} <button onClick={load}>Повторить</button>
</div>}<div className="admin-tools">
<label className="input-search">
<Search size={17}/>
<input aria-label="Поиск записи" placeholder="Имя, ссылка или тег…" value={q} onChange={e=>setQ(e.target.value)}/>
</label>
<div className="admin-view-controls">
<div className="density-switch" role="group" aria-label="Размер карточек">
{[{value:1,label:'Список',aria:'Список'},{value:6,label:'SM',aria:'Мелкие карточки'},{value:4,label:'MD',aria:'Карточки среднего размера'},{value:3,label:'LG',aria:'Крупные карточки'}].map(option=>
<button key={option.value} type="button" aria-pressed={columns===option.value} aria-label={option.aria} onClick={()=>changeColumns(option.value)}>{option.label}</button>)}
</div>
<fieldset className="admin-filter-set" aria-label="Тип записей">
<label><input type="checkbox" checked={kinds.length===0} onChange={()=>setKinds([])}/><span>Все типы</span></label>
{([['artist','Артисты'],['media','Медиа'],['collective','Проекты']] as const).map(([value,label])=><label key={value}><input type="checkbox" checked={kinds.includes(value)} onChange={()=>toggleKind(value)}/><span>{label}</span></label>)}
</fieldset>
<fieldset className="admin-filter-set" aria-label="География">
<label><input type="checkbox" checked={groups.length===0} onChange={()=>setGroups([])}/><span>Вся география</span></label>
{sections.map(section=><label key={section.id}><input type="checkbox" checked={groups.includes(section.id)} onChange={()=>toggleGroup(section.id)}/><span>{section.name}</span></label>)}
</fieldset>
</div>
</div>
<div className={`admin-rows${columns===1?'':' admin-grid'}`} data-artwork="full" data-columns={columns} style={{'--admin-columns':columns} as CSSProperties}>{loading?<p className="empty">Загружаем коллекцию…</p>:filtered.map((a,i)=>
<div className="admin-row" data-rating={a.rating||'A'} data-kind={a.kind||'artist'} data-section={a.section} key={a.id}>
<span className="row-number row-number--list">{String(i+1).padStart(3,'0')}</span>
<div className={'mini-art art-'+i%8}>
<span className="row-number row-number--art">{String(i+1).padStart(3,'0')}</span>
<div className="missing-avatar" role="img" aria-label="Аватарка отсутствует">
<span aria-hidden="true">×</span>
</div>{a.image&&<img src={a.image} alt={a.name} loading="lazy" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.display='none';}}/>}{a.kind==='collective'?<span className="record-type record-type--avatar"><UsersRound size={13} aria-hidden="true"/> Проект</span>:a.kind==='media'?<span className="record-type record-type--avatar"><Radio size={13} aria-hidden="true"/> Медиа</span>:null}<span className="art-badges"><span className={`rating-tag rating-${(a.rating||'A').toLowerCase()}`}>{a.rating||'A'}</span></span></div>
<div className="row-name">
{(a.section==='world'||a.section==='runet')&&<img className="region-watermark" src={a.section==='world'?'./badges/region-en-eagle-cutout.png':'./badges/region-ru-emblem-cutout.png'} alt="" aria-hidden="true" loading="lazy" decoding="async"/>}
<strong title={a.name}>{a.name}</strong>
<div className="row-secondary"><a href={a.url} target="_blank" rel="noreferrer">{a.platform} <ArrowUpRight size={12}/>
</a>
</div>
</div>
<div className="admin-card-footer">
<div className="admin-tags">
<span className={`rating-tag rating-${(a.rating||'A').toLowerCase()}`}>{a.rating||'A'}</span>
</div>
<div className="admin-card-actions">
<button aria-label={'Редактировать '+a.name} onClick={()=>start(a)}>
<Pencil size={17}/>
</button>
<button aria-label={'Удалить '+a.name} onClick={()=>setDeleting(a)}>
<Trash2 size={17}/>
</button>
</div>
</div>
</div>)}{!loading&&!filtered.length&&!error&&<p className="empty">Нет записей по этому запросу.</p>}</div>
</main>
 <Dialog open={!!draft} onOpenChange={open=>{if(!open&&!busy)setDraft(null);}}>
<DialogContent className="editor-dialog">
<DialogTitle>{draft?.id?'Редактировать запись':'Новая запись'}</DialogTitle>
<DialogDescription>Вставьте ссылку на Instagram или Telegram — начнём с неё.</DialogDescription>{draft?.id&&<button type="button" className="secondary-btn" onClick={()=>importLink(true)} disabled={busy||!draft.url.trim()} aria-label="refresh — обновить данные аккаунта">{busy?<LoaderCircle className="spin" size={16}/>:null} {busy?"Сканирование…":"refresh"}</button>}<div className="import-box">
<label htmlFor="import-link">
<Link2 size={15}/> Ссылка на профиль или пост</label>
<div>
<input id="import-link" type="text" inputMode="url" value={link} placeholder="ник, t.me/name или instagram.com/name" onChange={e=>{const value=e.target.value;setLink(value);if(!draft?.id)setDraft(prev=>({...prev!,url:completedProfileUrl(value)}));}} onBlur={()=>{const url=completedProfileUrl(link);setLink(url);if(!draft?.id)setDraft(prev=>({...prev!,url}));}} disabled={busy}/>
<button type="button" className="primary-btn" onClick={()=>importLink()} disabled={busy||!link.trim()}>{busy?<LoaderCircle className="spin" size={18}/>:'Заполнить'}</button>
</div>
</div>{importNote&&<p className="notice" role="status">{importNote}</p>}{draft&&<form onSubmit={save} className="artist-form">
<label>Тип записи<Select value={draft.kind||'artist'} onValueChange={kind=>setDraft({...draft,kind:kind as Artist['kind']})}>
<SelectTrigger aria-label="Тип записи">
<SelectValue/>
</SelectTrigger>
<SelectContent>
<SelectItem value="artist">Артист</SelectItem>
<SelectItem value="media">Медиа</SelectItem>
<SelectItem value="collective">Проект</SelectItem>
</SelectContent>
</Select>
</label>
<div className="form-pair">
<label>Имя / название<input required maxLength={120} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/>
</label>
<label>География<Select value={draft.section} onValueChange={section=>setDraft({...draft,section})}>
<SelectTrigger>
<SelectValue/>
</SelectTrigger>
<SelectContent>{sections.map(s=>
<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
</Select>
</label>
</div>
<fieldset className="rating-options">
<legend>Тег рейтинга</legend>
<div>{(['A','AA','AAA','AAA+'] as ArtistRating[]).map(r=>
<label key={r} className={`rating-option rating-${r.toLowerCase()}`}>
<input type="radio" name="rating" value={r} checked={(draft.rating||'A')===r} onChange={()=>setDraft({...draft,rating:r})}/>
<span>{r}</span>
</label>)}</div>
</fieldset>
<label>Ссылка карточки<input required type="text" inputMode="url" placeholder="t.me/name или instagram.com/name" value={draft.url} onChange={e=>setDraft({...draft,url:e.target.value})} onBlur={e=>setDraft({...draft,url:completedProfileUrl(e.currentTarget.value)})}/>
</label>
<div className="artwork-field">
<label>Обложка <span className="optional">· ссылка, HTML или локальный файл до 50 МБ</span>
<input type="text" placeholder="https://…" value={draft.image} onChange={e=>{const value=e.target.value;const match=value.match(/<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/i);setArtworkBefore('');setDraft({...draft,image:(match?match[2]:value).replace(/&amp;/g,'&')});}}/>
</label>
{draft.image&&<div className={`artwork-preview-row${artworkBefore?' artwork-preview-row--compare':''}`}>
{artworkBefore&&<ArtworkPreview src={artworkBefore} label="Было"/>}<ArtworkPreview src={draft.image} label={artworkBefore?'Новая обложка':'Превью обложки'} fresh={!!artworkBefore}/>
</div>}
<div className="artwork-actions">
<label className="secondary-btn artwork-upload">{busy?'Загрузка…':'Загрузить файл'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)uploadArtwork(file);e.currentTarget.value='';}}/>
</label>
<button type="button" className="secondary-btn artwork-refresh" disabled={busy||!draft.url.trim()} onClick={refreshArtwork}>{busy?<LoaderCircle className="spin" size={16}/>:<RefreshCw size={16}/>} Улучшить фото</button>
<button type="button" className="secondary-btn" disabled={busy||!draft.image.startsWith('https://')} onClick={downloadArtwork}>Скачать по ссылке</button>
</div>
</div>
{formError&&<p className="error" role="alert">{formError}</p>}<div className="form-actions">
<button className="secondary-btn" type="button" disabled={busy} onClick={()=>setDraft(null)}>Отмена</button>
<button className="primary-btn" disabled={busy} type="submit">{busy?'Подождите…':'Сохранить карточку'} <ArrowUpRight size={17}/>
</button>
</div>
</form>}</DialogContent>
</Dialog>
 <AlertDialog open={!!deleting} onOpenChange={open=>{if(!open&&!busy)setDeleting(null);}}>
<AlertDialogContent className="editor-dialog">
<AlertDialogHeader>
<AlertDialogTitle>Удалить {deleting?.name}?</AlertDialogTitle>
<AlertDialogDescription>Карточка исчезнет из каталога. При необходимости её можно добавить снова по ссылке.</AlertDialogDescription>
</AlertDialogHeader>
<AlertDialogFooter>
<AlertDialogCancel disabled={busy}>Отмена</AlertDialogCancel>
<AlertDialogAction disabled={busy} onClick={async e=>{e.preventDefault();setBusy(true);try{await mutate({action:'delete',id:deleting?.id});setArtists(p=>p.filter(a=>a.id!==deleting?.id));setDeleting(null);setNotice('Карточка удалена.');}catch(e){setError((e as Error).message);setDeleting(null);}finally{setBusy(false);}}}>Удалить</AlertDialogAction>
</AlertDialogFooter>
</AlertDialogContent>
</AlertDialog>
</>;
}
