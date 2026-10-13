import type {CSSProperties,PointerEvent} from 'react';
import {materialHash} from './card-material';

// Light positions 1, 4, 2, 6, 3, 7, 5 instead of sweeping left to right.
const receiverLightSteps=[0,2,4,1,6,3,5];
const instrumentVariants=['spectrum','waveform','scanner','dials'] as const;
const specialInstrumentVariants=['radar','cascade','phase'] as const;
type InstrumentVariant=typeof instrumentVariants[number]|typeof specialInstrumentVariants[number];
const instrumentLayouts=['signal-first','target-first','matrix-last'] as const;
const spectrumProfiles=[
 [3,5,8,10,8,5,3],[8,5,10,4,7,3,6],
 [3,8,5,10,6,9,4],[9,6,3,7,10,5,2],
];
const reticles=[
 {scale:'M12 3a10 10 0 0 1 14 0M12 19a10 10 0 0 0 14 0M19 1v3M19 18v3M7 11h3M28 11h3M12 5l2 2M24 15l2 2',center:'m19 6 5 5-5 5-5-5z'},
 {scale:'M11 3h16v16H11zM15 1v3M23 1v3M15 18v3M23 18v3M7 7h4M7 15h4M27 7h4M27 15h4',center:'M16 8h6v6h-6z'},
 {scale:'m19 1 10 5v10l-10 5-10-5V6zM19 1v4M19 17v4M9 6l4 2M25 14l4 2M9 16l4-2M25 8l4-2',center:'m19 7 4 7h-8z'},
 {scale:'M10 11a9 9 0 1 0 18 0 9 9 0 1 0-18 0M19 1v4M19 17v4M9 11h4M25 11h4M12 4l3 3M23 15l3 3',center:'M17 11a2 2 0 1 0 4 0 2 2 0 1 0-4 0'},
];
const specialReticles=[
 {scale:'M8 3h22M8 19h22M11 1v4M19 1v3M27 1v4M11 17v4M19 18v3M27 17v4M7 11h5M26 11h5',center:'M15 7h8v8h-8zM16 11h6'},
 {scale:'m19 1 3 4 5 1 1 5-1 5-5 1-3 4-3-4-5-1-1-5 1-5 5-1zM7 11h4M27 11h4',center:'M15 8h8l-4 7z'},
];

function lightStyle(index:number):CSSProperties{
 return {'--signal-index':receiverLightSteps[index%7]} as CSSProperties;
}

function ReceiverDisplay({variant,seed}:{variant:InstrumentVariant;seed:number}){
 if(variant==='radar')return <svg className="dossier-radar" viewBox="0 0 56 20" fill="none">
  <g className="dossier-radar-grid"><circle cx="12" cy="10" r="8"/><circle cx="12" cy="10" r="4"/><path d="M2 10h20M12 0v20M29 3h22M29 8h17M29 13h20M29 18h13M27 1v18"/></g>
  <path className="dossier-radar-sweep" d="M12 10V2l5 2" style={{'--radar-angle':`${seed%360}deg`} as CSSProperties}/>
  {receiverLightSteps.map((_,index)=>{
   const angle=index*Math.PI*2/7,radius=3+(seed>>>(index*3))%5;
   return <circle className="dossier-scope-trace" key={index} style={lightStyle(index)} cx={12+Math.cos(angle)*radius} cy={10+Math.sin(angle)*radius} r=".9"/>;
  })}
 </svg>;
 if(variant==='cascade')return <svg className="dossier-cascade" viewBox="0 0 56 18" fill="none">
  {receiverLightSteps.map((_,index)=>{
   const x=index*8+4,y=3+(seed>>>(index*3))%12;
   return <g key={index}><path className="dossier-cascade-track" d={`M${x} 1v16M${x-2} 1h4M${x-2} 17h4`}/><path className="dossier-scope-trace" style={lightStyle(index)} d={`M${x-3} ${y}h6m-3 -2v4`}/></g>;
  })}
 </svg>;
 if(variant==='phase')return <svg className="dossier-phase" viewBox="0 0 56 18" fill="none">
  <path className="dossier-phase-grid" d="M2 9h52M28 1v16M12 7v4M20 7v4M36 7v4M44 7v4M26 3h4M26 15h4"/>
  {receiverLightSteps.map((_,index)=>{
   const lobes=2+(seed&1),offset=(seed&1?Math.PI/2:0)+((seed>>>10)%3-1)*.15;
   const points=Array.from({length:13},(_,point)=>{
    const angle=(index+point/12)*Math.PI*2/7;
    return `${point?'L':'M'}${(28+23*Math.sin(angle)).toFixed(2)} ${(9+6*Math.sin(angle*lobes+offset)).toFixed(2)}`;
   }).join('');
   return <path className="dossier-scope-trace" key={index} d={points} style={lightStyle(index)}/>;
  })}
 </svg>;
 if(variant==='waveform')return <svg className="dossier-waveform" viewBox="0 0 56 14" fill="none">
  <path className="dossier-waveform-grid" d="M0 7h56M8 2v10M24 2v10M40 2v10M56 2v10"/>
  {receiverLightSteps.map((_,index)=>{
   const height=2+(seed>>>(index*3))%4;
   return <path className="dossier-scope-trace" key={index} style={lightStyle(index)} d={`M${index*8} 7h1l2 -${height} 2 ${height*2} 2 -${height}h1`}/>;
  })}
 </svg>;
 if(variant==='scanner')return <span className="dossier-scanner">
  {Array.from({length:3},(_,row)=><span className="dossier-scanner-lane" key={row}>
   {receiverLightSteps.map((_,index)=><i key={index} data-lit={index<2+(seed>>>(row*5))%6?1:0} style={lightStyle(index)}/>)}
  </span>)}
 </span>;
 if(variant==='dials')return <svg className="dossier-dials" viewBox="0 0 56 18" fill="none">
  {[14,42].map((center,dial)=><g key={center}>
   <path className="dossier-dial-case" d={`M${center-11} 15a11 11 0 0 1 22 0M${center-11} 15h22`}/>
   {receiverLightSteps.map((_,index)=>{
    const angle=Math.PI+index*Math.PI/6;
    return <path className="dossier-scope-trace" key={index} style={lightStyle(index)} d={`M${center+Math.cos(angle)*9} ${15+Math.sin(angle)*9}l${Math.cos(angle)*2} ${Math.sin(angle)*2}`}/>;
   })}
   <path className="dossier-dial-needle" d={`M${center-1} 15h2M${center} 15l0 -8`} transform={`rotate(${((seed>>>(dial*7))%80)-40} ${center} 15)`}/>
  </g>)}
 </svg>;
 return <span className="dossier-receiver-bars">
  {spectrumProfiles[(seed>>>8)%spectrumProfiles.length].map((height,index)=><i key={index} style={{...lightStyle(index),'--signal-height':`${height}px`} as CSSProperties}/>)}
 </span>;
}

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

export default function DossierInstruments({id,preview=false,registry=false}:{id:string;preview?:boolean;registry?:boolean}){
 const matrix=materialHash(id),seed=materialHash(id,0x83e1b769);
 // Keep the existing panels for two thirds of records; add rare hardware to the rest.
 const special=(seed>>>20)%3===0;
 const variant=special?specialInstrumentVariants[(seed>>>24)%specialInstrumentVariants.length]:instrumentVariants[seed%instrumentVariants.length];
 const layout=special&&(seed>>>18)%2===0?'matrix-first':instrumentLayouts[(seed>>>13)%instrumentLayouts.length];
 const reticle=special?specialReticles[(seed>>>5)%specialReticles.length]:reticles[(seed>>>5)%reticles.length];
 const matrixPanel=variant==='radar'?'orbit':variant==='cascade'?'ladder':variant==='phase'?'banks':'grid';
 return <span className={`dossier-instruments${preview?' dossier-instruments--preview':''}${registry?' dossier-instruments--registry':''}`} data-instrument={variant} data-instrument-layout={layout} data-instrument-panel={matrixPanel} aria-hidden="true">
  <span className="dossier-receiver">
   <svg className="dossier-signal-glyph" viewBox="0 0 12 16" fill="none"><path d="M1 8h2l2-5 2 10 2-5h2M1 1h3M8 15h3"/></svg>
   <span className="dossier-signal-screen"><ReceiverDisplay variant={variant} seed={seed}/></span>
  </span>
  <span className="dossier-matrix">
   {Array.from({length:18},(_,index)=><i key={index} data-lit={(matrix>>>(index%24))&1} style={{...lightStyle(index),'--lamp-angle':`${index*20}deg`} as CSSProperties}/>)}
  </span>
  <span className="dossier-target">
   <svg viewBox="0 0 38 22" fill="none" aria-hidden="true">
    <path className="dossier-target-scale" d={reticle.scale}/>
    <path className="dossier-target-jaw dossier-target-jaw--left" d="M7 4H3v5M3 13v5h4"/>
    <path className="dossier-target-jaw dossier-target-jaw--right" d="M31 4h4v5M35 13v5h-4"/>
    <g className="dossier-target-crosshair"><path d="M14 11h10M19 6v10"/><path d={reticle.center}/></g>
   </svg><span className="dossier-target-status"><i/><i/><i className="dossier-target-pilot"/></span>
  </span>
 </span>;
}
