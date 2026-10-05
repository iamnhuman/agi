'use client';
import {useEffect,useRef} from 'react';
import {ArrowUpRight,RotateCw} from 'lucide-react';
import AiConquerLogo from './ai-conquer-logo';
import {adminUrl,showLocalAdmin} from './config';

function CommandSignalPanel(){
 const panelRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const panel=panelRef.current;if(!panel)return;
  const bars=Array.from(panel.querySelectorAll<HTMLElement>('.command-signal i'));
  const rest=bars.map(bar=>parseFloat(getComputedStyle(bar).getPropertyValue('--signal-rest')));
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  let bounds=panel.getBoundingClientRect(),active=false,frame=0,last=0,amount=0;
  let scrollX=window.scrollX,scrollY=window.scrollY;
  let targetX=.5,targetY=.5,x=.5,y=.5;
  const reset=()=>{
   ['--signal-active','--signal-x','--signal-y','--signal-tilt-x','--signal-tilt-y','--signal-shift-x','--signal-shift-y'].forEach(name=>panel.style.removeProperty(name));
   bars.forEach(bar=>{bar.style.removeProperty('--signal-level');bar.style.removeProperty('--signal-heat');});
   delete panel.dataset.signalActive;
  };
  const paint=(now:number)=>{
   const ease=1-Math.exp(-Math.min(now-last||16,64)/70);last=now;
   x+=(targetX-x)*ease;y+=(targetY-y)*ease;amount+=((active?1:0)-amount)*ease;
   // Motion follows the pointer; the reduced setting keeps the response very shallow.
   const movement=amount*(motion.matches ? .25 : 1);
   panel.style.setProperty('--signal-active',amount.toFixed(3));
   panel.style.setProperty('--signal-x',`${(x*100).toFixed(2)}%`);
   panel.style.setProperty('--signal-y',`${(y*100).toFixed(2)}%`);
   panel.style.setProperty('--signal-tilt-x',`${((.5-y)*5*movement).toFixed(3)}deg`);
   panel.style.setProperty('--signal-tilt-y',`${((x-.5)*6*movement).toFixed(3)}deg`);
   panel.style.setProperty('--signal-shift-x',`${((x-.5)*5*movement).toFixed(3)}px`);
   panel.style.setProperty('--signal-shift-y',`${((y-.5)*4*movement).toFixed(3)}px`);
   bars.forEach((bar,index)=>{
    const distance=(index/(bars.length-1)-x)*3.8;
    const proximity=Math.exp(-(distance*distance));
    const wave=Math.sin(now*(motion.matches ? .0015 : .005)-index*.7)*.13;
    const peak=Math.max(.13,Math.min(.98,.24+proximity*.61+wave*(.4+proximity*.6)));
    const response=amount*(motion.matches ? .45 : 1);
    bar.style.setProperty('--signal-level',(rest[index]+(peak-rest[index])*response).toFixed(3));
    bar.style.setProperty('--signal-heat',((index===7?1:0)*(1-amount)+proximity*amount).toFixed(3));
   });
   if(active||amount>.002)frame=window.requestAnimationFrame(paint);
   else {frame=0;last=0;reset();}
  };
  const start=()=>{if(!frame)frame=window.requestAnimationFrame(paint);};
  const locate=(event:PointerEvent)=>{
   targetX=Math.max(0,Math.min(1,(event.clientX-bounds.left-scrollX+window.scrollX)/bounds.width));
   targetY=Math.max(0,Math.min(1,(event.clientY-bounds.top-scrollY+window.scrollY)/bounds.height));
  };
  const enter=(event:PointerEvent)=>{
   if(event.pointerType!=='mouse'&&event.pointerType!=='pen')return;
   bounds=panel.getBoundingClientRect();scrollX=window.scrollX;scrollY=window.scrollY;
   locate(event);active=true;
   panel.dataset.signalActive='true';start();
  };
  const move=(event:PointerEvent)=>{if(active)locate(event);};
  const leave=()=>{active=false;targetX=.5;targetY=.5;start();};
  const visibility=()=>{if(document.hidden)leave();};
  panel.addEventListener('pointerenter',enter);panel.addEventListener('pointermove',move);
  panel.addEventListener('pointerleave',leave);panel.addEventListener('pointercancel',leave);
  window.addEventListener('blur',leave);window.addEventListener('resize',leave);
  document.addEventListener('visibilitychange',visibility);
  return()=>{
   window.cancelAnimationFrame(frame);reset();
   panel.removeEventListener('pointerenter',enter);panel.removeEventListener('pointermove',move);
   panel.removeEventListener('pointerleave',leave);panel.removeEventListener('pointercancel',leave);
   window.removeEventListener('blur',leave);window.removeEventListener('resize',leave);
   document.removeEventListener('visibilitychange',visibility);
  };
 },[]);
 return <div ref={panelRef} className="command-console-head">
  <span>ГЛАВНОЕ МЕНЮ</span>
  <div className="command-signal" aria-hidden="true">{Array.from({length:15},(_,index)=><i key={index}/>)}</div>
 </div>;
}

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
     <span className="command-screen-subtitle">{videos?'ХРОНОЛОГИЯ ПРИМЕНЕНИЯ ИИ В КЛИПАХ И МЕДИА':'ИИШНИКИ · ПРОЕКТЫ · МЕДИА'}</span>
    </div>
    <div className="command-screen-readout"><span>● СИСТЕМА В СЕТИ</span><span>СЕКТОР 01 / ИИЗМ</span></div>
   </div>
   <div className="command-monitor-base" aria-hidden="true"/>
  </div>
  <aside className="command-console">
   <CommandSignalPanel/>
   <nav className="command-menu" aria-label="Разделы сайта">
    <a className={!videos?'is-active':''} aria-label="ИИ-артисты и медиа" aria-current={!videos?'page':undefined} href="#catalog">АРТИСТЫ И МЕДИА <ArrowUpRight size={15}/></a>
    <a className={videos?'is-active':''} aria-label="ИИ в творчестве" aria-current={videos?'page':undefined} href="#videos">ИИ В ТВОРЧЕСТВЕ <ArrowUpRight size={15}/></a>
    {showLocalAdmin&&<a href={adminUrl} aria-label="Кураторский штаб" className="command-menu-admin">КУРАТОРСКАЯ <ArrowUpRight size={15}/></a>}
   </nav>
   <div className="command-console-readout">
    <span className="command-console-readout-label"><span className="command-console-readout-title">{videos?'КАНАЛ / 02':'АРХИВ / 01'}</span><span className="command-console-update"><RotateCw size={12} aria-hidden="true"/>ОБНОВЛЕНИЕ</span></span>
    <div className="command-console-readout-main"><strong>{total??'LIVE'}</strong><span>{videos?'РАБОТ\nВ АРХИВЕ':'ДОСЬЕ\nВ БАЗЕ'}</span></div>
    <div className="command-console-readout-meter" aria-hidden="true"/>
    {videos?<small>МУЗЫКА · ВИДЕО · ВИЗУАЛЬНОЕ</small>:<small className="command-console-readout-note"><span>СОБРАНО ЧЕЛОВЕКОМ</span><span className="command-console-readout-divider"> / </span><span>СОЗДАНО С ИИ</span></small>}
   </div>
  </aside>
 </header>;
}
