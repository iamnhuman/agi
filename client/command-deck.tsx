import {ArrowUpRight} from 'lucide-react';
import AiConquerLogo from './ai-conquer-logo';
import {adminUrl,showLocalAdmin} from './config';

export default function CommandDeck({mode,total}:{mode:'catalog'|'videos';total?:number}){
 const videos=mode==='videos';
 return <header className="command-deck" aria-label="Главное меню архива">
  <div className="command-monitor">
   <div className="command-screen">
    <img className="command-map" src="./radar-world-red.webp" alt="" aria-hidden="true" fetchPriority="high"/>
    <div className="command-radar" aria-hidden="true"/>
    <div className="command-scan" aria-hidden="true"/>
    <div className="command-screen-content">
     <span className="command-kicker">AI CULTURE // ARCHIVE SYSTEM</span>
     <AiConquerLogo/>
     <strong>{videos?'ТВОРЧЕСКИЙ ИИ':'ОПЕРАЦИЯ: ВООБРАЖЕНИЕ'}</strong>
     <span className="command-screen-subtitle">{videos?'АРХИВ РАБОТ И ЭКСПЕРИМЕНТОВ':'ИИШНИКИ · ХУДОЖНИКИ · МЕДИА'}</span>
    </div>
    <div className="command-screen-readout"><span>● СИСТЕМА В СЕТИ</span><span>СЕКТОР 01 / ИИЗМ</span></div>
   </div>
   <div className="command-monitor-base" aria-hidden="true"/>
  </div>
  <aside className="command-console">
   <div className="command-console-head">
    <span>ГЛАВНОЕ МЕНЮ</span>
    <div className="command-signal" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div>
   </div>
   <nav className="command-menu" aria-label="Разделы сайта">
    <a className={!videos?'is-active':''} aria-label="ИИ-артисты и медиа" aria-current={!videos?'page':undefined} href="#catalog"><span>01</span> АРТИСТЫ И МЕДИА <ArrowUpRight size={15}/></a>
    <a className={videos?'is-active':''} aria-label="Творчество с ИИ" aria-current={videos?'page':undefined} href="#videos"><span>02</span> ТВОРЧЕСТВО С ИИ <ArrowUpRight size={15}/></a>
    {showLocalAdmin&&<a href={adminUrl} aria-label="Кураторский штаб" className="command-menu-admin"><span>03</span> КУРАТОРСКАЯ <ArrowUpRight size={15}/></a>}
   </nav>
   <div className="command-console-readout">
    <span className="command-console-readout-label">{videos?'КАНАЛ / 02':'АРХИВ / 01'} <span>● НА СВЯЗИ</span></span>
    <div className="command-console-readout-main"><strong>{total??'LIVE'}</strong><span>{videos?'РАБОТ\nВ АРХИВЕ':'ДОСЬЕ\nВ БАЗЕ'}</span></div>
    <div className="command-console-readout-meter" aria-hidden="true"/>
    <small>{videos?'МУЗЫКА · ВИДЕО · ВИЗУАЛЬНОЕ':'СОБРАНО ЧЕЛОВЕКОМ / СОЗДАНО С ИИ'}</small>
   </div>
  </aside>
 </header>;
}
