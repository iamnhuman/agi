import {useEffect,useState} from 'react';
import {ArrowUpRight} from 'lucide-react';
import AiConquerLogo from './ai-conquer-logo';
import CommandDeck from './command-deck';
import Atlas from '@/app/atlas';
import Admin from '@/app/admin/panel';
import Videos from '@/app/videos';
import catalog from '@/data/catalog.json';
import {adminUrl,siteUrl,showLocalAdmin} from './config';
import type {Artist} from '@/lib/types';
export default function Workspace({admin=false}:{admin?:boolean}){
 const [video,setVideo]=useState(()=>location.hash==='#videos'||location.hash.startsWith('#year-'));
 useEffect(()=>{function change(){if(location.hash==='#videos')setVideo(true);else if(location.hash==='#catalog'||!location.hash)setVideo(false);}window.addEventListener('hashchange',change);return ()=>window.removeEventListener('hashchange',change);},[]);
 if(!video)return admin?<Admin/>:<Atlas initial={catalog.artists as Artist[]}/>;
 return <>{admin?<header className="topbar">
  <a className="brand" href="#catalog" aria-label="AI & CONQUER — ASI ALERT, главная"><AiConquerLogo/></a>
  <nav className="primary-nav" aria-label="Разделы сайта">
   <a href="#catalog" className="primary-nav-link">ИИ-артисты и медиа</a>
   <a href="#videos" className="primary-nav-link is-active" aria-current="page">Творчество с ИИ</a>
  </nav>
  <div className="header-actions">{(admin||showLocalAdmin)&&<a className="admin-link curator-link" href={(admin?siteUrl:adminUrl)+'/#videos'}>{admin?'На сайт':'Кураторский штаб'}<ArrowUpRight size={16}/></a>}</div>
 </header>:<CommandDeck mode="videos"/>}<main className="videos-main"><Videos admin={admin}/></main></>;
}
