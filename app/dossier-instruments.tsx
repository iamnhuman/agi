import type {CSSProperties,PointerEvent} from 'react';
import {materialHash} from './card-material';

// Light positions 1, 4, 2, 6, 3, 7, 5 instead of sweeping left to right.
const receiverLightSteps=[0,2,4,1,6,3,5];

export function trackDossierPointer(event:PointerEvent<HTMLElement>){
 if(event.pointerType==='touch')return;
 const card=event.currentTarget,rect=card.getBoundingClientRect();
 if(!rect.width||!rect.height)return;
 const x=Math.max(-1,Math.min(1,(event.clientX-rect.left)/rect.width*2-1));
 const y=Math.max(-1,Math.min(1,(event.clientY-rect.top)/rect.height*2-1));
 card.style.setProperty('--target-x',`${(x*3).toFixed(2)}px`);
 card.style.setProperty('--target-y',`${(y*2).toFixed(2)}px`);
}

export function resetDossierPointer(event:PointerEvent<HTMLElement>){
 event.currentTarget.style.removeProperty('--target-x');
 event.currentTarget.style.removeProperty('--target-y');
}

export default function DossierInstruments({id,preview=false}:{id:string;preview?:boolean}){
 const matrix=materialHash(id);
 return <span className={`dossier-instruments${preview?' dossier-instruments--preview':''}`} aria-hidden="true">
  <span className="dossier-receiver">
   <svg className="dossier-signal-glyph" viewBox="0 0 12 16" fill="none"><path d="M1 8h2l2-5 2 10 2-5h2M1 1h3M8 15h3"/></svg>
   <span className="dossier-signal-screen"><span className="dossier-receiver-bars">
   {[3,5,8,10,8,5,3].map((height,index)=><i key={index} style={{'--signal-height':`${height}px`,'--signal-index':receiverLightSteps[index]} as CSSProperties}/>)}
   </span></span>
  </span>
  <span className="dossier-matrix">
   {Array.from({length:18},(_,index)=><i key={index} data-lit={(matrix>>>(index%24))&1} style={{'--signal-index':receiverLightSteps[index%7]} as CSSProperties}/>)}
  </span>
  <span className="dossier-target">
   <svg viewBox="0 0 38 22" fill="none" aria-hidden="true">
    <path className="dossier-target-scale" d="M12 3a10 10 0 0 1 14 0M12 19a10 10 0 0 0 14 0M19 1v3M19 18v3M7 11h3M28 11h3M12 5l2 2M24 15l2 2"/>
    <path className="dossier-target-jaw dossier-target-jaw--left" d="M7 4H3v5M3 13v5h4"/>
    <path className="dossier-target-jaw dossier-target-jaw--right" d="M31 4h4v5M35 13v5h-4"/>
    <g className="dossier-target-crosshair"><path d="M14 11h10M19 6v10"/><path d="m19 6 5 5-5 5-5-5z"/></g>
   </svg><span className="dossier-target-status"><i/><i/><i className="dossier-target-pilot"/></span>
  </span>
 </span>;
}
