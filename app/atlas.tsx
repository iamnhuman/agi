'use client';
import {Fragment,useState,useEffect,useRef,type PointerEvent} from 'react';
import {catalogUrl,adminUrl,showLocalAdmin} from '@/client/config';
import ArtistMap from './artist-map';
import {defaultSections,type Artist,type Section} from '@/lib/types';
import {ArrowUpRight, Search, Grid2X2, List, Network, Layers3, Pencil, Radio, UsersRound, ZoomIn, ZoomOut, Shuffle, ListOrdered, RotateCcw} from 'lucide-react';
import {Runner,vhs} from '@vysmo/effects';
import CommandDeck from '@/client/command-deck';

const cuneiformGlyphs=[
  ...Array.from({length:96},(_,index)=>String.fromCodePoint(0x12000+index)),
  ...Array.from({length:24},(_,index)=>String.fromCodePoint(0x12400+index)),
];
const titleGlitchGlyphs=Array.from('電機信号光影未来空夢人工界零壊警報乱終始炎月星龍真偽視覚網路時間東京異常システム破損検出');
const signalCorruptionGlyphs=[...titleGlitchGlyphs,...cuneiformGlyphs,...Array.from('ᚠᚷᛉᛟ⟡⌬⟁⧖⍟⊗∆')];
const signalFontStacks=[
  "'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif",
  "'Yu Mincho','Hiragino Mincho ProN',serif",
  "Meiryo,'Yu Gothic',sans-serif",
  "'MS Gothic','Osaka-Mono',monospace",
  "'MS Mincho','Yu Mincho',serif",
  "'Noto Sans JP','Noto Sans CJK JP',sans-serif",
  "'Noto Serif JP','Noto Serif CJK JP',serif",
  "Impact,'Arial Black','Yu Gothic',sans-serif",
  "'Courier New','MS Gothic',monospace",
  "Georgia,'Yu Mincho',serif",
] as const;
let signalSessionNumber=0;
function createSignalScript(){
 const session=(++signalSessionNumber).toString(16).padStart(4,'0');
 const random=(max:number)=>Math.floor(Math.random()*max);
 const pick=<T,>(items:readonly T[])=>items[random(items.length)];
 const hex=(length:number)=>Array.from({length},()=>random(16).toString(16)).join('');
 const sector=String(random(12)+1).padStart(2,'0');
 const shard=String(random(8)+1).padStart(2,'0');
 const node=pick(['ghost-13','proxy-07','icebox-02','root-node']);
 const channel=pick(['sandbox','vault','relay','blackbox']);
 const block=`0x${hex(4).toUpperCase()}`;
 const digest=hex(8);
 const latency=(8+random(120)/10).toFixed(1);
 const events=12000+random(68000);
 const routines=[
  [
   `$ ghostctl exploit --vector=sim-rce --target=${node}`,
   `const payload = Buffer.from("${digest}", "hex");`,
   `await inject(payload, "sandbox://${node}");`,
   `> payload staged; root shell denied [SIM]`,
  ],
  [
   `$ ghostctl crack --hash=${digest} --mode=offline-sim`,
   `> keyspace=${events} candidates; salt=${block}`,
   `const token = await hashProbe("${node}", digest);`,
   `> credential match: decoy // sandbox`,
  ],
  [
   `$ ghostctl bypass --firewall=${sector} --dry-run`,
   `> rule ${sector} mapped; egress=locked`,
   `const route = await tunnel("proxy://${node}", "${channel}");`,
   `> pivot staged; remote writes=0 [SIM]`,
  ],
 ];
 const selected=routines.splice(random(routines.length),1)[0];
 const followUp=pick(routines);
 return [
  `$ ghostctl recon ${node} --ports=sim --stealth`,
  `> ports 22/443/8080 mapped; honeypot=${random(2)}`,
  `const session = await proxy.route("${node}", "relay://ghost");`,
  `> tunnel sealed; fingerprint=${hex(6)} (${latency}ms)`,
  ...selected,
  ...followUp,
  `$ ghostctl exfil --target=${node} --sink=blackbox://sim`,
  `> ${events} bytes sealed; checksum=${hex(8)}`,
  `$ ghostctl cleanup --session=${session} --dry-run`,
  `> traces scrubbed; host writes=0 // SIM`,
 ];
}
type SignalConsoleState={lines:string[];line:number;chars:number;pause:number};
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
function signalHash(value:number){
 value=Math.imul(value^(value>>>16),0x45d9f3b);
 value=Math.imul(value^(value>>>16),0x45d9f3b);
 return (value^(value>>>16))>>>0;
}
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
function zalgoSignal(tick:number,layer=0){return Array.from('信号が破損しました',(letter,index)=>{
  const seed=tick*11+index*17+layer*23;
  const broken=seed%(layer===0?8:4)===0;
  const jump=seed%(layer===0?3:4)===0;
  const x=jump?((seed%13)-6)*(layer===0?1:1.5):0;
  const y=jump?(((seed+index)%9)-4)*(layer===0?.5:1):0;
  const glyph=broken?(layer===0?titleGlitchGlyphs[seed%titleGlitchGlyphs.length]:signalCorruptionGlyphs[seed%signalCorruptionGlyphs.length]):letter;
  return <span key={index} className="zalgo-glyph" style={{transform:`translate(${x}px,${y}px)`}}>{glyph}</span>;
});}
function signalFont(tick:number){const seed=Math.imul(tick+37,1103515245)^(tick*2654435761);return signalFontStacks[(seed>>>0)%signalFontStacks.length];}

function SignalRain({active}:{active:boolean}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  if(!active||!ref.current)return;
  const canvas=ref.current,source=document.createElement('canvas'),context=source.getContext('2d');
  if(!context)return;
  let runner:Runner|null=null;
  try{runner=new Runner({canvas,contextAttributes:{alpha:true,premultipliedAlpha:false}});}catch{}
  const fallback=runner?null:canvas.getContext('2d');
  const cellWidth=16,cellHeight=20;
  const kana=Array.from('アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン');
  const kanji=Array.from('信号電光未来断片夢影機界壊警報空網路炎星龍真偽視覚記録通信回路秘密変換転送');
  const marks=Array.from('⌁⌑⌖⌗⌘⌬⍟⎔⟁⊗╳∴≋≡<>/\\|:;');
  const letters=Array.from('ABCDEFGHJKLMNPRSTUVWXYZ');
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let width=0,height=0,columns=0,rows=0,frame=0,lastFrame=0;
  const resize=()=>{
   width=window.innerWidth;height=window.innerHeight;
   const scale=Math.min(window.devicePixelRatio||1,1.5);
   source.width=canvas.width=Math.ceil(width*scale);source.height=canvas.height=Math.ceil(height*scale);
   context.setTransform(scale,0,0,scale,0,0);
   fallback?.setTransform(scale,0,0,scale,0,0);
   columns=Math.ceil(width/cellWidth);rows=Math.ceil(height/cellHeight);
  };
  const draw=(time:number)=>{
   frame=window.requestAnimationFrame(draw);
   if(document.visibilityState!=='visible'||time-lastFrame<32)return;
   lastFrame=time;
   context.clearRect(0,0,width,height);
   context.font='700 13px ui-monospace, SFMono-Regular, Menlo, monospace';
   context.textAlign='center';context.textBaseline='middle';
   for(let column=0;column<columns;column++){
    const lane=signalHash(Math.imul(column+1,0x9e3779b1));
    if(lane%11===0)continue;
    for(let stream=0;stream<(lane%3===0?2:1);stream++){
     const seed=signalHash(lane^Math.imul(stream+1,0x85ebca6b));
     const trail=stream?10+seed%12:19+seed%24;
     const speed=stream?5+seed%6:8+seed%13;
     const cycle=rows+trail+8+seed%22;
     const head=(time*.001*speed+seed%cycle)%cycle-trail;
     const glyphFrame=Math.floor(time/(85+seed%5*24));
     const x=column*cellWidth+cellWidth/2;
     const beam=lane%4===0||stream===1;
     if(beam&&head>0){
      const beamTop=Math.max(0,(head-trail)*cellHeight);
      const beamBottom=Math.min(height,(head+1)*cellHeight);
      const horizon=Math.min(1,Math.max(0,(head/rows-.35)/.55));
      const glow=context.createLinearGradient(x,beamTop,x,beamBottom);
      glow.addColorStop(0,'#e72b4000');
      glow.addColorStop(.64,`rgba(255,69,70,${.12+horizon*.2})`);
      glow.addColorStop(1,`rgba(255,232,183,${.28+horizon*.62})`);
      context.fillStyle=glow;
      context.fillRect(x-(stream?3:4),beamTop,stream?6:8,beamBottom-beamTop);
      context.fillStyle=`rgba(255,240,200,${.2+horizon*.48})`;
      context.fillRect(x-1.5,Math.max(0,beamTop+trail*cellHeight*.42),3,Math.max(0,beamBottom-beamTop-trail*cellHeight*.42));
     }
     for(let step=0;step<trail;step++){
      const row=Math.floor(head)-step;
      if(row<0||row>=rows)continue;
      const mixed=signalHash(Math.imul(column+1,0x27d4eb2d)^Math.imul(row+1,0x165667b1)^Math.imul(glyphFrame+1,0x9e3779b1)^seed);
      const pool=mixed%12<7?kana:mixed%12<10?kanji:mixed%12===10?marks:letters;
      const glyph=pool[signalHash(mixed^0x85ebca6b)%pool.length];
      const fade=1-step/trail;
      const horizon=Math.min(1,Math.max(0,(row/rows-.4)/.5));
      context.globalAlpha=(stream?.56:.9)*(.16+fade*.84)*(mixed%13===0?.35:1);
      context.fillStyle=step===0?'#fff0cb':step<4&&horizon>.3?'#ffbd9c':step<9?'#ff6673':'#d92a47';
      context.fillText(glyph,x,row*cellHeight+cellHeight/2);
      if(step===0&&beam){
       context.globalAlpha=.4+horizon*.45;
       context.fillStyle='#fff0cf';
       context.fillRect(x-3,row*cellHeight+cellHeight/2-2,6,3);
      }
     }
    }
   }
   context.globalAlpha=1;
   if(runner)runner.render(vhs,{source,params:{intensity:.88,seed:reduceMotion?0:Math.floor(time/48)}});
   else if(fallback){fallback.clearRect(0,0,width,height);fallback.drawImage(source,0,0,width,height);}
  };
  resize();window.addEventListener('resize',resize);
  frame=window.requestAnimationFrame(draw);
  return()=>{window.cancelAnimationFrame(frame);window.removeEventListener('resize',resize);runner?.dispose();};
 },[active]);
 return <canvas ref={ref} className="signal-rain" aria-hidden="true"/>;
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
   screen.style.removeProperty('--ticker-font-size');
   const available=screen.clientWidth-12;
   if(available<=0)return;
   const preferred=parseFloat(getComputedStyle(copy).fontSize);
   const range=document.createRange();
   range.selectNodeContents(copy);
   const required=range.getBoundingClientRect().width;
   if(!required||!preferred)return;
   const minimum=Math.max(11,preferred*.78);
   const size=required>available
    ?Math.max(minimum,Math.floor(preferred*available/required*10)/10)
    :preferred;
   const repeatWidth=required*size/preferred+size*1.2;
   screen.style.setProperty('--ticker-font-size',`${size}px`);
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
 const [signalOpen,setSignalOpen]=useState(false),[signalTick,setSignalTick]=useState(0);
 const [consoleState,setConsoleState]=useState<SignalConsoleState>({lines:[],line:0,chars:0,pause:0});
 useEffect(()=>{if(!signalOpen)return;const timer=window.setInterval(()=>{if(document.visibilityState==='visible')setSignalTick(tick=>(tick+4)%40960);},64);return()=>window.clearInterval(timer);},[signalOpen]);
 useEffect(()=>{
  if(!signalOpen)return;
  setConsoleState({lines:createSignalScript(),line:0,chars:0,pause:0});
  const timer=window.setInterval(()=>setConsoleState(current=>{
   if(document.visibilityState!=='visible'||!current.lines.length)return current;
   const text=current.lines[current.line];
   if(current.chars<text.length)return {...current,chars:current.chars+1};
   const finalLine=current.line===current.lines.length-1;
   const pauseLimit=finalLine?28:5;
   if(current.pause<pauseLimit)return {...current,pause:current.pause+1};
   return finalLine?{lines:createSignalScript(),line:0,chars:0,pause:0}:{...current,line:current.line+1,chars:0,pause:0};
  }),28);
  return()=>window.clearInterval(timer);
 },[signalOpen]);
 const fontTick=Math.floor(signalTick/40);
 const firstConsoleLine=Math.max(0,consoleState.line-7);
 const consoleLines=consoleState.lines.slice(firstConsoleLine,consoleState.line+1);
 return <footer><div className="manifesto" data-open={signalOpen} onPointerLeave={event=>{if(event.pointerType==='mouse')setSignalOpen(false);}} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setSignalOpen(false);}}>
  <div id="toyota-transmission" className="manifesto-transmission" aria-hidden={!signalOpen}>
   <SignalRain active={signalOpen}/>
   <div className="manifesto-interference">
    <div className="signal-console-title">ROOTKIT://GHOST_SESSION <b>EXPLOIT SIM // SANDBOXED</b></div>
    <div className="signal-console-body">
     <div className="signal-console-log">{consoleLines.map((fragment,i)=>{const lineIndex=firstConsoleLine+i;const active=lineIndex===consoleState.line;return <span className={active?'console-line is-active':'console-line'} key={`${lineIndex}-${active?'active':'done'}`}>{active?fragment.slice(0,consoleState.chars):fragment}</span>;})}</div>
     <div className="signal-skull-block"><div>TARGET NODE // {`0x01F4`}</div><pre>{signalSkull}</pre><div>ROOT ACCESS SIMULATED</div></div>
    </div>
   </div>
   <div className="manifesto-zalgo" aria-hidden="true" style={{fontFamily:signalFont(fontTick)}}><span className="zalgo-layer">{zalgoSignal(Math.floor(signalTick/3))}</span><span className="zalgo-layer">{zalgoSignal(Math.floor(signalTick/3)+3,1)}</span><span className="zalgo-layer">{zalgoSignal(Math.floor(signalTick/3)+7,2)}</span></div>
  </div>
  <button type="button" className="toyota-mark" aria-label="Toyota: показать сигнал" aria-controls="toyota-transmission" aria-expanded={signalOpen} onPointerEnter={event=>{if(event.pointerType==='mouse')setSignalOpen(true);}} onKeyDown={event=>{if(event.key==='Escape')setSignalOpen(false);}} onClick={()=>{if(window.matchMedia('(hover: none)').matches)setSignalOpen(open=>!open);else setSignalOpen(true);}}><svg viewBox="0 0 240 160" aria-hidden="true"><ellipse cx="120" cy="70" rx="106" ry="61"/><ellipse cx="120" cy="55" rx="56" ry="22"/><ellipse cx="120" cy="64" rx="27" ry="53"/></svg><span>TOYOTA</span></button>
 </div></footer>;
}

export default function Atlas({initial}:{initial:Artist[]}){
const [data,setData]=useState(initial),[sections,setSections]=useState<Section[]>(defaultSections),[error,setError]=useState('');
async function refresh(){try{const r=await fetch(catalogUrl,{cache:'no-store'});const d:any=await r.json();if(!r.ok)throw Error(d.error);setData(d.artists);setSections(d.sections);setError('');}catch{setError('Связь с архивом потеряна. Показаны последние доступные досье.');}}
useEffect(()=>{refresh();const onFocus=()=>refresh();window.addEventListener('focus',onFocus);return ()=>window.removeEventListener('focus',onFocus);},[]);
const [section,setSection]=useState('all'),[q,setQ]=useState(''),[view,setView]=useState('grid'),[kind,setKind]=useState('all'),[rating,setRating]=useState('all'),[sortMode,setSortMode]=useState<'posting'|'random'>('posting'),[shuffleSeed,setShuffleSeed]=useState(0);
const deckRef=useRef<HTMLDivElement|null>(null);
const [deckZoom,setDeckZoom]=useState(1);
const deckDrag=useRef<{pointerId:number;startX:number;scrollLeft:number;active:boolean}|null>(null);
const suppressDeckClick=useRef(false);
const changeDeckZoom=(step:number)=>setDeckZoom(current=>Math.round(Math.max(.4,Math.min(1.5,current+step))*100)/100);
useEffect(()=>{if(view!=='deck'||!deckRef.current)return;const deck=deckRef.current;const onWheel=(event:WheelEvent)=>{
 if(event.ctrlKey||event.metaKey){event.preventDefault();changeDeckZoom(event.deltaY<0?.1:-.1);return;}
 const axis=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;
 const unit=event.deltaMode===1?16:event.deltaMode===2?deck.clientWidth:1;
 const limit=deck.scrollWidth-deck.clientWidth;
 if(!axis||limit<=0)return;
 const next=Math.max(0,Math.min(limit,deck.scrollLeft+axis*unit));
 if(Math.abs(next-deck.scrollLeft)<.5)return;
 event.preventDefault();deck.scrollLeft=next;
};deck.addEventListener('wheel',onWheel,{passive:false});return ()=>deck.removeEventListener('wheel',onWheel);},[view]);
function startDeckDrag(event:PointerEvent<HTMLDivElement>){if(event.pointerType!=='mouse'||event.button!==0)return;deckDrag.current={pointerId:event.pointerId,startX:event.clientX,scrollLeft:event.currentTarget.scrollLeft,active:false};}
function moveDeckDrag(event:PointerEvent<HTMLDivElement>){const drag=deckDrag.current;if(!drag||drag.pointerId!==event.pointerId)return;if(!drag.active){if(Math.abs(event.clientX-drag.startX)<6)return;drag.active=true;event.currentTarget.setPointerCapture(event.pointerId);event.currentTarget.dataset.dragging='true';}event.preventDefault();event.currentTarget.scrollLeft=drag.scrollLeft+drag.startX-event.clientX;}
function stopDeckDrag(event:PointerEvent<HTMLDivElement>){const drag=deckDrag.current;if(!drag||drag.pointerId!==event.pointerId)return;if(drag.active){suppressDeckClick.current=true;delete event.currentTarget.dataset.dragging;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);requestAnimationFrame(()=>{suppressDeckClick.current=false;});}deckDrag.current=null;}
const [cardSize,setCardSize]=useState<'sm'|'md'|'lg'>('sm');
const [listSize,setListSize]=useState<'sm'|'md'|'lg'>('sm');
function changeView(next:string){if(next===view)return;setView(next);setCardSize('sm');setListSize('sm');}
const catalogIsDefault=section==='all'&&kind==='all'&&rating==='all'&&!q&&view==='grid'&&cardSize==='sm'&&listSize==='sm'&&sortMode==='posting'&&deckZoom===1;
function resetCatalog(){
 setSection('all');setKind('all');setRating('all');setQ('');
 setView('grid');setCardSize('sm');setListSize('sm');
 setSortMode('posting');setShuffleSeed(0);setDeckZoom(1);
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
</div>}<div className="catalog-sort-switch"><span>СОРТИРОВКА</span><div className="catalog-sort-options" role="radiogroup" aria-label="Порядок отображения"><label className={sortMode==='random'?'active':''} title="Случайный порядок" onClick={()=>{if(sortMode==='random')setShuffleSeed(Math.floor(Math.random()*0xffffffff));}}><input type="radio" name="catalog-sort" value="random" checked={sortMode==='random'} onChange={()=>{setSortMode('random');setShuffleSeed(Math.floor(Math.random()*0xffffffff));}}/><Shuffle size={18}/><span className="sr-only">Случайный порядок</span></label><label className={sortMode==='posting'?'active':''} title="Порядок публикации"><input type="radio" name="catalog-sort" value="posting" checked={sortMode==='posting'} onChange={()=>setSortMode('posting')}/><ListOrdered size={18}/><span className="sr-only">Порядок публикации</span></label></div></div><div className="view-switch">{[[Grid2X2,'grid','Карточки-досье'],[List,'list','Реестр'],[Network,'map','Тактическая карта'],[Layers3,'deck','Трёхмерная колода']].map(([Icon,id,label]:any)=>
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
 </div>{view==='map'?<ArtistMap artists={artists} sections={sections}/>:<>{view==='deck'&&<div className="deck-toolbar"><span>КОЛОДА · колесо / перетягивание · Ctrl/⌘ + колесо — зум</span><div className="deck-zoom-controls" role="group" aria-label="Масштаб 3D-колоды"><label htmlFor="deck-zoom">ЗУМ</label><button type="button" aria-label="Уменьшить масштаб 3D-колоды" disabled={deckZoom<=.4} onClick={()=>changeDeckZoom(-.1)}><ZoomOut size={18}/></button><input id="deck-zoom" type="range" min="40" max="150" step="5" value={Math.round(deckZoom*100)} onChange={event=>setDeckZoom(Number(event.target.value)/100)} aria-label="Масштаб 3D-колоды"/><output htmlFor="deck-zoom" aria-live="polite">{Math.round(deckZoom*100)}%</output><button type="button" aria-label="Увеличить масштаб 3D-колоды" disabled={deckZoom>=1.5} onClick={()=>changeDeckZoom(.1)}><ZoomIn size={18}/></button></div></div>}<div ref={deckRef} className={view==='list'?'artist-list':view==='deck'?'artist-grid artist-deck':'artist-grid'} data-size={view==='grid'?cardSize:view==='list'?listSize:undefined} style={view==='deck'?{'--deck-zoom':deckZoom} as React.CSSProperties:undefined} aria-label={view==='deck'?'Горизонтальная 3D-колода досье':undefined} tabIndex={view==='deck'?0:undefined} onPointerDown={view==='deck'?startDeckDrag:undefined} onPointerMove={view==='deck'?moveDeckDrag:undefined} onPointerUp={view==='deck'?stopDeckDrag:undefined} onPointerCancel={view==='deck'?stopDeckDrag:undefined} onClickCapture={view==='deck'?event=>{if(suppressDeckClick.current){event.preventDefault();event.stopPropagation();suppressDeckClick.current=false;}}:undefined} onDragStart={view==='deck'?event=>event.preventDefault():undefined} onKeyDown={view==='deck'?event=>{if(event.key==='+'||event.key==='='){event.preventDefault();changeDeckZoom(.1);}else if(event.key==='-'){event.preventDefault();changeDeckZoom(-.1);}}:undefined}>{artists.map((a,i)=>
<article className="artist-card" data-rating={a.rating||'A'} data-kind={a.kind||'artist'} data-section={a.section} style={dossierFinish(a.id)} key={a.id}>
<div className={'art art-'+i%8}>
<span className="art-index">{String(i+1).padStart(3,'0')}</span>
<div className="missing-avatar" role="img" aria-label="Аватарка отсутствует">
<span aria-hidden="true">×</span>
</div>{a.image&&<img src={a.image} alt={a.name} loading="lazy" draggable={false} referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.display="none";}}/>}{view!=='list'&&(a.kind==='collective'?<span className="record-type record-type--avatar"><UsersRound size={13} aria-hidden="true"/> Проект</span>:a.kind==='media'?<span className="record-type record-type--avatar"><Radio size={13} aria-hidden="true"/> Медиа</span>:null)}{view!=='list'&&<span className="art-badges">
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
</article>)}</div></>}{!artists.length&&<p className="empty">Сигнал не обнаружен. Измените запрос или фильтр.</p>}</section>
</main>
<ToyotaFooter/>
</>;
}
