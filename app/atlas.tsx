'use client';
import {Fragment,useState,useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {catalogUrl,adminUrl,showLocalAdmin} from '@/client/config';
import ArtistMap from './artist-map';
import ArtistCanvasDeck from './artist-canvas-deck';
import {defaultSections,type Artist,type Section} from '@/lib/types';
import {matchesArtistSearch} from '@/lib/artist-search';
import {ArrowUpRight, Search, Grid2X2, List, Network, Layers3, Pencil, Radio, UsersRound, Shuffle, ListOrdered, RotateCcw, Type, Menu, X} from 'lucide-react';
import SignalRain from './signal-rain';
import {paintSignalScanlines,signalHash,signalRasterScale} from './signal-screen';
import {resolveClientIp,type ClientIpStatus} from './client-signal';
import CommandDeck from '@/client/command-deck';

const cuneiformGlyphs=[
  ...Array.from({length:96},(_,index)=>String.fromCodePoint(0x12000+index)),
  ...Array.from({length:24},(_,index)=>String.fromCodePoint(0x12400+index)),
];
const signalHeadline=Array.from('信号が破損しました');
function drawPixelBubble(canvas:HTMLCanvasElement,frame=0,reducedMotion=false){
 const context=canvas.getContext('2d');if(!context)return;
 context.clearRect(0,0,canvas.width,canvas.height);
 context.save();context.scale(canvas.width/300,canvas.height/72);
 const outline:[number,number][]=[
  [11,4],[289,4],[296,11],[296,49],[289,56],[159,56],
  [150,65],[141,56],[11,56],[4,49],[4,11],
 ];
 const trace=()=>{context.beginPath();outline.forEach(([x,y],index)=>index?context.lineTo(x,y):context.moveTo(x,y));context.closePath();};
 context.save();context.translate(0,2);trace();context.fillStyle='#380c18';context.fill();context.restore();
 trace();context.fillStyle='#0d1219';context.strokeStyle='#c85b6e';context.lineWidth=2;context.lineJoin='miter';context.fill();context.stroke();
 // A tiny recessed signal monitor replaces the flat status stripe.
 context.beginPath();
 [[14,9],[29,9],[31,11],[31,23],[29,25],[14,25],[12,23],[12,11]].forEach(([x,y],index)=>index?context.lineTo(x,y):context.moveTo(x,y));
 context.closePath();context.fillStyle='#18121c';context.strokeStyle='#713a4c';context.lineWidth=1;context.fill();context.stroke();
 context.fillStyle='#b06b7b';context.fillRect(15,9,13,1);
 context.fillStyle='#060b10';context.fillRect(14,11,15,12);
 const levels=[[2,4,5,3,1],[1,3,4,5,2],[2,5,3,4,1],[1,3,5,2,3]][frame%4];
 for(let column=0;column<5;column++)for(let segment=0;segment<5;segment++){
  const lit=segment<levels[column];
  context.fillStyle=lit?(segment===levels[column]-1?(reducedMotion?'#fca7b8':'#ffe1e6'):'#f66d88'):'#341b2a';
  context.fillRect(15+column*3,21-segment*2,2,1);
 }
 context.fillStyle='#442331';context.fillRect(15,24,13,1);
 context.fillStyle='#c46a80';context.fillRect(15+(frame%5)*3,24,1,1);
 context.font='7px "Press Start 2P",monospace';context.textBaseline='top';context.textAlign='left';
 // Independent phases keep the tiny status details alive without moving the headline.
 context.globalAlpha=reducedMotion?[1,.94,.88,.94][frame%4]:[1,.82,.94,.88][frame%4];
 context.fillStyle='#fda4af';context.fillText('SIGNAL // ERROR',38,13);
 context.globalAlpha=1;
 const indicatorPhase=Math.floor(frame/2)%2;
 const indicatorOn=reducedMotion?'#e994a7':'#ff7488';
 const indicatorOff=reducedMotion?'#9b5064':'#71303e';
 context.fillStyle=indicatorPhase===0?indicatorOn:indicatorOff;context.fillRect(274,13,5,5);
 context.fillStyle=indicatorPhase===1?indicatorOn:indicatorOff;context.fillRect(282,13,3,5);
 const fontSize=20;
 const advance=24;
 context.textBaseline='middle';context.textAlign='center';
 context.font=`600 ${fontSize}px "Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif`;
 for(let index=0;index<signalHeadline.length;index++){
  const x=150+(index-(signalHeadline.length-1)/2)*advance;
  context.fillStyle='#79283c';context.fillText(signalHeadline[index],x,39);
  context.fillStyle='#ffe1e6';context.fillText(signalHeadline[index],x,38);
 }
 context.restore();
}
const toyotaPixelRuns=(()=>{
 const ellipses=[
  {cx:30,cy:20,rx:28,ry:16,thickness:2.2},
  {cx:30,cy:15,rx:15,ry:6.5,thickness:2.1},
  {cx:30,cy:19,rx:7.5,ry:15,thickness:2.1},
 ];
 const pixels:{x:number;y:number;width:number}[]=[];
 const occupied=(x:number,y:number)=>ellipses.some(({cx,cy,rx,ry,thickness})=>{
  const dx=x+.5-cx,dy=y+.5-cy;
  return (dx/rx)**2+(dy/ry)**2<=1
   &&(dx/(rx-thickness))**2+(dy/(ry-thickness))**2>=1;
 });
 for(let y=0;y<40;y++)for(let x=0;x<60;){
  if(!occupied(x,y)){x++;continue;}
  const start=x;
  while(x<60&&occupied(x,y))x++;
  pixels.push({x:start,y,width:x-start});
 }
 return pixels;
})();
const toyotaWordRuns=(()=>{
 const glyphs:Record<string,string[]>={
  T:['1111111','1111111','0011100','0011100','0011100','0011100','0011100'],
  O:['0111110','1100011','1100011','1100011','1100011','1100011','0111110'],
  Y:['1100011','1100011','0110110','0011100','0011100','0011100','0011100'],
  A:['0011100','0110110','1100011','1100011','1111111','1100011','1100011'],
 };
 return Array.from('TOYOTA').flatMap((letter,index)=>glyphs[letter].flatMap((row,y)=>
  Array.from(row, (pixel,x)=>pixel==='1'?{x:4+index*9+x,y}:null).filter((pixel):pixel is {x:number;y:number}=>pixel!==null)
 ));
})();
type SignalConsoleState={lines:string[];line:number;chars:number;pause:number};
function signalValue(value:unknown):string{
 let rendered:string;
 if(typeof value==='string')rendered=value;
 else if(value===null||typeof value==='number'||typeof value==='boolean')rendered=String(value);
 else if(value===undefined)rendered='unavailable';
 else {try{rendered=JSON.stringify(value)??String(value);}catch{rendered=String(value);}}
 return rendered.replace(/\s+/g,' ').slice(0,72);
}
async function collectClientSignalLines(publish:(lines:string[])=>void):Promise<void>{
 const device=navigator as Navigator&{
  deviceMemory?:number;
  connection?:{effectiveType?:string;downlink?:number;rtt?:number;saveData?:boolean};
 };
 const facts:[string,unknown][]=[
  ['USER_AGENT',navigator.userAgent],
  ['PLATFORM',navigator.platform],
  ['VENDOR',navigator.vendor],
  ['LANGUAGES',navigator.languages],
  ['TIME_ZONE',Intl.DateTimeFormat().resolvedOptions().timeZone],
  ['SCREEN',`${screen.width}x${screen.height} @${window.devicePixelRatio}x`],
  ['VIEWPORT',`${window.innerWidth}x${window.innerHeight}`],
  ['COLOR_DEPTH',screen.colorDepth],
  ['CPU_THREADS',navigator.hardwareConcurrency],
  ['DEVICE_MEMORY_GB',device.deviceMemory],
  ['TOUCH_POINTS',navigator.maxTouchPoints],
  ['COOKIES',navigator.cookieEnabled],
  ['ONLINE',navigator.onLine],
  ['NETWORK',device.connection?.effectiveType],
  ['DOWNLINK_MBPS',device.connection?.downlink],
  ['ROUND_TRIP_MS',device.connection?.rtt],
  ['DATA_SAVER',device.connection?.saveData],
 ];
 const lines=['> LIVE CLIENT DATA // LOCAL SESSION'];
 for(const [key,value] of facts)if(value!==undefined&&value!==null&&value!=='')lines.push(`> ${key}=${signalValue(value)}`);
 publish([...lines]);
 try{
  const {default:FingerprintJS}=await import('@fingerprintjs/fingerprintjs');
  // The npm build enables installation telemetry by default; keep this inspection local.
  const agent=await FingerprintJS.load({monitoring:false});
  const result=await agent.get();
  lines.push(`> FINGERPRINT=${result.visitorId}`);
  for(const [key,component] of Object.entries(result.components)){
   lines.push(`> FP.${key.toUpperCase()}=${'value' in component?signalValue(component.value):'unavailable'}`);
  }
 }catch{
  lines.push('> FINGERPRINT=unavailable');
 }
 publish(lines);
}
// Terminal halftone derived from a public-domain skull silhouette:
// https://commons.wikimedia.org/wiki/File:Black_Skull_icon.svg
const signalSkull=Array.from({length:25},(_,y)=>{
 let row='';
 for(let x=0;x<43;x++){
  const dx=(x-21)/20,dy=(y-9)/9;
  const dome=dx*dx+dy*dy<1;
  const cheek=Math.abs(x-21)<15&&y>=9&&y<18;
  const jaw=Math.abs(x-21)<13-(y-17)*.55&&y>=17&&y<=24;
  const leftEye=((x-12)/6)**2+((y-11)/3.5)**2<1;
  const rightEye=((x-30)/6)**2+((y-11)/3.5)**2<1;
  const nose=y>=14&&y<19&&Math.abs(x-21)<(y-14)*.68;
  const teeth=y>=20&&y<=23&&x>=11&&x<=31&&((x-11)%4===0||y===20);
  let glyph=' ';
  if((dome||cheek||jaw)&&!leftEye&&!rightEye&&!nose){
   const grain=signalHash(x*173+y*997)%17;
   glyph=teeth?'|':dome&&dx*dx+dy*dy>.83?'%':grain<2?'#':'@';
  }
  row+=glyph;
 }
 return row.trimEnd();
}).join('\n');
function orderHash(value:string,seed:number){let hash=2166136261^seed;for(let i=0;i<value.length;i++)hash=Math.imul(hash^value.charCodeAt(i),16777619);return hash>>>0;}
function restartDossierFeedback(card:HTMLElement){
 requestAnimationFrame(()=>{
  if(!card.isConnected||!card.matches(':hover')||typeof card.getAnimations!=='function')return;
  for(const animation of card.getAnimations({subtree:true})){
   if(['dossier-signal-boot','dossier-lamp-boot'].includes((animation as CSSAnimation).animationName)){
    animation.currentTime=0;animation.play();
   }
  }
 });
}
function dossierFinish(id:string):React.CSSProperties{
 const grain=orderHash(id,0x5e2d3a91);
 const light=orderHash(id,0x1a7c4f63);
 return {
  '--dossier-sheen-x':`${18+grain%65}%`,
  '--dossier-light-x':`${16+light%69}%`,
  '--dossier-light-y':`${12+(light>>>8)%70}%`,
  '--dossier-metal-angle':`${136+(grain>>>8)%23}deg`,
  '--dossier-grain-angle':`${80+(grain>>>16)%21}deg`,
  '--dossier-grain-step':`${5+(light>>>16)%5}px`,
 } as React.CSSProperties;
}
function PixelSignalConsole({active,revision,ip}:{active:boolean;revision:string;ip:string}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  if(!active)return;
  const canvas=ref.current,panel=canvas?.parentElement;
  if(!canvas||!panel)return;
  const context=canvas.getContext('2d');if(!context)return;
  const frame=panel.getBoundingClientRect(),width=frame.width,height=frame.height;
  if(width<2||height<2)return;
  canvas.width=Math.ceil(width*signalRasterScale);canvas.height=Math.ceil(height*signalRasterScale);
  context.setTransform(signalRasterScale,0,0,signalRasterScale,0,0);
  context.imageSmoothingEnabled=false;
  const box=(element:Element|null)=>{if(!element)return null;const rect=element.getBoundingClientRect();return {x:rect.left-frame.left,y:rect.top-frame.top,width:rect.width,height:rect.height};};
  const title=box(panel.querySelector('.signal-console-title'));
  const client=box(panel.querySelector('.signal-client-bar'));
  const log=box(panel.querySelector('.signal-console-log'));
  const skull=box(panel.querySelector('.signal-skull-block'));
  const skullPre=box(panel.querySelector('.signal-skull-block pre'));
  context.fillStyle='#090d12';context.fillRect(0,0,width,height);
  paintSignalScanlines(context,width,height);
  if(title){context.fillStyle='#250d16';context.fillRect(0,title.y,width,title.height);context.fillStyle='#7d3241';context.fillRect(0,title.y+title.height-1,width,1);}
  if(client){context.fillStyle='#170b12';context.fillRect(0,client.y,width,client.height);context.fillStyle='#73303e';context.fillRect(0,client.y+client.height-1,width,1);}
  if(skull&&log&&skull.x>log.x){context.fillStyle='#6f2c3944';context.fillRect(skull.x-8,skull.y,1,skull.height);}
  const write=(value:string,x:number,y:number,maxWidth:number,size:number,color:string,weight=700,align:CanvasTextAlign='left',baseline:CanvasTextBaseline='top')=>{
   context.font=`${weight} ${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
   context.textAlign=align;context.textBaseline=baseline;context.fillStyle=color;
   if(maxWidth<context.measureText('…').width)return;
   let visible=value;
   if(context.measureText(visible).width>maxWidth){
    let low=0,high=visible.length;
    while(low<high){const middle=Math.ceil((low+high)/2);if(context.measureText(visible.slice(0,middle)+'…').width<=maxWidth)low=middle;else high=middle-1;}
    visible=visible.slice(0,low)+'…';
   }
   context.fillText(visible,align==='center'?x+maxWidth/2:align==='right'?x+maxWidth:x,y);
  };
  const textWidth=(value:string,size:number)=>{
   context.font=`700 ${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
   return context.measureText(value).width;
  };
  const titleNode=panel.querySelector('.signal-console-title');
  if(title&&titleNode){
   const right=titleNode.querySelector('b');
   const rightBox=right&&getComputedStyle(right).display!=='none'?box(right):null;
   const inset=16,rowY=title.y+title.height/2;
   const leftWidth=rightBox?Math.max(0,rightBox.x-title.x-inset-12):title.width-inset*2;
   write('ROOTKIT://GHOST_SESSION',title.x+inset,rowY,leftWidth,16,'#ffe1d4',700,'left','middle');
   if(rightBox)write(right?.textContent||'',title.x+title.width-inset-rightBox.width,rowY,rightBox.width,14,'#ff6978',700,'right','middle');
  }
  const bar=panel.querySelector('.signal-client-bar');
  if(client&&bar){
   const [label,address,live]=Array.from(bar.children);
   const inset=16,gap=12,rowY=client.y+client.height/2;
   const labelText=label?.textContent||'',addressText=address?.textContent||'',liveText=live?.textContent||'';
   const labelX=client.x+inset,labelWidth=textWidth(labelText,14);
   const liveWidth=live&&getComputedStyle(live).display!=='none'?textWidth(liveText,14):0;
   const rightEdge=client.x+client.width-inset;
   const addressX=labelX+labelWidth+gap;
   const addressWidth=Math.max(0,(liveWidth?rightEdge-liveWidth-gap:rightEdge)-addressX);
   write(labelText,labelX,rowY,labelWidth+1,14,'#f27683',700,'left','middle');
   write(addressText,addressX,rowY,addressWidth,14,'#ffe0ca',700,'left','middle');
   if(liveWidth)write(liveText,rightEdge-liveWidth-1,rowY,liveWidth+1,14,'#f27683',700,'right','middle');
  }
  const lineNodes=panel.querySelectorAll('.signal-console-log .console-line');
  if(log){lineNodes.forEach((element,index)=>{const rect=box(element);if(!rect)return;write(element.textContent||'',rect.x,rect.y,rect.width,Math.min(15,Math.max(12,rect.height*.82)),element.classList.contains('is-active')?'#ffe3d2':index%3===2?'#bf7780':'#e8abb1',700);});}
  const skullNode=panel.querySelector('.signal-skull-block');
  if(skull&&skullNode){
   const top=box(skullNode.firstElementChild),bottom=box(skullNode.lastElementChild);
   const captionX=skullPre?.x??skull.x,captionWidth=skullPre?.width??skull.width;
   if(top)write(skullNode.firstElementChild?.textContent||'',captionX,top.y,captionWidth,10,'#d97a88',700,'center');
   if(skullPre){
    const rows=signalSkull.split('\n'),fontSize=Math.min(8.5,Math.max(6,skullPre.height/rows.length*.9)),lineHeight=skullPre.height/rows.length;
    context.font=`700 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    const textWidth=context.measureText('M'.repeat(43)).width;
    const x=skullPre.x+(skullPre.width-textWidth)/2;
    rows.forEach((row,index)=>write(row,x,skullPre.y+index*lineHeight,textWidth,fontSize,'#ff7380'));
   }
   if(bottom)write(skullNode.lastElementChild?.textContent||'',captionX,bottom.y,captionWidth,10,'#d97a88',700,'center');
  }
  context.strokeStyle='#a04955';context.lineWidth=2;context.strokeRect(1,1,width-2,height-2);
  panel.dataset.pixelReady='true';
 },[active,revision,ip]);
 useEffect(()=>{const panel=ref.current?.parentElement;return()=>{if(panel)delete panel.dataset.pixelReady;};},[]);
 return <canvas ref={ref} className="pixel-console-canvas" aria-hidden="true"/>;
}

function ArtistName({name,fitToCard}:{name:string;fitToCard:boolean}){
 const ref=useRef<HTMLSpanElement>(null);
 const hasNaturalBreak=/[\s._-]/.test(name);
 useEffect(()=>{
  const element=ref.current;
  if(!element)return;
  element.style.removeProperty('font-size');
  if(!fitToCard||hasNaturalBreak)return;
  const cardInfo=element.closest('.card-info');
  if(!cardInfo)return;
  let active=true;
  const fit=()=>{
   element.style.removeProperty('font-size');
   const available=element.clientWidth;
   if(!available)return;
   const preferred=parseFloat(getComputedStyle(element).fontSize);
   const required=element.scrollWidth;
   if(required>available){
    const size=Math.max(11,Math.floor(preferred*(available-2)/required*10)/10);
    element.style.fontSize=`${size}px`;
   }
  };
  const observer=new ResizeObserver(fit);
  observer.observe(cardInfo);
  document.fonts.ready.then(()=>{if(active)fit();});
  return()=>{active=false;observer.disconnect();};
 },[name,fitToCard,hasNaturalBreak]);
 const parts=name.split(/([._-])/);
 return <span ref={ref} className="artist-name" data-phrase={hasNaturalBreak} title={name}>{parts.map((part,index)=><Fragment key={index}>{part}{/[._-]/.test(part)&&<wbr/>}</Fragment>)}</span>;
}

function ArtistTicker({name}:{name:string}){
 const screenRef=useRef<HTMLSpanElement>(null),copyRef=useRef<HTMLSpanElement>(null);
 useEffect(()=>{
  const screen=screenRef.current,copy=copyRef.current;
  if(!screen||!copy)return;
 let active=true;
  const fit=()=>{
   const available=screen.clientWidth-12;
   if(available<=0)return;
   const range=document.createRange();
   range.selectNodeContents(copy);
   const required=range.getBoundingClientRect().width;
   if(!required)return;
   screen.dataset.overflow=required>available?'true':'false';
   const repeatWidth=required+parseFloat(getComputedStyle(copy).fontSize)*1.2;
   screen.style.setProperty('--ticker-duration',`${Math.max(6,Math.min(14,repeatWidth/16))}s`);
  };
  const observer=new ResizeObserver(fit);
  observer.observe(screen);
  document.fonts.ready.then(()=>{if(active)fit();});
  return()=>{active=false;observer.disconnect();};
 },[name]);
 return <span ref={screenRef} className="card-name-screen" aria-label={name} title={name}>
  <span className="card-name-track" aria-hidden="true">
   <span ref={copyRef} className="card-name-copy">{name}</span>
   {Array.from({length:4},(_,index)=><span className="card-name-copy" key={index}>{name}</span>)}
  </span>
 </span>;
}

export function ToyotaFooter({homeHref}:{homeHref?:string}={}){
 const [signalOpen,setSignalOpen]=useState(false);
 const [bubbleActive,setBubbleActive]=useState(false);
 const bubbleCanvasRef=useRef<HTMLCanvasElement>(null);
 const [clientIp,setClientIp]=useState<ClientIpStatus>({label:'PUBLIC IP',value:'RESOLVING…'});
 const clientIpRef=useRef<string|undefined>(undefined);
 const telemetryRef=useRef<string[]>([]);
 const telemetryCursorRef=useRef(0);
 const [consoleState,setConsoleState]=useState<SignalConsoleState>({lines:[],line:0,chars:0,pause:0});
 useEffect(()=>{
  if(!signalOpen){setBubbleActive(false);return;}
  setBubbleActive(true);
  const timer=window.setTimeout(()=>setBubbleActive(false),1200);
  return()=>window.clearTimeout(timer);
 },[signalOpen]);
 useEffect(()=>{
  const canvas=bubbleCanvasRef.current;if(!canvas||!bubbleActive)return;
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  drawPixelBubble(canvas,0,reducedMotion);
  let frame=0;
  const timer=window.setInterval(()=>drawPixelBubble(canvas,++frame,reducedMotion),reducedMotion?240:160);
  return()=>window.clearInterval(timer);
 },[bubbleActive]);
 useEffect(()=>{
  if(!signalOpen)return;
  let active=true,lookup:AbortController|undefined;
  clientIpRef.current=undefined;
  telemetryRef.current=[];
  telemetryCursorRef.current=0;
  setClientIp({label:'PUBLIC IP',value:'RESOLVING…'});
  setConsoleState({lines:['> LIVE CLIENT DATA // LOCAL SESSION','> READING BROWSER PARAMETERS…'],line:0,chars:0,pause:0});
  const refreshIp=()=>{
   lookup?.abort();
   const controller=new AbortController();lookup=controller;
   void resolveClientIp(controller.signal).then(ip=>{
    if(!active||controller.signal.aborted)return;
    clientIpRef.current=ip.value==='UNAVAILABLE'?undefined:ip.value;
    setClientIp(ip);
   });
  };
  const refreshFacts=()=>void collectClientSignalLines(lines=>{
   if(!active)return;
   const first=telemetryRef.current.length===0;
   telemetryRef.current=lines;
   if(first)setConsoleState({lines:lines.slice(0,8),line:0,chars:0,pause:0});
  });
  const refresh=()=>{refreshIp();refreshFacts();};
  const onVisibility=()=>{if(document.visibilityState==='visible')refresh();};
  const connection=(navigator as Navigator&{connection?:EventTarget}).connection;
  refresh();
  window.addEventListener('online',refresh);window.addEventListener('offline',refresh);
  document.addEventListener('visibilitychange',onVisibility);connection?.addEventListener('change',refresh);
  const refreshTimer=window.setInterval(refreshIp,30000);
  const timer=window.setInterval(()=>setConsoleState(current=>{
   if(document.visibilityState!=='visible'||!current.lines.length)return current;
   const text=current.lines[current.line];
   if(current.chars<text.length)return {...current,chars:Math.min(text.length,current.chars+3)};
   const finalLine=current.line===current.lines.length-1;
   if(current.pause<(finalLine?5:2))return {...current,pause:current.pause+1};
   if(finalLine){
    const pool=telemetryRef.current;
    if(!pool.length)return current;
    const next=Array.from({length:5},()=>pool[(telemetryCursorRef.current++)%pool.length]);
    if(clientIpRef.current)next.unshift(`> CLIENT_IP=${clientIpRef.current}`);
    next.unshift(`> UTC_TIME=${new Date().toISOString()}`);
    const retained=current.lines.slice(-8);
    return {lines:[...retained,...next],line:retained.length,chars:0,pause:0};
   }
   return {...current,line:current.line+1,chars:0,pause:0};
  }),30);
  return()=>{
   active=false;lookup?.abort();window.clearInterval(timer);window.clearInterval(refreshTimer);
   window.removeEventListener('online',refresh);window.removeEventListener('offline',refresh);
   document.removeEventListener('visibilitychange',onVisibility);connection?.removeEventListener('change',refresh);
  };
 },[signalOpen]);
 const firstConsoleLine=Math.max(0,consoleState.line-7);
 const consoleLines=consoleState.lines.slice(firstConsoleLine,consoleState.line+1);
 const toyotaMarkProps={
  className:'toyota-mark',
  'aria-controls':'toyota-transmission',
  'aria-expanded':signalOpen,
  onPointerEnter:(event:React.PointerEvent<HTMLElement>)=>{if(event.pointerType==='mouse')setSignalOpen(true);},
  onPointerLeave:(event:React.PointerEvent<HTMLElement>)=>{if(event.pointerType==='mouse')setSignalOpen(false);},
  onBlur:()=>setSignalOpen(false),
  onKeyDown:(event:React.KeyboardEvent<HTMLElement>)=>{if(event.key==='Escape')setSignalOpen(false);},
 };
 const toyotaMarkContent=<><svg viewBox="0 0 60 40" aria-hidden="true" shapeRendering="crispEdges">{toyotaPixelRuns.map(({x,y,width})=><rect key={`${x}-${y}`} x={x} y={y} width={width} height="1"/>)}</svg><svg className="toyota-wordmark" viewBox="0 0 60 9" aria-hidden="true" shapeRendering="crispEdges">{toyotaWordRuns.map(({x,y})=><rect key={`${x}-${y}`} x={x} y={y} width="1" height="1"/>)}</svg><span className="toyota-signal-prompt" aria-hidden="true">{homeHref?'НА ГЛАВНУЮ':'АКТИВИРОВАТЬ СИГНАЛ'}</span></>;
 return <footer className="command-footer">
  <div className="command-footer-rail"><span>AI CULTURE // ARCHIVE SYSTEM</span><span className="command-footer-status"><i aria-hidden="true"/>СИГНАЛ ГОТОВ</span></div>
  <div className="command-footer-hardware" aria-hidden="true"><div className="command-footer-vent"/><div className="command-footer-backplate"/><div className="command-footer-vent"/></div>
  <div className="command-footer-rail command-footer-rail--bottom"><span>КОНЕЦ АРХИВА</span><span>СЕКТОР 01 / ИИЗМ</span></div>
  <div className="manifesto" data-open={signalOpen}>
  <div id="toyota-transmission" className="manifesto-transmission" aria-hidden={!signalOpen}>
   <SignalRain active={signalOpen}/>
   <div className="manifesto-interference">
   <div className="signal-console-title">ROOTKIT://GHOST_SESSION <b>CLIENT // LIVE DATA</b></div>
   <div className="signal-client-bar"><span>{clientIp.label}</span><strong>{clientIp.value}</strong><span className="signal-client-live">● LIVE STREAM</span></div>
    <div className="signal-console-body">
     <div className="signal-console-log">{consoleLines.map((fragment,i)=>{const lineIndex=firstConsoleLine+i;const active=lineIndex===consoleState.line;return <span className={active?'console-line is-active':'console-line'} key={`${lineIndex}-${active?'active':'done'}`}>{active?fragment.slice(0,consoleState.chars):fragment}</span>;})}</div>
     <div className="signal-skull-block"><div>BROWSER // READ ONLY</div><pre>{signalSkull}</pre><div>LOCAL CLIENT SNAPSHOT</div></div>
    </div>
    <PixelSignalConsole active={signalOpen} revision={`${consoleState.line}:${consoleState.chars}:${consoleState.pause}`} ip={clientIp.value}/>
   </div>
  </div>
  <div className="toyota-mark-frame">
  <div className="manifesto-zalgo" data-play={bubbleActive} aria-hidden="true"><canvas ref={bubbleCanvasRef} className="comic-bubble-canvas" width="300" height="72"/></div>
  {homeHref?<a {...toyotaMarkProps} href={homeHref} aria-label="Toyota: перейти на главную">{toyotaMarkContent}</a>:<button {...toyotaMarkProps} type="button" aria-label="Toyota: показать сигнал" onClick={()=>{if(window.matchMedia('(hover: none)').matches)setSignalOpen(open=>!open);else setSignalOpen(true);}}>{toyotaMarkContent}</button>}
  </div>
 </div></footer>;
}

function PreviewNameScreen({name}:{name:string}){
 const screenRef=useRef<HTMLElement>(null),windowRef=useRef<HTMLSpanElement>(null),copyRef=useRef<HTMLSpanElement>(null);
 useEffect(()=>{
  const screen=screenRef.current,viewport=windowRef.current,copy=copyRef.current;
  if(!screen||!viewport||!copy)return;
  let active=true;
  const fit=()=>{
   const overflow=Math.max(0,copy.scrollWidth-viewport.clientWidth);
   screen.dataset.overflow=overflow>1?'true':'false';
   screen.style.setProperty('--preview-name-travel',`${overflow}px`);
   screen.style.setProperty('--preview-name-duration',`${Math.max(4,Math.min(12,overflow/18*2+1.5))}s`);
  };
  const observer=new ResizeObserver(fit);
  observer.observe(viewport);observer.observe(copy);
  fit();document.fonts.ready.then(()=>{if(active)fit();});
  return()=>{active=false;observer.disconnect();};
 },[name]);
 return <strong ref={screenRef} className="artist-name-preview-name"><span ref={windowRef} className="artist-name-preview-name-window"><span ref={copyRef} className="artist-name-preview-name-copy">{name}</span></span></strong>;
}

function ArtistNameFlow({artists}:{artists:Artist[]}){
 const [preview,setPreview]=useState<{artist:Artist;left:number;top:number;below:boolean;width:number}|null>(null);
 const activeName=useRef<HTMLElement|null>(null);
 const measureCanvas=useRef<HTMLCanvasElement|null>(null);
 function previewPosition(element:HTMLElement,artist:Artist){
  const rect=element.getBoundingClientRect();
  if(!measureCanvas.current)measureCanvas.current=document.createElement('canvas');
  const context=measureCanvas.current.getContext('2d');
  if(context)context.font='10px "Press Start 2P", monospace';
  const nameWidth=context?.measureText(artist.name).width??[...artist.name].length*10;
  // Include the portrait, gap, metal frame and name-screen padding.
  const contentWidth=Math.ceil(nameWidth+152);
  const width=Math.min(window.innerWidth-24,Math.max(296,window.innerWidth<=700?Math.min(440,contentWidth):contentWidth));
  return {left:Math.max(12,Math.min(rect.left,window.innerWidth-width-12)),top:rect.top>260?rect.top-12:rect.bottom+12,below:rect.top<=260,width};
 }
 useEffect(()=>{let active=true;const sync=()=>{if(active&&activeName.current)setPreview(current=>current?{...current,...previewPosition(activeName.current!,current.artist)}:null);};window.addEventListener('scroll',sync,true);window.addEventListener('resize',sync);document.fonts.ready.then(sync);return ()=>{active=false;window.removeEventListener('scroll',sync,true);window.removeEventListener('resize',sync);};},[]);
 function showPreview(artist:Artist,element:HTMLElement){activeName.current=element;setPreview({artist,...previewPosition(element,artist)});}
 function hidePreview(){activeName.current=null;setPreview(null);}
 const previewTags=preview?preview.artist.tags.split(/[,;#]+/).map(tag=>tag.trim()).filter(Boolean):[];
 return <><div className="artist-name-flow" aria-label="Имена в архиве">{artists.map(artist=><span key={artist.id} className="artist-name-item"><a className="artist-name-link" data-rating={artist.rating||'A'} href={artist.url} target="_blank" rel="noopener noreferrer" onMouseEnter={event=>showPreview(artist,event.currentTarget)} onMouseLeave={hidePreview} onFocus={event=>showPreview(artist,event.currentTarget)} onBlur={hidePreview}>{artist.name}</a>{showLocalAdmin&&<a className="artist-name-edit" href={`${adminUrl}/?edit=${encodeURIComponent(artist.id)}`} aria-label={`Редактировать ${artist.name}`} title="Редактировать запись"><Pencil size={15} aria-hidden="true"/></a>}</span>)}</div>
 {preview&&createPortal(<div key={preview.artist.id} className={'artist-name-preview'+(preview.below?' is-below':'')} data-rating={preview.artist.rating||'A'} data-kind={preview.artist.kind||'artist'} style={{left:preview.left,top:preview.top,width:preview.width}} aria-hidden="true"><div className="artist-name-preview-image"><span>{preview.artist.name.slice(0,1)}</span>{preview.artist.image&&<img src={preview.artist.image} alt="" referrerPolicy="no-referrer" onError={event=>{event.currentTarget.style.display='none';}}/>}</div><div className="artist-name-preview-details"><PreviewNameScreen key={preview.artist.id} name={preview.artist.name}/><div className="artist-name-preview-tags"><span className="artist-name-preview-rating">{preview.artist.rating||'A'}</span><span className="artist-name-preview-kind">{preview.artist.kind==='collective'?'Проект':preview.artist.kind==='media'?'Медиа':'Артист'}</span>{previewTags.map((tag,index)=><span key={`${tag}-${index}`}>{tag}</span>)}{(preview.artist.section==='world'||preview.artist.section==='runet')&&<span className="artist-name-preview-region" title={preview.artist.section==='world'?'США':'СССР'}><img src={preview.artist.section==='world'?'./badges/region-en-eagle-cutout.png':'./badges/region-ru-emblem-cutout.png'} alt={preview.artist.section==='world'?'США':'СССР'}/></span>}</div></div>
 <span className="artist-name-preview-status" aria-hidden="true"><span className="dossier-status-signal">{Array.from({length:6},(_,index)=><i key={index} style={{'--lamp-delay':`${index*.08}s`} as React.CSSProperties}/>)}</span><span className="dossier-status-lights"><i/><i/><i/></span></span>
 </div>,document.body)}
 </>;
}

function CatalogSearch({query,onChange}:{query:string;onChange:(value:string)=>void}){
 const input=useRef<HTMLInputElement>(null);
 return <div className="input-search">
 {query?<button type="button" className="catalog-search-clear" aria-label="Очистить поиск" title="Очистить поиск" onClick={()=>{onChange('');input.current?.focus();}}><X size={20} aria-hidden="true"/></button>:<Search size={17} aria-hidden="true"/>}
 <input ref={input} aria-label="Поиск записи" placeholder="Поиск" value={query} onChange={event=>onChange(event.target.value)}/>
 </div>;
}

export default function Atlas({initial}:{initial:Artist[]}){
const [data,setData]=useState(initial),[sections,setSections]=useState<Section[]>(defaultSections),[error,setError]=useState('');
async function refresh(){try{const r=await fetch(catalogUrl,{cache:'no-store'});const d:any=await r.json();if(!r.ok)throw Error(d.error);setData(d.artists);setSections(d.sections);setError('');}catch{setError('Связь с архивом потеряна. Показаны последние доступные досье.');}}
useEffect(()=>{refresh();const onFocus=()=>refresh();window.addEventListener('focus',onFocus);return ()=>window.removeEventListener('focus',onFocus);},[]);
const [section,setSection]=useState('all'),[q,setQ]=useState(''),[view,setView]=useState('grid'),[kind,setKind]=useState('all'),[rating,setRating]=useState('all'),[sortMode,setSortMode]=useState<'posting'|'random'>('posting'),[shuffleSeed,setShuffleSeed]=useState(0);
const [deckZoom,setDeckZoom]=useState(1.1);
const changeDeckZoom=(step:number)=>setDeckZoom(current=>Math.round(Math.max(.4,Math.min(1.5,current+step))*100)/100);
const [cardSize,setCardSize]=useState<'sm'|'md'|'lg'>('sm');
const [listSize,setListSize]=useState<'sm'|'md'|'lg'>('sm');
useEffect(()=>{
 const mobile=window.matchMedia('(max-width:580px)');
 const normalizeSizes=()=>{
  if(!mobile.matches)return;
  setCardSize(size=>size==='md'?'sm':size);
  setListSize(size=>size==='md'?'sm':size);
 };
 normalizeSizes();mobile.addEventListener('change',normalizeSizes);
 return ()=>mobile.removeEventListener('change',normalizeSizes);
},[]);
const [controlsOpen,setControlsOpen]=useState(false);
const controlsToggle=useRef<HTMLButtonElement>(null);
function changeView(next:string){if(next===view)return;setView(next);setCardSize('sm');setListSize('sm');}
const catalogIsDefault=section==='all'&&kind==='all'&&rating==='all'&&!q&&cardSize==='sm'&&listSize==='sm'&&sortMode==='posting'&&deckZoom===1.1;
function resetCatalog(){
 setSection('all');setKind('all');setRating('all');setQ('');
 setCardSize('sm');setListSize('sm');
 setSortMode('posting');setShuffleSeed(0);setDeckZoom(1.1);
}
function sortControls(position:'header'|'footer'){return <div className={'catalog-sort-switch catalog-sort-switch--'+position}><span>СОРТИРОВКА</span><div className="catalog-sort-options" role="radiogroup" aria-label="Порядок отображения"><label className={sortMode==='random'?'active':''} title="Случайный порядок" onClick={()=>{if(sortMode==='random')setShuffleSeed(Math.floor(Math.random()*0xffffffff));}}><input type="radio" name={'catalog-sort-'+position} value="random" checked={sortMode==='random'} onChange={()=>{setSortMode('random');setShuffleSeed(Math.floor(Math.random()*0xffffffff));}}/><Shuffle size={18}/><span className="sr-only">Случайный порядок</span></label><label className={sortMode==='posting'?'active':''} title="Порядок публикации"><input type="radio" name={'catalog-sort-'+position} value="posting" checked={sortMode==='posting'} onChange={()=>setSortMode('posting')}/><ListOrdered size={18}/><span className="sr-only">Порядок публикации</span></label></div></div>;}
const matchingArtists=data.filter(a=>(section==='all'||a.section===section)&&(kind==='all'||(a.kind||'artist')===kind)&&(rating==='all'||(a.rating||'A').toUpperCase()===rating)&&matchesArtistSearch(a,q));
const sourceOrder=new Map(data.map((artist,index)=>[artist.id,index]));
const artists=[...matchingArtists].sort((a,b)=>sortMode==='posting'?(sourceOrder.get(a.id)!-sourceOrder.get(b.id)!):(orderHash(a.id,shuffleSeed)-orderHash(b.id,shuffleSeed)));
useEffect(()=>{const context=(document as any).modelContext;if(!context?.registerTool)return;const lifecycle=new AbortController();try{Promise.resolve(context.registerTool({name:'filter_artists',description:'Filter the visible artist catalog by name or section.',inputSchema:{type:'object',properties:{query:{type:'string'},section:{type:'string'},kind:{type:'string',enum:['all','artist','media','collective']}},additionalProperties:false},annotations:{readOnlyHint:true},execute(input:any){if(!input||typeof input!=='object'||input.query!==undefined&&typeof input.query!=='string'||input.section!==undefined&&!['all',...sections.map(s=>s.id)].includes(input.section))throw Error('Invalid filter');if(input.kind!==undefined&&!['all','artist','media','collective'].includes(input.kind))throw Error('Invalid kind');setKind(input.kind||'all');setQ(input.query||'');setSection(input.section||'all');return {count:data.filter(a=>(!input.section||input.section==='all'||a.section===input.section)&&(!input.kind||input.kind==='all'||(a.kind||'artist')===input.kind)&&matchesArtistSearch(a,input.query||'')).length};}},{signal:lifecycle.signal})).catch(()=>{});}catch{}return ()=>lifecycle.abort();},[data,sections]);
return <>
<CommandDeck mode="catalog" total={data.length}/>
<main>
<section className="catalog" id="catalog">{error&&<p className="error" role="alert">{error} <button onClick={refresh}>Восстановить связь</button>
</p>}<div className="catalog-controls" onKeyDown={event=>{if(event.key==='Escape'&&controlsOpen&&controlsToggle.current?.getClientRects().length){event.preventDefault();setControlsOpen(false);controlsToggle.current.focus();}}}>
<div className="search-row catalog-mobile-bar">
<CatalogSearch query={q} onChange={setQ}/>
<button ref={controlsToggle} type="button" className="catalog-menu-toggle" aria-label={controlsOpen?'Закрыть настройки каталога':'Открыть настройки каталога'} aria-expanded={controlsOpen} aria-controls="catalog-settings" onClick={()=>setControlsOpen(open=>!open)}>{controlsOpen?<X size={22}/>:<Menu size={22}/>}</button>
</div>
<div id="catalog-settings" className="catalog-settings" data-open={controlsOpen}>
<div className="catalog-head">
<div className="filters">{[['all','Все'],...sections.map(s=>[s.id,s.name])].map(([id,title])=>
<button key={id} className={section===id?'active':''} onClick={()=>setSection(id)}>{title}<sup>{id==='all'?data.length:data.filter(a=>a.section===id).length}</sup>
</button>)}</div>
<div className="catalog-actions"><div className="catalog-view-controls">{view==='grid'&&<div className="catalog-density" role="group" aria-label="Размер карточек">
<span>Размер</span>{(['sm','md','lg'] as const).map(value=><button key={value} type="button" className={value==='md'?'catalog-size-md':undefined} aria-label={`Размер карточек: ${value.toUpperCase()}`} aria-pressed={cardSize===value} onClick={()=>setCardSize(value)}>{value.toUpperCase()}</button>)}
</div>}{view==='list'&&<div className="catalog-density" role="group" aria-label="Размер элементов списка">
<span>Размер</span>{(['sm','md','lg'] as const).map(value=><button key={value} type="button" className={value==='md'?'catalog-size-md':undefined} aria-label={`Размер списка ${value.toUpperCase()}`} aria-pressed={listSize===value} onClick={()=>setListSize(value)}>{value.toUpperCase()}</button>)}
</div>}{sortControls('header')}<div className="view-switch">{[[Grid2X2,'grid','Карточки-досье'],[Type,'names','Имена'],[List,'list','Реестр'],[Layers3,'deck','Трёхмерная колода'],[Network,'map','Тактическая карта']].map(([Icon,id,label]:any)=>
<button key={id} aria-label={label} aria-pressed={view===id} className={view===id?'active':''} onClick={()=>changeView(id)}>
<Icon size={18}/>
</button>)}</div></div></div>
<button type="button" className="catalog-reset" aria-label="Сбросить настройки каталога" title="Сбросить настройки каталога" disabled={catalogIsDefault} onClick={resetCatalog}><RotateCcw size={18} aria-hidden="true"/></button>
</div>
<div className="search-row">
<CatalogSearch query={q} onChange={setQ}/>
{sortControls('footer')}
<div className="catalog-type-controls">
<div className="catalog-type-radios" role="radiogroup" aria-label="Тип записей">{[['all','Все'],['artist','Артисты'],['media','Медиа'],['collective','Проекты']].map(([id,label])=><label key={id} className={kind===id?'is-active':''}><input type="radio" name="catalog-kind" value={id} checked={kind===id} onChange={()=>setKind(id)}/><span>{label}</span></label>)}</div>
<div className="catalog-tag-filter"><span>ТЕГ</span><div className="catalog-type-radios" role="radiogroup" aria-label="Рейтинг тегов">{[['all','Все'],['A','A'],['AA','AA'],['AAA','AAA'],['AAA+','AAA+']].map(([id,label])=><label key={id} className={rating===id?'is-active':''}><input type="radio" name="catalog-rating" value={id} checked={rating===id} onChange={()=>setRating(id)}/><span>{label}</span></label>)}</div></div>
</div>
 </div></div></div>{view==='names'?<ArtistNameFlow artists={artists}/>:view==='map'?<ArtistMap artists={artists} sections={sections}/>:view==='deck'?<ArtistCanvasDeck artists={artists} zoom={deckZoom} onZoomStep={changeDeckZoom}/>:<div className={view==='list'?'artist-list':'artist-grid'} data-size={view==='grid'?cardSize:listSize}>{artists.map((a,i)=>
<article className="artist-card" data-rating={a.rating||'A'} data-kind={a.kind||'artist'} data-section={a.section} style={dossierFinish(a.id)} key={a.id} onMouseEnter={view==='grid'?event=>restartDossierFeedback(event.currentTarget):undefined}>
<div className={'art art-'+i%8}>
<span className="art-index">{String(i+1).padStart(3,'0')}</span>
<div className="missing-avatar" role="img" aria-label="Аватарка отсутствует">
<span aria-hidden="true">×</span>
</div>{a.image&&<img src={a.image} alt={a.name} loading="lazy" draggable={false} referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.display="none";}}/>}{view==='grid'&&<div className="dossier-tags">
{a.kind==='collective'?<span className="record-type record-type--avatar" title="Проект"><UsersRound size={13} aria-hidden="true"/><span className="record-type-label">Проект</span></span>:a.kind==='media'?<span className="record-type record-type--avatar" title="Медиа"><Radio size={13} aria-hidden="true"/><span className="record-type-label">Медиа</span></span>:null}
<span className="art-badges">
<span className={`rating-tag rating-${(a.rating||'A').toLowerCase()}`}>{a.rating||'A'}</span>
</span></div>}
{showLocalAdmin&&view==='grid'&&<a className="card-edit card-edit--image" aria-label={"Редактировать "+a.name} href={adminUrl+"/?edit="+encodeURIComponent(a.id)+"#catalog"}><Pencil size={15}/></a>}
{view==='grid'&&<span className="art-platform-tag" aria-hidden="true"><span className="platform-label"><span className="platform-short">{a.platform==='Instagram'?'IG':a.platform==='Telegram'?'TG':a.platform.slice(0,2)}</span><ArrowUpRight size={13}/></span></span>}
</div>
<div className="card-info">
{view==='grid'&&(a.section==='world'||a.section==='runet')&&<img className="region-watermark" src={a.section==='world'?'./badges/region-en-eagle-cutout.png':'./badges/region-ru-emblem-cutout.png'} alt="" aria-hidden="true" loading="lazy" decoding="async"/>}
<div>
<h2 aria-label={a.name}>
{view==='grid'?<ArtistTicker name={a.name}/>:<ArtistName name={a.name} fitToCard={false}/>}
</h2>{view==='list'&&<div className="list-tags">{(a.section==='world'||a.section==='runet')&&<span className="list-region-badge" title={a.section==='world'?'Мир':'Рунет'}><img src={a.section==='world'?'./badges/region-en-eagle-cutout.png':'./badges/region-ru-emblem-cutout.png'} alt={a.section==='world'?'Мир':'Рунет'} loading="lazy" decoding="async"/></span>}<span className="list-rating-tag">{a.rating||'A'}</span>{a.kind==='collective'?<span className="list-kind-tag"><UsersRound size={11} aria-hidden="true"/>Проект</span>:a.kind==='media'?<span className="list-kind-tag"><Radio size={11} aria-hidden="true"/>Медиа</span>:null}</div>}{view!=='list'&&<p>
<span className="artist-social">{a.platform} <ArrowUpRight size={14}/>
</span>
{a.kind==='collective'?<span className="list-kind-tag"><UsersRound size={11} aria-hidden="true"/>Проект</span>:a.kind==='media'?<span className="list-kind-tag"><Radio size={11} aria-hidden="true"/>Медиа</span>:null}
</p>}
</div>{view==='grid'&&<span className="dossier-status" aria-hidden="true"><span className="dossier-status-signal">{Array.from({length:6},(_,index)=><i key={index} style={{'--lamp-delay':`${index*.08}s`} as React.CSSProperties}/>)}</span><span className="dossier-status-lights"><i/><i/><i/></span></span>}</div>
{view==='list'&&<span className="list-source-cue" aria-hidden="true"><ArrowUpRight size={14}/></span>}
{view!=='deck'&&<a className="card-hit-area" href={a.url} target="_blank" rel="noopener noreferrer" aria-label={"Открыть источник: "+a.name}/>}
{showLocalAdmin&&view!=='grid'&&<a className="card-edit" aria-label={"Редактировать "+a.name} href={adminUrl+"/?edit="+encodeURIComponent(a.id)+"#catalog"}><Pencil size={15}/></a>}
</article>)}</div>}{!artists.length&&view!=='deck'&&<p className="empty">Сигнал не обнаружен. Измените запрос или фильтр.</p>}</section>
</main>
<ToyotaFooter/>
</>;
}
