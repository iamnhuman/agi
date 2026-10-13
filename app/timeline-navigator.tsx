import {useEffect,useRef,useState,type CSSProperties,type RefObject} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';

// Keep scroll updates local: moving the rail should not render every video card.
export default function TimelineNavigator({viewportRef}:{viewportRef:RefObject<HTMLDivElement|null>}){
 const rangeRef=useRef<HTMLInputElement>(null);
 const [metrics,setMetrics]=useState({position:0,scrollable:false,thumb:20});
 useEffect(()=>{
  const viewport=viewportRef.current,range=rangeRef.current;
  if(!viewport||!range)return;
  let frame=0,active=true;
  const sync=()=>{
   frame=0;
   const maximum=Math.max(0,viewport.scrollWidth-viewport.clientWidth);
   const position=maximum?Math.round(Math.max(0,Math.min(1,viewport.scrollLeft/maximum))*1000):0;
   const thumb=Math.round(Math.max(20,Math.min(54,range.clientWidth*viewport.clientWidth/Math.max(1,viewport.scrollWidth))));
   setMetrics(previous=>previous.position===position&&previous.scrollable===(maximum>1)&&previous.thumb===thumb?previous:{position,scrollable:maximum>1,thumb});
  };
  const schedule=()=>{if(active&&!frame)frame=requestAnimationFrame(sync);};
  const observer=new ResizeObserver(schedule);
  observer.observe(viewport);observer.observe(range);
  const items=viewport.querySelector('.timeline-items');
  if(items)observer.observe(items);
  viewport.addEventListener('scroll',schedule,{passive:true});
  document.fonts.ready.then(schedule);sync();
  return()=>{active=false;observer.disconnect();viewport.removeEventListener('scroll',schedule);if(frame)cancelAnimationFrame(frame);};
 },[viewportRef]);
 const jump=(position:number)=>{
  const viewport=viewportRef.current;
  if(!viewport)return;
  const maximum=Math.max(0,viewport.scrollWidth-viewport.clientWidth);
  viewport.scrollTo({left:maximum*position/1000,behavior:'instant'});
  const actual=maximum?Math.round(viewport.scrollLeft/maximum*1000):0;
  setMetrics(previous=>previous.position===actual?previous:{...previous,position:actual});
 };
 const step=(direction:number)=>{
  const viewport=viewportRef.current;
  viewport?.scrollBy({left:direction*viewport.clientWidth*.85,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 };
 return <div className="timeline-navigation" style={{'--timeline-nav-thumb':`${metrics.thumb}px`} as CSSProperties}>
  <label htmlFor="timeline-position">ЛЕНТА</label>
  <button type="button" aria-label="Назад по линии времени" title="На экран назад" disabled={!metrics.scrollable||metrics.position===0} onClick={()=>step(-1)}><ChevronLeft size={16} aria-hidden="true"/></button>
  <input ref={rangeRef} id="timeline-position" type="range" min="0" max="1000" step="1" value={metrics.position} disabled={!metrics.scrollable} aria-label="Позиция на линии времени" aria-valuetext={`${Math.round(metrics.position/10)}% ленты`} title="Быстрый переход по ленте · Home — начало, End — конец" onChange={event=>jump(Number(event.target.value))}/>
  <button type="button" aria-label="Вперёд по линии времени" title="На экран вперёд" disabled={!metrics.scrollable||metrics.position===1000} onClick={()=>step(1)}><ChevronRight size={16} aria-hidden="true"/></button>
  <output htmlFor="timeline-position">{Math.round(metrics.position/10)}%</output>
 </div>;
}
