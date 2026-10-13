import {useEffect,useId,useState,type RefObject} from 'react';

type FlowPath={from:string;to:string;kind:'row'|'wrap'|'down';d:string};

// Measure the rendered cards, so zoom, filtering and tablet columns share one route.
export default function TimelineGridFlow({frameRef,layoutKey}:{frameRef:RefObject<HTMLDivElement|null>;layoutKey:string}){
 const marker='grid-flow-'+useId().replace(/:/g,'');
 const [drawing,setDrawing]=useState({width:0,height:0,paths:[] as FlowPath[]});
 useEffect(()=>{
  const frame=frameRef.current;
  if(!frame)return;
  let pending=0,active=true;
  const measure=()=>{
   pending=0;
   const bounds=frame.getBoundingClientRect();
   const cards=[...frame.querySelectorAll<HTMLElement>('.video-card')].map(card=>{
    const box=card.getBoundingClientRect();
    return {id:card.dataset.videoId||'',left:box.left-bounds.left,right:box.right-bounds.left,top:box.top-bounds.top,bottom:box.bottom-bounds.top,cx:box.left+box.width/2-bounds.left,cy:box.top+box.height/2-bounds.top};
   });
   const paths=cards.slice(0,-1).map((card,index):FlowPath=>{
    const next=cards[index+1];
    if(Math.abs(card.top-next.top)<2)return {from:card.id,to:next.id,kind:'row',d:`M${card.right+5} ${card.cy}H${next.left-5}`};
    if(Math.abs(card.left-next.left)<2)return {from:card.id,to:next.id,kind:'down',d:`M${card.cx} ${card.bottom+5}V${next.top-5}`};
    const turn=(card.bottom+next.top)/2,right=bounds.width+12,left=-12,r=5;
    return {from:card.id,to:next.id,kind:'wrap',d:`M${card.right+5} ${card.cy}H${right-r}Q${right} ${card.cy} ${right} ${card.cy+r}V${turn-r}Q${right} ${turn} ${right-r} ${turn}H${left+r}Q${left} ${turn} ${left} ${turn+r}V${next.cy-r}Q${left} ${next.cy} ${left+r} ${next.cy}H${next.left-5}`};
   });
   setDrawing(previous=>{
    const next={width:bounds.width,height:bounds.height,paths};
    return JSON.stringify(previous)===JSON.stringify(next)?previous:next;
   });
  };
  const schedule=()=>{if(active&&!pending)pending=requestAnimationFrame(measure);};
  const observer=new ResizeObserver(schedule);
  observer.observe(frame);
  frame.querySelectorAll('.timeline-items,.video-card').forEach(element=>observer.observe(element));
  document.fonts.ready.then(schedule);schedule();
  return()=>{active=false;observer.disconnect();if(pending)cancelAnimationFrame(pending);};
 },[frameRef,layoutKey]);
 if(!drawing.width||!drawing.paths.length)return null;
 return <svg className="timeline-grid-flow" viewBox={`0 0 ${drawing.width} ${drawing.height}`} aria-hidden="true">
  <defs><marker id={marker} viewBox="0 0 9 9" refX="7" refY="4.5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto"><path d="M1 1 7 4.5 1 8"/></marker></defs>
  <path className="timeline-grid-flow-shadow" d={drawing.paths.map(path=>path.d).join(' ')}/>
  {drawing.paths.map(path=><path key={path.from} d={path.d} data-flow-from={path.from} data-flow-to={path.to} data-flow-kind={path.kind} markerEnd={`url(#${marker})`}/>)}
 </svg>;
}
