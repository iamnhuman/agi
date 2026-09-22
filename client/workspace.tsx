import {useEffect,useState} from 'react';
import {Asterisk,ArrowLeft,ArrowUpRight} from 'lucide-react';
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
 return <><header className="topbar"><a className="brand" href="#catalog"><Asterisk/>иизм<span>ВИДЕОАРХИВ</span></a><div className="header-links"><a href="#catalog" className="admin-link"><ArrowLeft size={16}/>{admin?'Записи':'Каталог'}</a>{(admin||showLocalAdmin)&&<a className="admin-link" href={(admin?siteUrl:adminUrl)+'/#videos'}>{admin?'На сайт':'Кураторская'}<ArrowUpRight size={16}/></a>}</div></header><main className="videos-main"><Videos admin={admin}/></main></>;
}
