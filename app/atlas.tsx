'use client';
import {Fragment,useState,useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {catalogUrl,adminUrl,showLocalAdmin} from '@/client/config';
import ArtistMap from './artist-map';
import ArtistCanvasDeck from './artist-canvas-deck';
import {defaultSections,type Artist,type Section} from '@/lib/types';
import {ArrowUpRight, Search, Grid2X2, List, Network, Layers3, Pencil, Radio, UsersRound, ZoomIn, ZoomOut, Shuffle, ListOrdered, RotateCcw, Type} from 'lucide-react';
import SignalRain from './signal-rain';
import {paintSignalScanlines,signalHash,signalRasterScale} from './signal-screen';
import {createSignalScript} from './signal-script';
import CommandDeck from '@/client/command-deck';

const cuneiformGlyphs=[
  ...Array.from({length:96},(_,index)=>String.fromCodePoint(0x12000+index)),
  ...Array.from({length:24},(_,index)=>String.fromCodePoint(0x12400+index)),
];
const signalHeadline=Array.from('信号が破損しました');
function drawPixelBubble(canvas:HTMLCanvasElement,visibleGlyphs:number,elapsed=1000){
 const context=canvas.getContext('2d');if(!context)return;
 context.clearRect(0,0,canvas.width,canvas.height);
 context.save();context.scale(canvas.width/300,canvas.height/72);
 const outline:[number,number][]=[
  [29,7],[48,7],[48,5],[69,5],[69,7],[91,7],[91,5],[114,5],
  [114,7],[137,7],[137,5],[160,5],[160,7],[183,7],[183,5],[206,5],
  [206,7],[229,7],[229,5],[252,5],[252,7],[273,7],[286,11],[293,18],
  [296,25],[296,36],[292,44],[284,49],[272,52],[250,52],[250,54],
  [226,54],[226,52],[202,52],[202,54],[178,54],[178,52],[162,52],
  [150,69],[138,52],[123,52],[123,54],[99,54],[99,52],[75,52],
  [75,54],[51,54],[51,52],[29,52],[16,48],[8,41],[5,34],[5,25],
  [9,17],[17,11],
 ];
 const trace=()=>{context.beginPath();outline.forEach(([x,y],index)=>index?context.lineTo(x,y):context.moveTo(x,y));context.closePath();};
 context.save();context.translate(0,3);trace();context.fillStyle='#8e1830';context.fill();context.restore();
 trace();context.fillStyle='#ffe0d6';context.strokeStyle='#230b16';context.lineWidth=5;context.lineJoin='miter';context.fill();context.stroke();
 const fontSize=25;
 const advance=27;
 const count=Math.min(visibleGlyphs,signalHeadline.length);
 context.textBaseline='middle';context.textAlign='center';
 context.font=`900 ${fontSize}px "Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif`;
 for(let index=0;index<count;index++){
  const reveal=elapsed-180-index*48;
  const bounce=reveal>0&&reveal<160?-Math.round(4*(1-Math.abs(reveal-80)/80)):0;
  const x=150+(index-(count-1)/2)*advance;
  const y=29+bounce;
  context.fillStyle='#e4949e';context.fillText(signalHeadline[index],x+1,y+2);
  context.fillStyle='#8e1025';context.fillText(signalHeadline[index],x,y);
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
type ClientIpStatus={label:string;value:string};
async function resolveClientIp(signal:AbortSignal):Promise<ClientIpStatus>{
 try{
  const response=await fetch('https://api64.ipify.org?format=json',{signal,cache:'no-store',referrerPolicy:'no-referrer'});
  if(!response.ok)throw Error('IP lookup failed');
  const data=await response.json();
  if(typeof data.ip==='string'&&/^[0-9a-fA-F:.]{3,45}$/.test(data.ip))return {label:'PUBLIC IP',value:data.ip};
 }catch{}
 try{
  const response=await fetch('/api/client-ip',{cache:'no-store'});
  if(!response.ok)throw Error('Connection lookup failed');
  const data=await response.json();
  if(typeof data.ip==='string'&&/^[0-9a-fA-F:.]{3,45}$/.test(data.ip))return {label:'LINK IP',value:data.ip};
 }catch{}
 return {label:'CLIENT IP',value:'UNAVAILABLE'};
}
function signalValue(value:unknown):string{
 let rendered:string;
 if(typeof value==='string')rendered=value;
 else if(value===null||typeof value==='number'||typeof value==='boolean')rendered=String(value);
 else if(value===undefined)rendered='unavailable';
 else {try{rendered=JSON.stringify(value)??String(value);}catch{rendered=String(value);}}
 return rendered.replace(/\s+/g,' ').slice(0,72);
}
async function collectClientSignalLines():Promise<string[]>{
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
 const lines=['$ ghostctl client-recon --scope=browser --read-only','> LIVE CLIENT DATA // LOCAL SESSION'];
 for(const [key,value] of facts)if(value!==undefined&&value!==null&&value!=='')lines.push(`> ${key}=${signalValue(value)}`);
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
 lines.push('> LIVE RECON COMPLETE // SIMULATION FOLLOWS');
 return lines;
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
  const write=(value:string,x:number,y:number,maxWidth:number,size:number,color:string,weight=700,align:CanvasTextAlign='left')=>{
   context.font=`${weight} ${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
   context.textAlign=align;context.textBaseline='top';context.fillStyle=color;
   let visible=value;
   if(context.measureText(visible).width>maxWidth){
    let low=0,high=visible.length;
    while(low<high){const middle=Math.ceil((low+high)/2);if(context.measureText(visible.slice(0,middle)+'…').width<=maxWidth)low=middle;else high=middle-1;}
    visible=visible.slice(0,low)+'…';
   }
   context.fillText(visible,align==='center'?x+maxWidth/2:x,y);
  };
  const titleNode=panel.querySelector('.signal-console-title');
  if(title&&titleNode){
   const right=titleNode.querySelector('b');
   write('ROOTKIT://GHOST_SESSION',title.x+14,title.y+Math.max(4,(title.height-17)/2),title.width-28,16,'#ffe1d4');
   if(right&&getComputedStyle(right).display!=='none'){
    const rect=box(right);if(rect)write(right.textContent||'',rect.x,rect.y,rect.width,14,'#ff6978');
   }
  }
  const bar=panel.querySelector('.signal-client-bar');
  if(client&&bar){
   const items=Array.from(bar.children);
   for(const item of items){const rect=box(item);if(!rect)continue;write(item.textContent||'',rect.x,rect.y+Math.max(1,(rect.height-15)/2),rect.width,14,item.tagName==='STRONG'?'#ffe0ca':'#f27683');}
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

function ToyotaFooter(){
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
  const timer=window.setTimeout(()=>setBubbleActive(false),2300);
  return()=>window.clearTimeout(timer);
 },[signalOpen]);
 useEffect(()=>{
  const canvas=bubbleCanvasRef.current;if(!canvas||!bubbleActive)return;
  let frame=0;const start=performance.now();
  const reveal=(now:number)=>{const elapsed=now-start;drawPixelBubble(canvas,Math.max(0,Math.min(signalHeadline.length,Math.floor((elapsed-180)/48)+1)),elapsed);if(elapsed<900)frame=requestAnimationFrame(reveal);};
  frame=requestAnimationFrame(reveal);
  return()=>cancelAnimationFrame(frame);
 },[bubbleActive]);
 useEffect(()=>{
  if(!signalOpen)return;
  let active=true;
  const controller=new AbortController();
  const timeout=window.setTimeout(()=>controller.abort(),4500);
  clientIpRef.current=clientIp.value==='RESOLVING…'||clientIp.value==='UNAVAILABLE'?undefined:clientIp.value;
  telemetryRef.current=[];
  telemetryCursorRef.current=0;
  if(!clientIpRef.current)setClientIp({label:'PUBLIC IP',value:'RESOLVING…'});
  const nextScript=()=>{
   const pool=telemetryRef.current;
   const telemetry=pool.length?pool[(telemetryCursorRef.current++)%pool.length]:undefined;
   return createSignalScript(clientIpRef.current,telemetry);
  };
  setConsoleState({lines:['> GHOST SESSION READY // LOCAL VIEW','> VIRTUAL TARGETS LOADED / EGRESS=DENY',...nextScript()],line:2,chars:0,pause:0});
  void resolveClientIp(controller.signal).then(ip=>{
   if(!active)return;
   clientIpRef.current=ip.value==='UNAVAILABLE'?undefined:ip.value;
   setClientIp(ip);
  }).finally(()=>window.clearTimeout(timeout));
  void collectClientSignalLines().then(lines=>{if(active)telemetryRef.current=lines;});
  const timer=window.setInterval(()=>setConsoleState(current=>{
   if(document.visibilityState!=='visible'||!current.lines.length)return current;
   const text=current.lines[current.line];
   if(current.chars<text.length)return {...current,chars:Math.min(text.length,current.chars+3)};
   const finalLine=current.line===current.lines.length-1;
   if(current.pause<(finalLine?5:2))return {...current,pause:current.pause+1};
   if(finalLine){
    const retained=current.lines.slice(-16);
    return {lines:[...retained,...nextScript()],line:retained.length,chars:0,pause:0};
   }
   return {...current,line:current.line+1,chars:0,pause:0};
  }),30);
  return()=>{active=false;controller.abort();window.clearTimeout(timeout);window.clearInterval(timer);};
 },[signalOpen]);
 const firstConsoleLine=Math.max(0,consoleState.line-7);
 const consoleLines=consoleState.lines.slice(firstConsoleLine,consoleState.line+1);
 return <footer><div className="manifesto" data-open={signalOpen} onPointerLeave={event=>{if(event.pointerType==='mouse')setSignalOpen(false);}} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setSignalOpen(false);}}>
  <div id="toyota-transmission" className="manifesto-transmission" aria-hidden={!signalOpen}>
   <SignalRain active={signalOpen}/>
   <div className="manifesto-interference">
   <div className="signal-console-title">ROOTKIT://GHOST_SESSION <b>EXPLOIT SIM // SANDBOXED</b></div>
   <div className="signal-client-bar"><span>{clientIp.label}</span><strong>{clientIp.value}</strong><span className="signal-client-live">● LIVE STREAM</span></div>
    <div className="signal-console-body">
     <div className="signal-console-log">{consoleLines.map((fragment,i)=>{const lineIndex=firstConsoleLine+i;const active=lineIndex===consoleState.line;return <span className={active?'console-line is-active':'console-line'} key={`${lineIndex}-${active?'active':'done'}`}>{active?fragment.slice(0,consoleState.chars):fragment}</span>;})}</div>
     <div className="signal-skull-block"><div>TARGET NODE // {`0x01F4`}</div><pre>{signalSkull}</pre><div>ROOT ACCESS SIMULATED</div></div>
    </div>
    <PixelSignalConsole active={signalOpen} revision={`${consoleState.line}:${consoleState.chars}:${consoleState.pause}`} ip={clientIp.value}/>
   </div>
    <div className="manifesto-zalgo" data-play={bubbleActive} aria-hidden="true"><canvas ref={bubbleCanvasRef} className="comic-bubble-canvas" width="200" height="48"/></div>
  </div>
  <button type="button" className="toyota-mark" aria-label="Toyota: показать сигнал" aria-controls="toyota-transmission" aria-expanded={signalOpen} onPointerEnter={event=>{if(event.pointerType==='mouse')setSignalOpen(true);}} onKeyDown={event=>{if(event.key==='Escape')setSignalOpen(false);}} onClick={()=>{if(window.matchMedia('(hover: none)').matches)setSignalOpen(open=>!open);else setSignalOpen(true);}}><svg viewBox="0 0 60 40" aria-hidden="true" shapeRendering="crispEdges">{toyotaPixelRuns.map(({x,y,width})=><rect key={`${x}-${y}`} x={x} y={y} width={width} height="1"/>)}</svg><svg className="toyota-wordmark" viewBox="0 0 60 9" aria-hidden="true" shapeRendering="crispEdges">{toyotaWordRuns.map(({x,y})=><rect key={`${x}-${y}`} x={x} y={y} width="1" height="1"/>)}</svg></button>
 </div></footer>;
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
  const nameWidth=Math.max(context?.measureText(artist.name).width||0,[...artist.name].length*10);
  const width=Math.min(window.innerWidth-24,Math.max(296,Math.min(440,Math.ceil(nameWidth+144))));
  return {left:Math.max(12,Math.min(rect.left,window.innerWidth-width-12)),top:rect.top>260?rect.top-12:rect.bottom+12,below:rect.top<=260,width};
 }
 useEffect(()=>{const sync=()=>{if(activeName.current)setPreview(current=>current?{...current,...previewPosition(activeName.current!,current.artist)}:null);};window.addEventListener('scroll',sync,true);window.addEventListener('resize',sync);return ()=>{window.removeEventListener('scroll',sync,true);window.removeEventListener('resize',sync);};},[]);
 function showPreview(artist:Artist,element:HTMLElement){activeName.current=element;setPreview({artist,...previewPosition(element,artist)});}
 function hidePreview(){activeName.current=null;setPreview(null);}
 const previewTags=preview?preview.artist.tags.split(/[,;#]+/).map(tag=>tag.trim()).filter(Boolean):[];
 return <><div className="artist-name-flow" aria-label="Имена в архиве">{artists.map(artist=><span key={artist.id} className="artist-name-item"><a className="artist-name-link" data-rating={artist.rating||'A'} href={artist.url} target="_blank" rel="noopener noreferrer" onMouseEnter={event=>showPreview(artist,event.currentTarget)} onMouseLeave={hidePreview} onFocus={event=>showPreview(artist,event.currentTarget)} onBlur={hidePreview}>{artist.name}</a>{showLocalAdmin&&<a className="artist-name-edit" href={`${adminUrl}/?edit=${encodeURIComponent(artist.id)}`} aria-label={`Редактировать ${artist.name}`} title="Редактировать запись"><Pencil size={15} aria-hidden="true"/></a>}</span>)}</div>
 {preview&&createPortal(<div className={'artist-name-preview'+(preview.below?' is-below':'')} data-rating={preview.artist.rating||'A'} data-kind={preview.artist.kind||'artist'} style={{left:preview.left,top:preview.top,width:preview.width}} aria-hidden="true"><div className="artist-name-preview-image"><span>{preview.artist.name.slice(0,1)}</span>{preview.artist.image&&<img src={preview.artist.image} alt="" referrerPolicy="no-referrer" onError={event=>{event.currentTarget.style.display='none';}}/>}</div><div className="artist-name-preview-details"><strong>{preview.artist.name}</strong><div className="artist-name-preview-tags"><span className="artist-name-preview-rating">{preview.artist.rating||'A'}</span><span className="artist-name-preview-kind">{preview.artist.kind==='collective'?'Проект':preview.artist.kind==='media'?'Медиа':'Артист'}</span>{previewTags.map((tag,index)=><span key={`${tag}-${index}`}>{tag}</span>)}{(preview.artist.section==='world'||preview.artist.section==='runet')&&<span className="artist-name-preview-region" title={preview.artist.section==='world'?'США':'СССР'}><img src={preview.artist.section==='world'?'./badges/region-en-eagle-cutout.png':'./badges/region-ru-emblem-cutout.png'} alt={preview.artist.section==='world'?'США':'СССР'}/></span>}</div></div></div>,document.body)}
 </>;
}

export default function Atlas({initial}:{initial:Artist[]}){
const [data,setData]=useState(initial),[sections,setSections]=useState<Section[]>(defaultSections),[error,setError]=useState('');
async function refresh(){try{const r=await fetch(catalogUrl,{cache:'no-store'});const d:any=await r.json();if(!r.ok)throw Error(d.error);setData(d.artists);setSections(d.sections);setError('');}catch{setError('Связь с архивом потеряна. Показаны последние доступные досье.');}}
useEffect(()=>{refresh();const onFocus=()=>refresh();window.addEventListener('focus',onFocus);return ()=>window.removeEventListener('focus',onFocus);},[]);
const [section,setSection]=useState('all'),[q,setQ]=useState(''),[view,setView]=useState('names'),[kind,setKind]=useState('all'),[rating,setRating]=useState('all'),[sortMode,setSortMode]=useState<'posting'|'random'>('posting'),[shuffleSeed,setShuffleSeed]=useState(0);
const [deckZoom,setDeckZoom]=useState(1.15);
const changeDeckZoom=(step:number)=>setDeckZoom(current=>Math.round(Math.max(.4,Math.min(1.5,current+step))*100)/100);
const [cardSize,setCardSize]=useState<'sm'|'md'|'lg'>('sm');
const [listSize,setListSize]=useState<'sm'|'md'|'lg'>('sm');
function changeView(next:string){if(next===view)return;setView(next);setCardSize('sm');setListSize('sm');}
const catalogIsDefault=section==='all'&&kind==='all'&&rating==='all'&&!q&&view==='names'&&cardSize==='sm'&&listSize==='sm'&&sortMode==='posting'&&deckZoom===1.15;
function resetCatalog(){
 setSection('all');setKind('all');setRating('all');setQ('');
 setView('names');setCardSize('sm');setListSize('sm');
 setSortMode('posting');setShuffleSeed(0);setDeckZoom(1.15);
}
const matchingArtists=data.filter(a=>(section==='all'||a.section===section)&&(kind==='all'||(a.kind||'artist')===kind)&&(rating==='all'||(a.rating||'A').toUpperCase()===rating)&&(a.name+' '+a.tags+' '+a.description).toLowerCase().includes(q.toLowerCase()));
const sourceOrder=new Map(data.map((artist,index)=>[artist.id,index]));
const artists=[...matchingArtists].sort((a,b)=>sortMode==='posting'?(sourceOrder.get(a.id)!-sourceOrder.get(b.id)!):(orderHash(a.id,shuffleSeed)-orderHash(b.id,shuffleSeed)));
useEffect(()=>{const context=(document as any).modelContext;if(!context?.registerTool)return;const lifecycle=new AbortController();try{Promise.resolve(context.registerTool({name:'filter_artists',description:'Filter the visible artist catalog by name or section.',inputSchema:{type:'object',properties:{query:{type:'string'},section:{type:'string'},kind:{type:'string',enum:['all','artist','media','collective']}},additionalProperties:false},annotations:{readOnlyHint:true},execute(input:any){if(!input||typeof input!=='object'||input.query!==undefined&&typeof input.query!=='string'||input.section!==undefined&&!['all',...sections.map(s=>s.id)].includes(input.section))throw Error('Invalid filter');if(input.kind!==undefined&&!['all','artist','media','collective'].includes(input.kind))throw Error('Invalid kind');setKind(input.kind||'all');setQ(input.query||'');setSection(input.section||'all');return {count:data.filter(a=>(!input.section||input.section==='all'||a.section===input.section)&&(!input.kind||input.kind==='all'||(a.kind||'artist')===input.kind)&&(a.name+' '+a.tags+' '+a.description).toLowerCase().includes((input.query||'').toLowerCase())).length};}},{signal:lifecycle.signal})).catch(()=>{});}catch{}return ()=>lifecycle.abort();},[data,sections]);
return <>
<CommandDeck mode="catalog" total={data.length}/>
<main>
<section className="catalog" id="catalog">{error&&<p className="error" role="alert">{error} <button onClick={refresh}>Восстановить связь</button>
</p>}<div className="catalog-head">
<div className="filters">{[['all','Все досье'],...sections.map(s=>[s.id,s.name])].map(([id,title])=>
<button key={id} className={section===id?'active':''} onClick={()=>setSection(id)}>{title}<sup>{id==='all'?data.length:data.filter(a=>a.section===id).length}</sup>
</button>)}</div>
<button type="button" className="catalog-reset" aria-label="Сбросить настройки каталога" title="Сбросить настройки каталога" disabled={catalogIsDefault} onClick={resetCatalog}><RotateCcw size={18} aria-hidden="true"/></button>
<div className="catalog-view-controls">{view==='grid'&&<div className="catalog-density" role="group" aria-label="Размер карточек">
<span>Размер</span>{(['sm','md','lg'] as const).map(value=><button key={value} type="button" aria-label={`Размер карточек: ${value.toUpperCase()}`} aria-pressed={cardSize===value} onClick={()=>setCardSize(value)}>{value.toUpperCase()}</button>)}
</div>}{view==='list'&&<div className="catalog-density" role="group" aria-label="Размер элементов списка">
<span>Размер</span>{(['sm','md','lg'] as const).map(value=><button key={value} type="button" aria-label={`Размер списка ${value.toUpperCase()}`} aria-pressed={listSize===value} onClick={()=>setListSize(value)}>{value.toUpperCase()}</button>)}
</div>}<div className="catalog-sort-switch"><span>СОРТИРОВКА</span><div className="catalog-sort-options" role="radiogroup" aria-label="Порядок отображения"><label className={sortMode==='random'?'active':''} title="Случайный порядок" onClick={()=>{if(sortMode==='random')setShuffleSeed(Math.floor(Math.random()*0xffffffff));}}><input type="radio" name="catalog-sort" value="random" checked={sortMode==='random'} onChange={()=>{setSortMode('random');setShuffleSeed(Math.floor(Math.random()*0xffffffff));}}/><Shuffle size={18}/><span className="sr-only">Случайный порядок</span></label><label className={sortMode==='posting'?'active':''} title="Порядок публикации"><input type="radio" name="catalog-sort" value="posting" checked={sortMode==='posting'} onChange={()=>setSortMode('posting')}/><ListOrdered size={18}/><span className="sr-only">Порядок публикации</span></label></div></div><div className="view-switch">{[[Type,'names','Имена'],[Grid2X2,'grid','Карточки-досье'],[List,'list','Реестр'],[Network,'map','Тактическая карта'],[Layers3,'deck','Трёхмерная колода']].map(([Icon,id,label]:any)=>
<button key={id} aria-label={label} aria-pressed={view===id} className={view===id?'active':''} onClick={()=>changeView(id)}>
<Icon size={18}/>
</button>)}</div></div>
</div>
<div className="search-row">
<label className="input-search">
<Search size={17}/>
<input aria-label="Поиск записи" placeholder="Поиск" value={q} onChange={e=>setQ(e.target.value)}/>
</label>
<div className="catalog-type-controls">
<div className="catalog-type-radios" role="radiogroup" aria-label="Тип записей">{[['all','Все'],['artist','Артисты'],['media','Медиа'],['collective','Проекты']].map(([id,label])=><label key={id} className={kind===id?'is-active':''}><input type="radio" name="catalog-kind" value={id} checked={kind===id} onChange={()=>setKind(id)}/><span>{label}</span></label>)}</div>
<div className="catalog-tag-filter"><span>ТЕГ</span><div className="catalog-type-radios" role="radiogroup" aria-label="Рейтинг тегов">{[['all','Все'],['A','A'],['AA','AA'],['AAA','AAA'],['AAA+','AAA+']].map(([id,label])=><label key={id} className={rating===id?'is-active':''}><input type="radio" name="catalog-rating" value={id} checked={rating===id} onChange={()=>setRating(id)}/><span>{label}</span></label>)}</div></div>
</div>
 </div>{view==='names'?<ArtistNameFlow artists={artists}/>:view==='map'?<ArtistMap artists={artists} sections={sections}/>:view==='deck'?<>
<div className="deck-toolbar deck-toolbar--canvas"><div className="deck-zoom-controls" role="group" aria-label="Масштаб 3D-колоды"><label htmlFor="deck-zoom">ЗУМ</label><button type="button" aria-label="Уменьшить масштаб 3D-колоды" disabled={deckZoom<=.4} onClick={()=>changeDeckZoom(-.1)}><ZoomOut size={18}/></button><input id="deck-zoom" type="range" min="40" max="150" step="5" value={Math.round(deckZoom*100)} onChange={event=>setDeckZoom(Number(event.target.value)/100)} aria-label="Масштаб 3D-колоды"/><output htmlFor="deck-zoom" aria-live="polite">{Math.round(deckZoom*100)}%</output><button type="button" aria-label="Увеличить масштаб 3D-колоды" disabled={deckZoom>=1.5} onClick={()=>changeDeckZoom(.1)}><ZoomIn size={18}/></button></div></div>
<ArtistCanvasDeck artists={artists} zoom={deckZoom} onZoomStep={changeDeckZoom}/>
</>:<div className={view==='list'?'artist-list':'artist-grid'} data-size={view==='grid'?cardSize:listSize}>{artists.map((a,i)=>
<article className="artist-card" data-rating={a.rating||'A'} data-kind={a.kind||'artist'} data-section={a.section} style={dossierFinish(a.id)} key={a.id}>
<div className={'art art-'+i%8}>
<span className="art-index">{String(i+1).padStart(3,'0')}</span>
<div className="missing-avatar" role="img" aria-label="Аватарка отсутствует">
<span aria-hidden="true">×</span>
</div>{a.image&&<img src={a.image} alt={a.name} loading="lazy" draggable={false} referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.display="none";}}/>}{view!=='list'&&(a.kind==='collective'?<span className="record-type record-type--avatar"><UsersRound size={13} aria-hidden="true"/><span className="record-type-label">Проект</span></span>:a.kind==='media'?<span className="record-type record-type--avatar"><Radio size={13} aria-hidden="true"/><span className="record-type-label">Медиа</span></span>:null)}{view!=='list'&&<span className="art-badges">
<span className={`rating-tag rating-${(a.rating||'A').toLowerCase()}`}>{a.rating||'A'}</span>
</span>}
{showLocalAdmin&&view==='grid'&&<a className="card-edit card-edit--image" aria-label={"Редактировать "+a.name} href={adminUrl+"/?edit="+encodeURIComponent(a.id)+"#catalog"}><Pencil size={15}/></a>}
<span className="art-platform-tag" aria-hidden="true"><span className="platform-full">{a.platform}</span><span className="platform-short">{a.platform==='Instagram'?'IG':a.platform==='Telegram'?'TG':a.platform.slice(0,2)}</span><ArrowUpRight size={13}/></span>
</div>
<div className="card-info">
{(a.section==='world'||a.section==='runet')&&<img className="region-watermark" src={a.section==='world'?'./badges/region-en-eagle-cutout.png':'./badges/region-ru-emblem-cutout.png'} alt="" aria-hidden="true" loading="lazy" decoding="async"/>}
<div>
<h2 aria-label={a.name}>
{view==='grid'?<ArtistTicker name={a.name}/>:<ArtistName name={a.name} fitToCard={false}/>}
</h2>{view==='list'&&<div className="list-tags"><span className="list-rating-tag">{a.rating||'A'}</span>{a.kind==='collective'?<span className="list-kind-tag"><UsersRound size={11} aria-hidden="true"/>Проект</span>:a.kind==='media'?<span className="list-kind-tag"><Radio size={11} aria-hidden="true"/>Медиа</span>:null}</div>}{view!=='list'&&<p>
<span className="artist-social">{a.platform} <ArrowUpRight size={14}/>
</span>
{a.kind==='collective'?<span className="list-kind-tag"><UsersRound size={11} aria-hidden="true"/>Проект</span>:a.kind==='media'?<span className="list-kind-tag"><Radio size={11} aria-hidden="true"/>Медиа</span>:null}
</p>}
</div></div>
{view!=='deck'&&<a className="card-hit-area" href={a.url} target="_blank" rel="noopener noreferrer" aria-label={"Открыть источник: "+a.name}/>}
{showLocalAdmin&&view!=='grid'&&<a className="card-edit" aria-label={"Редактировать "+a.name} href={adminUrl+"/?edit="+encodeURIComponent(a.id)+"#catalog"}><Pencil size={15}/></a>}
</article>)}</div>}{!artists.length&&view!=='deck'&&<p className="empty">Сигнал не обнаружен. Измените запрос или фильтр.</p>}</section>
</main>
<ToyotaFooter/>
</>;
}
