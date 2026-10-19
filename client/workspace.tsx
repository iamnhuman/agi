import {useEffect,useState} from 'react';
import {ArrowUpRight} from 'lucide-react';
import AiConquerLogo from './ai-conquer-logo';
import CommandDeck from './command-deck';
import Atlas,{ToyotaFooter} from '@/app/atlas';
import Admin from '@/app/admin/panel';
import Videos from '@/app/videos';
import {adminUrl,siteUrl,showLocalAdmin,catalogUrl} from './config';
import {prepareWorkspace,type InitialCatalog} from './startup';
export default function Workspace({admin=false}:{admin?:boolean}){
 const [video,setVideo]=useState(()=>location.hash==='#videos'||location.hash.startsWith('#year-'));
 const [catalog,setCatalog]=useState<InitialCatalog|null>(null),[ready,setReady]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 const [videoTotal,setVideoTotal]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();let active=true;
  prepareWorkspace(admin?null:catalogUrl,document.fonts,fetch,controller.signal).then(current=>{
   if(!active)return;
   setCatalog(current);if(current)setVideoTotal(current.videos.length);setReady(true);
  }).catch(()=>{if(active)setError('Не удалось загрузить архив. Проверьте соединение и повторите попытку.');});
  return()=>{active=false;controller.abort();};
 },[admin,attempt,video]);
 useEffect(()=>{
  function change(){
   const hash=location.hash;
   const next=hash==='#videos'||hash.startsWith('#year-')?true:hash==='#catalog'||!hash?false:video;
   if(next===video)return;
   setReady(false);setError('');setVideo(next);
  }
  window.addEventListener('hashchange',change);return ()=>window.removeEventListener('hashchange',change);
 },[video]);
 if(error)return <div className="workspace-startup" role="alert"><p>{error}</p><button type="button" onClick={()=>{setError('');setAttempt(value=>value+1);}}>Повторить</button></div>;
 if(!ready)return <div className="workspace-startup" role="status">Загрузка архива…</div>;
 if(!video)return admin?<Admin/>:<Atlas initial={catalog!.artists} initialSections={catalog!.sections}/>;
 return <>{admin?<header className="topbar">
  <a className="brand" href="#catalog" aria-label="AI & CONQUER — ASI ALERT, главная"><AiConquerLogo/></a>
  <nav className="primary-nav" aria-label="Разделы сайта">
   <a href="#catalog" className="primary-nav-link">ИИ-артисты и медиа</a>
  <a href="#videos" className="primary-nav-link is-active" aria-current="page">Видео · ИИ в творчестве</a>
  </nav>
  <div className="header-actions">{(admin||showLocalAdmin)&&<a className="admin-link curator-link" href={(admin?siteUrl:adminUrl)+'/#videos'}>{admin?'На сайт':'Кураторский штаб'}<ArrowUpRight size={16}/></a>}</div>
 </header>:<CommandDeck mode="videos" total={videoTotal}/>}<main className="videos-main"><Videos admin={admin} initial={catalog?.videos} onTotalChange={setVideoTotal}/></main><ToyotaFooter homeHref={admin?siteUrl+'/#catalog':'#catalog'}/></>;
}
