'use client';

import {useEffect,useRef} from 'react';
import {Pencil} from 'lucide-react';
import {adminUrl,showLocalAdmin} from '@/client/config';
import type {Artist} from '@/lib/types';

const vertexSource=`#version 300 es
precision highp float;
uniform vec3 uCenter;
uniform vec2 uSize;
uniform float uAspect;
uniform float uYaw;
uniform float uPitch;
uniform float uRoll;
uniform vec2 uResolution;
out vec2 vUv;
const vec2 corners[6]=vec2[6](
 vec2(-1.,-1.),vec2(1.,-1.),vec2(-1.,1.),
 vec2(-1.,1.),vec2(1.,-1.),vec2(1.,1.)
);
void main(){
 vec2 corner=corners[gl_VertexID];
 vUv=(corner+1.)*.5;
 vec3 p=vec3(corner*uSize,0.);
 float pitchY=p.y*cos(uPitch)-p.z*sin(uPitch);
 float pitchZ=p.y*sin(uPitch)+p.z*cos(uPitch);
 p.y=pitchY;p.z=pitchZ;
 float yawX=p.x*cos(uYaw)+p.z*sin(uYaw);
 float yawZ=-p.x*sin(uYaw)+p.z*cos(uYaw);
 p.x=yawX;p.z=yawZ;
 p.xy=mat2(cos(uRoll),sin(uRoll),-sin(uRoll),cos(uRoll))*p.xy;
 p+=uCenter;
 float perspective=5.35/max(3.2,6.-p.z);
 vec2 projected=vec2(p.x*perspective/uAspect,p.y*perspective);
 projected=floor(projected*uResolution*.5+.5)/(uResolution*.5);
 gl_Position=vec4(projected,0.,1.);
}`;

const cardFragmentSource=`#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTexture;
uniform vec3 uAccent;
uniform float uYaw;
uniform float uFocus;
uniform int uPass;
out vec4 outColor;
void main(){
 if(uPass==0){
  outColor=vec4(0.,0.,0.,.75);
  return;
 }
 vec2 size=vec2(textureSize(uTexture,0));
 vec2 pixel=floor(vUv*size);
 vec4 paper=texture(uTexture,(pixel+.5)/size);
 if(paper.a<.015)discard;
 vec2 edge=min(pixel,size-1.-pixel);
 float facing=.9+.1*cos(uYaw);
 vec3 color=paper.rgb*facing;
 if(uFocus>.5){
  bool bracket=(edge.x<4.&&edge.y<17.)||(edge.y<4.&&edge.x<17.);
  if(bracket)color=vec3(.98,.83,.34);
  if(pixel.x>13.&&pixel.x<178.&&pixel.y>20.&&pixel.y<30.)color=mix(color,uAccent,.12);
 }
 outColor=vec4(color,paper.a);
}`;

const backgroundVertexSource=`#version 300 es
precision highp float;
const vec2 corners[6]=vec2[6](
 vec2(-1.,-1.),vec2(1.,-1.),vec2(-1.,1.),
 vec2(-1.,1.),vec2(1.,-1.),vec2(1.,1.)
);
out vec2 vUv;
void main(){vec2 p=corners[gl_VertexID];vUv=(p+1.)*.5;gl_Position=vec4(p,0.,1.);}`;

const backgroundFragmentSource=`#version 300 es
precision highp float;
in vec2 vUv;
uniform float uMotion;
uniform vec2 uResolution;
out vec4 outColor;
void main(){
 vec2 pixel=floor(vUv*uResolution);
 vec2 tile=mod(pixel+vec2(floor(uMotion*4.),0.),32.);
 bool seam=tile.x<1.||tile.y<1.;
 float grain=mod(pixel.x+pixel.y*3.,4.);
 vec3 color=vec3(.047,.057,.046);
 if(grain<1.)color+=vec3(.012);
 if(seam)color=vec3(.025,.035,.027);
 if(tile.x==1.||tile.y==1.)color+=vec3(.01);
 outColor=vec4(color,1.);
}`;

function shader(gl:WebGL2RenderingContext,type:number,source:string){
 const compiled=gl.createShader(type);
 if(!compiled)throw Error('Shader unavailable');
 gl.shaderSource(compiled,source);gl.compileShader(compiled);
 if(!gl.getShaderParameter(compiled,gl.COMPILE_STATUS)){const reason=gl.getShaderInfoLog(compiled);gl.deleteShader(compiled);throw Error(reason||'Shader compile failed');}
 return compiled;
}

function program(gl:WebGL2RenderingContext,vertex:string,fragment:string){
 const result=gl.createProgram();
 if(!result)throw Error('WebGL program unavailable');
 const vs=shader(gl,gl.VERTEX_SHADER,vertex),fs=shader(gl,gl.FRAGMENT_SHADER,fragment);
 gl.attachShader(result,vs);gl.attachShader(result,fs);gl.linkProgram(result);
 gl.deleteShader(vs);gl.deleteShader(fs);
 if(!gl.getProgramParameter(result,gl.LINK_STATUS)){const reason=gl.getProgramInfoLog(result);gl.deleteProgram(result);throw Error(reason||'WebGL link failed');}
 return result;
}

function accentFor(artist:Artist):[number,number,number]{
 if(artist.rating==='AAA+')return [.6,.8,.4];
 if(artist.rating==='AAA')return [.95,.77,.35];
 if(artist.rating==='AA')return [.72,.61,.82];
 return [.9,.45,.35];
}

const cardWidth=192,cardHeight=272;
const bayer4=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];

type CardTypography={name:number;meta:number;rating:number;header:number};
const typographyKey=(type:CardTypography)=>`${type.name}:${type.meta}:${type.rating}:${type.header}`;

function rasterPortrait(image:HTMLImageElement,portraitHeight:number){
 const portrait=document.createElement('canvas');portrait.width=80;portrait.height=portraitHeight;
 const context=portrait.getContext('2d');if(!context)return portrait;
 const scale=Math.max(portrait.width/image.naturalWidth,portrait.height/image.naturalHeight);
 const width=image.naturalWidth*scale,height=image.naturalHeight*scale;
 context.drawImage(image,(portrait.width-width)/2,(portrait.height-height)/2,width,height);
 const pixels=context.getImageData(0,0,portrait.width,portrait.height);
 // An eight-bit palette combines a 6 × 6 × 6 RGB cube and a 40-step grey ramp.
 // Neutral tones use the ramp so white fur and faces do not become checkerboards.
 for(let y=0;y<portrait.height;y++)for(let x=0;x<portrait.width;x++){
  const offset=(y*portrait.width+x)*4;
  const luminance=pixels.data[offset]*.299+pixels.data[offset+1]*.587+pixels.data[offset+2]*.114;
  const threshold=(bayer4[(y%4)*4+x%4]-7.5)*2.2;
  const values=[0,1,2].map(channel=>Math.max(0,Math.min(255,(pixels.data[offset+channel]*.86+luminance*.14-128)*1.08+128+threshold)));
  const cube=values.map(value=>Math.round(value/51)*51);
  const grey=Math.round(Math.round(values.reduce((sum,value)=>sum+value,0)/3/255*39)*255/39);
  const cubeError=values.reduce((sum,value,channel)=>sum+(value-cube[channel])**2,0);
  const greyError=values.reduce((sum,value)=>sum+(value-grey)**2,0);
  for(let channel=0;channel<3;channel++)pixels.data[offset+channel]=greyError<cubeError?grey:cube[channel];
  pixels.data[offset+3]=255;
 }
 context.putImageData(pixels,0,0);
 return portrait;
}

function cardBitmap(artist:Artist,index:number,type:CardTypography,image?:HTMLImageElement){
 const canvas=document.createElement('canvas');canvas.width=cardWidth;canvas.height=cardHeight;
 const context=canvas.getContext('2d');if(!context)return canvas;
 context.imageSmoothingEnabled=false;
 const [r,g,b]=accentFor(artist);
 const accent=`rgb(${Math.round(r*255)} ${Math.round(g*255)} ${Math.round(b*255)})`;
 const accentDim=`rgb(${Math.round(r*185)} ${Math.round(g*185)} ${Math.round(b*185)})`;
 const accentBright=`rgb(${Math.round((r*.8+.2)*255)} ${Math.round((g*.8+.2)*255)} ${Math.round((b*.8+.2)*255)})`;
 const signalBars=artist.rating==='AAA+'?9:artist.rating==='AAA'?7:artist.rating==='AA'?5:3;
 const lineHeight=type.name+3;
 const labelHeight=Math.max(62,22+lineHeight*2+Math.max(type.meta,type.rating));
 const labelTop=258-labelHeight,imageHeight=labelTop-52;
 const rect=(x:number,y:number,width:number,height:number,color:string)=>{context.fillStyle=color;context.fillRect(x,y,width,height);};
 const bevel=(x:number,y:number,width:number,height:number,fill:string,light:string,dark:string)=>{
  rect(x,y,width,height,fill);rect(x,y,width,2,light);rect(x,y,2,height,light);
  rect(x,y+height-2,width,2,dark);rect(x+width-2,y,2,height,dark);
 };
 const text=(value:string,x:number,y:number,size=8,color='#e8dfb6',align:CanvasTextAlign='left')=>{
  context.font=`${size}px "Press Start 2P",monospace`;context.textAlign=align;
  context.fillStyle='#080b07';context.fillText(value,x+1,y+1);
  context.fillStyle=color;context.fillText(value,x,y);
 };
 context.save();context.beginPath();
 for(const [x,y] of [[4,0],[188,0],[188,4],[192,4],[192,268],[188,268],[188,272],[4,272],[4,268],[0,268],[0,4],[4,4]])context.lineTo(x,y);
 context.closePath();context.clip();
 rect(0,0,192,272,'#10130e');
 bevel(2,2,188,268,'#454b3e','#91977d','#1b2116');
 bevel(6,6,180,260,'#363e30','#59654b','#0c100a');
 // Small, discrete metal pixels rather than a translucent screen filter.
 for(let y=8;y<264;y+=3)for(let x=8;x<184;x+=3){
  rect(x,y,1,1,(x*7+y*11)%5<2?'#3e4836':'#2b3426');
 }
 bevel(12,12,168,22,'#7d281e','#bd5944','#381710');
 text(`ДОСЬЕ ${String(index+1).padStart(3,'0')}`,18,28,type.header);
 bevel(156,19,6,6,accentDim,accent,'#242018');
 bevel(166,19,6,6,accent,accentBright,'#242018');
 bevel(12,40,168,imageHeight+8,'#10180f','#141b0f','#81896d');
 rect(16,44,160,imageHeight,'#080e07');
 if(image&&image.naturalWidth>0){
  context.drawImage(rasterPortrait(image,Math.round(imageHeight/2)),16,44,160,imageHeight);
 }else{
  for(let y=44;y<44+imageHeight;y+=8)rect(16,y,160,1,'#1c2c17');
  for(let x=16;x<176;x+=8)rect(x,44,1,imageHeight,'#1c2c17');
  text(artist.name.slice(0,1).toUpperCase(),96,44+imageHeight/2+16,40,'#9dba71','center');
 }
 for(const [x,y] of [[16,44],[168,44],[16,42+imageHeight],[168,42+imageHeight]])rect(x,y,8,2,accentDim);
 bevel(12,labelTop,168,labelHeight,'#202a1b','#11180c','#778563');
 context.font=`${type.name}px "Press Start 2P",monospace`;
 const characters=Array.from(artist.name);let firstLine='';
 while(characters.length&&context.measureText(firstLine+characters[0]).width<=152)firstLine+=characters.shift();
 if(characters.length){
  const breakAt=firstLine.lastIndexOf(' ');
  if(breakAt>firstLine.length/2){characters.unshift(...Array.from(firstLine.slice(breakAt+1)));firstLine=firstLine.slice(0,breakAt);}
 }
 let secondLine=characters.join('').trimStart();
 if(context.measureText(secondLine).width>152){while(context.measureText(secondLine+'…').width>152)secondLine=Array.from(secondLine).slice(0,-1).join('');secondLine+='…';}
 const nameBaseline=labelTop+type.name+7;
 text(firstLine,18,nameBaseline,type.name,'#fff0bb');if(secondLine)text(secondLine,18,nameBaseline+lineHeight,type.name,'#fff0bb');
 text(artist.kind==='collective'?'ПРОЕКТ':artist.kind==='media'?'МЕДИА':'АРТИСТ',18,250,type.meta,'#d6ddbb');
 const ratingWidth=Math.max(42,type.rating*4+8),ratingHeight=type.rating+9;
 bevel(174-ratingWidth,254-ratingHeight,ratingWidth,ratingHeight,'#11190c','#576647','#050b03');
 text(artist.rating||'A',174-ratingWidth/2,249,type.rating,accent,'center');
 for(let tick=0;tick<11;tick++){
  const height=2+tick%3,width=tick%4===3?7:10,x=15+tick*15,y=265-height;
  const lit=tick<signalBars;
  rect(x,y,width,height,lit?tick===signalBars-1?accentBright:tick%3===0?accent:accentDim:'#606d4b');
  if(lit&&height>2)rect(x,y,width,1,accentBright);
 }
 for(const [x,y] of [[7,7],[181,7],[7,258],[181,258]]){
  rect(x,y,4,4,'#131c0e');rect(x,y,3,1,'#a0a587');rect(x+1,y+1,1,2,'#767f61');
 }
 context.restore();
 return canvas;
}

type TextureRecord={texture:WebGLTexture;image?:HTMLImageElement};
type CardPoint={x:number;y:number};
type CardHitArea={index:number;corners:CardPoint[]};

function containsPoint(corners:CardPoint[],point:CardPoint){
 const sides=corners.map((corner,index)=>{
  const next=corners[(index+1)%corners.length];
  return (next.x-corner.x)*(point.y-corner.y)-(next.y-corner.y)*(point.x-corner.x);
 });
 return sides.every(side=>side>=0)||sides.every(side=>side<=0);
}

export default function ArtistCanvasDeck({artists,zoom,onZoomStep}:{artists:Artist[];zoom:number;onZoomStep:(step:number)=>void}){
 const canvasRef=useRef<HTMLCanvasElement>(null);
 const editRef=useRef<HTMLAnchorElement>(null);
 const zoomRef=useRef(zoom),zoomStepRef=useRef(onZoomStep);
 zoomRef.current=zoom;zoomStepRef.current=onZoomStep;
 const signature=artists.map(artist=>`${artist.id}:${artist.image}:${artist.name}:${artist.rating}:${artist.kind}:${artist.url}`).join('|');
 useEffect(()=>{
  const canvas=canvasRef.current;if(!canvas||!artists.length)return;
  const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,powerPreference:'high-performance'});
  let cancelled=false,frame=0;
  const initialPosition=0;
  const position={value:initialPosition,target:initialPosition,velocity:0,hover:-1,dragging:false,lastX:0,lastTime:0,moved:false,startX:0,startY:0,pressed:-1,pointerId:-1};
  let hitAreas:CardHitArea[]=[];
  let width=1,height=1,lastFrame=0;
  // Use a CSS-pixel grid, independently of Retina density. The 192 × 272
  // textures and 80 × 76 portraits supply the coarse pixels; the scene must not
  // downsample their small labels a second time.
  const resize=()=>{const bounds=canvas.getBoundingClientRect();width=Math.max(1,Math.round(bounds.width));height=Math.max(1,Math.round(bounds.height));if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;if(width/height<.84)position.value=position.target=Math.round(position.target);}if(gl)gl.viewport(0,0,width,height);};
  const fontReady=document.fonts.load('8px "Press Start 2P"');
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  const layout=()=>{
   const level=zoomRef.current;
   const rows=level<=.65?3:level<=1.1?2:1;
   // Keep card size continuous through the row-count changes. At 40–100%
   // this grows from a compact overview to readable two-row dossiers.
   const sizeY=level<=1?.25+(level-.4)*(.22/.6):level<=1.1?.47+(level-1)*.35:.505+(level-1.1)*(.345/.4);
   const sizeX=sizeY*cardWidth/cardHeight;
   const columnStep=sizeX*2.27;
   const rowStep=rows===3?.73:rows===2?Math.min(1.04,2*sizeY+.12):0;
   return {rows,sizeX,sizeY,columnStep,rowStep,columns:Math.ceil(artists.length/rows)};
  };
  const typographyForLayout=():CardTypography=>{
   const scene=layout(),fit=Math.min(1,width/height*.86/(scene.sizeX*.89));
   const scale=height*scene.sizeY*.89*fit/cardHeight;
   const fontSize=(minimum:number,target:number,maximum:number)=>Math.max(minimum,Math.min(maximum,Math.ceil(target/scale)));
   return {name:fontSize(11,14,20),meta:fontSize(9,11,13),rating:fontSize(10,12,14),header:fontSize(8,10,12)};
  };
  let edgeKey='',edge=0;
  const clamp=(value:number)=>{
   const scene=layout(),key=`${width}:${height}:${zoomRef.current}`;
   if(key!==edgeKey){
    edgeKey=key;
    const aspect=width/height,gutter=Math.min(18,width*.04);
    const fit=Math.min(1,aspect*.86/(scene.sizeX*.89));
    // Clamp against the visible card edge, including the WebGL perspective.
    // Using the unprojected column spacing leaves an empty strip at startup.
    if(gl){
     const leftAt=(offset:number)=>{
      const x=-scene.sizeX*fit;
      const yaw=Math.round(Math.min(.16,offset*.055)*24)/24;
      const depth=-Math.min(.6,offset*.055);
      const perspective=5.35/Math.max(3.2,6-(-x*Math.sin(yaw)+depth));
      return width/2+(x*Math.cos(yaw)-offset*scene.columnStep)*perspective*height/2;
     };
     let low=0,high=aspect/scene.columnStep*2;
     for(let i=0;i<18;i++){const middle=(low+high)/2;if(leftAt(middle)>gutter)low=middle;else high=middle;}
     edge=(low+high)/2;
    }else{
     const step=height*scene.columnStep*.89/2,cardSize=height*scene.sizeX*.89*fit;
     edge=Math.max(0,(width/2-gutter-cardSize/2)/step);
    }
   }
   const first=Math.min(scene.columns-1,edge),last=Math.max(first,scene.columns-1-edge);
   return Math.max(first,Math.min(last,value));
  };
  let activeRows=layout().rows;
  const syncRows=()=>{
   const nextRows=layout().rows;
   if(nextRows===activeRows)return;
   position.value=clamp(position.value*activeRows/nextRows);
   position.target=clamp(position.target*activeRows/nextRows);
   position.hover=-1;
   activeRows=nextRows;
  };
  position.value=position.target=clamp(0);
  const columnAt=(index:number)=>Math.floor(index/layout().rows);
  const moveTarget=(step:number)=>{position.target=clamp(position.target+step);};
  const hitAt=(event:PointerEvent)=>{
   const bounds=canvas.getBoundingClientRect();
   const point={x:(event.clientX-bounds.left)*width/bounds.width,y:(event.clientY-bounds.top)*height/bounds.height};
   for(let index=hitAreas.length-1;index>=0;index--)if(containsPoint(hitAreas[index].corners,point))return hitAreas[index].index;
   return -1;
  };
  const editLink=editRef.current;
  const syncEditLink=()=>{
   if(!editLink)return;
   const hit=hitAreas.find(area=>area.index===position.hover);
   if(position.dragging||!hit){delete editLink.dataset.visible;editLink.tabIndex=-1;return;}
   const artist=artists[hit.index],bounds=canvas.getBoundingClientRect(),shell=canvas.parentElement!.getBoundingClientRect();
   const right=Math.max(...hit.corners.map(corner=>corner.x));
   const top=Math.min(...hit.corners.map(corner=>corner.y));
   const left=bounds.left-shell.left+(right-40)*bounds.width/width;
   const y=bounds.top-shell.top+(top+8)*bounds.height/height;
   editLink.style.left=`${Math.round(Math.max(8,Math.min(shell.width-44,left)))}px`;
   editLink.style.top=`${Math.round(Math.max(36,y))}px`;
   if(editLink.dataset.artistId!==artist.id){
    editLink.dataset.artistId=artist.id;
    editLink.href=`${adminUrl}/?edit=${encodeURIComponent(artist.id)}#catalog`;
    editLink.setAttribute('aria-label',`Редактировать ${artist.name}`);
   }
   editLink.dataset.visible='true';editLink.tabIndex=0;
  };
  const updateCursor=()=>{canvas.style.cursor=position.dragging?'grabbing':position.hover>=0?'pointer':'grab';syncEditLink();};
  const openArtist=(index:number)=>{const artist=artists[index];if(artist?.url)window.open(artist.url,'_blank','noopener,noreferrer');};
  const onWheel=(event:WheelEvent)=>{event.preventDefault();if(event.ctrlKey||event.metaKey){zoomStepRef.current(event.deltaY<0?.1:-.1);}else moveTarget((Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY)*.0038);};
  const onPointerDown=(event:PointerEvent)=>{
   if(event.button!==0||!event.isPrimary)return;
   canvas.focus({preventScroll:true});canvas.setPointerCapture(event.pointerId);
   position.dragging=true;position.moved=false;position.startX=position.lastX=event.clientX;position.startY=event.clientY;position.pointerId=event.pointerId;
   position.hover=position.pressed=hitAt(event);position.lastTime=performance.now();position.velocity=0;updateCursor();
  };
  const onPointerMove=(event:PointerEvent)=>{if(!event.isPrimary)return;const bounds=canvas.getBoundingClientRect();
   const scene=layout(),stepPx=Math.max(60,bounds.height*scene.columnStep*.89/2);
   position.hover=hitAt(event);updateCursor();
   if(position.dragging&&event.pointerId===position.pointerId){const now=performance.now(),dx=event.clientX-position.lastX;position.target=clamp(position.target-dx/stepPx);position.velocity=(-dx/stepPx)*Math.min(3,16/Math.max(8,now-position.lastTime));position.lastX=event.clientX;position.lastTime=now;if(Math.hypot(event.clientX-position.startX,event.clientY-position.startY)>6)position.moved=true;}
  };
  const finishPointer=(event:PointerEvent,cancelled=false)=>{
   if(!position.dragging||event.pointerId!==position.pointerId)return;
   if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
   position.dragging=false;position.hover=hitAt(event);updateCursor();
   const moved=position.moved||Math.hypot(event.clientX-position.startX,event.clientY-position.startY)>6;
   if(cancelled)return;
   if(moved){position.target=clamp(position.target+position.velocity*2.4);if(width/height<.84)position.target=clamp(Math.round(position.target));}
   else if(position.hover>=0&&position.hover===position.pressed)openArtist(position.hover);
  };
  const onPointerUp=(event:PointerEvent)=>finishPointer(event);
  const onPointerCancel=(event:PointerEvent)=>finishPointer(event,true);
  const onPointerLeave=(event:PointerEvent)=>{if(editLink?.contains(event.relatedTarget as Node))return;position.hover=-1;updateCursor();};
  const onEditPointerLeave=(event:PointerEvent)=>{if(event.relatedTarget===canvas)return;position.hover=-1;updateCursor();};
  const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='ArrowRight'){event.preventDefault();position.hover=-1;moveTarget(1);}else if(event.key==='ArrowLeft'){event.preventDefault();position.hover=-1;moveTarget(-1);}else if(event.key==='Enter'){event.preventDefault();openArtist(position.hover>=0?position.hover:Math.round(position.target)*layout().rows);}else if(event.key==='+'||event.key==='='){event.preventDefault();zoomStepRef.current(.1);}else if(event.key==='-'){event.preventDefault();zoomStepRef.current(-.1);}};
  canvas.addEventListener('wheel',onWheel,{passive:false});canvas.addEventListener('pointerdown',onPointerDown);canvas.addEventListener('pointermove',onPointerMove);canvas.addEventListener('pointerup',onPointerUp);canvas.addEventListener('pointercancel',onPointerCancel);canvas.addEventListener('pointerleave',onPointerLeave);canvas.addEventListener('keydown',onKeyDown);editLink?.addEventListener('pointerleave',onEditPointerLeave);
  const cleanEvents=()=>{canvas.removeEventListener('wheel',onWheel);canvas.removeEventListener('pointerdown',onPointerDown);canvas.removeEventListener('pointermove',onPointerMove);canvas.removeEventListener('pointerup',onPointerUp);canvas.removeEventListener('pointercancel',onPointerCancel);canvas.removeEventListener('pointerleave',onPointerLeave);canvas.removeEventListener('keydown',onKeyDown);editLink?.removeEventListener('pointerleave',onEditPointerLeave);canvas.style.removeProperty('cursor');observer.disconnect();};
  if(!gl){
   const context=canvas.getContext('2d');const images=new Map<number,HTMLImageElement>(),bitmaps=new Map<number,HTMLCanvasElement>();
   let bitmapTypography='';
   fontReady.then(()=>{if(!cancelled)bitmaps.clear();});
   const draw=(time:number)=>{if(cancelled||!context)return;const delta=Math.min(40,time-lastFrame||16);lastFrame=time;syncRows();position.target=clamp(position.target);position.value=clamp(position.value+(position.target-position.value)*(reducedMotion.matches?1:Math.min(1,delta*.012)));
    context.setTransform(1,0,0,1,0,0);context.imageSmoothingEnabled=false;context.fillStyle='#10170e';context.fillRect(0,0,width,height);
    const scene=layout(),step=height*scene.columnStep*.89/2;
    const type=typographyForLayout(),key=typographyKey(type);
    if(key!==bitmapTypography){bitmapTypography=key;bitmaps.clear();}
    const indices=artists.map((_,i)=>i).filter(i=>Math.abs(columnAt(i)-position.value)<width/step/2+1);
    hitAreas=[];
    for(const index of indices){const column=columnAt(index),row=index%scene.rows,dx=column-position.value;
     const viewportFit=Math.min(1,width/height*.86/(scene.sizeX*.89));
     const cardHeight=height*scene.sizeY*.89*viewportFit,cardWidth=height*scene.sizeX*.89*viewportFit;
     const x=width/2+dx*step-cardWidth/2,y=height/2+((row-(scene.rows-1)/2)*scene.rowStep)*height*.89/2-cardHeight/2;
     if(!images.has(index)&&artists[index].image){const image=new Image();image.crossOrigin='anonymous';image.referrerPolicy='no-referrer';image.onload=()=>{if(!cancelled)bitmaps.delete(index);};image.src=artists[index].image;images.set(index,image);}
     if(!bitmaps.has(index))bitmaps.set(index,cardBitmap(artists[index],index,type,images.get(index)?.complete?images.get(index):undefined));
     const left=Math.round(x),top=Math.round(y),w=Math.round(cardWidth),h=Math.round(cardHeight);
     hitAreas.push({index,corners:[{x:left,y:top},{x:left+w,y:top},{x:left+w,y:top+h},{x:left,y:top+h}]});
     context.fillStyle='#000';context.fillRect(left+3,top+4,w,h);context.drawImage(bitmaps.get(index)!,left,top,w,h);
     if(index===position.hover){context.fillStyle='#fad657';const length=Math.max(5,Math.round(w*.09));
      for(const [cornerX,cornerY,sideX,sideY] of [[left,top,1,1],[left+w-2,top,-1,1],[left,top+h-2,1,-1],[left+w-2,top+h-2,-1,-1]]){
       context.fillRect(cornerX+(sideX<0?2-length:0),cornerY,length,2);context.fillRect(cornerX,cornerY+(sideY<0?2-length:0),2,length);
      }
     }
    }
    syncEditLink();frame=requestAnimationFrame(draw);
   };frame=requestAnimationFrame(draw);
   return()=>{cancelled=true;cancelAnimationFrame(frame);cleanEvents();images.forEach(image=>{image.onload=null;image.onerror=null;});};
  }
  let cardProgram:WebGLProgram,backgroundProgram:WebGLProgram;
  try{cardProgram=program(gl,vertexSource,cardFragmentSource);backgroundProgram=program(gl,backgroundVertexSource,backgroundFragmentSource);}catch{cleanEvents();return;}
  const vao=gl.createVertexArray();gl.bindVertexArray(vao);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,1);
  const cardUniforms={center:gl.getUniformLocation(cardProgram,'uCenter'),size:gl.getUniformLocation(cardProgram,'uSize'),aspect:gl.getUniformLocation(cardProgram,'uAspect'),yaw:gl.getUniformLocation(cardProgram,'uYaw'),pitch:gl.getUniformLocation(cardProgram,'uPitch'),roll:gl.getUniformLocation(cardProgram,'uRoll'),resolution:gl.getUniformLocation(cardProgram,'uResolution'),texture:gl.getUniformLocation(cardProgram,'uTexture'),accent:gl.getUniformLocation(cardProgram,'uAccent'),focus:gl.getUniformLocation(cardProgram,'uFocus'),pass:gl.getUniformLocation(cardProgram,'uPass')};
  const backgroundUniforms={motion:gl.getUniformLocation(backgroundProgram,'uMotion'),resolution:gl.getUniformLocation(backgroundProgram,'uResolution')};
  const textures=new Map<number,TextureRecord>();
  let type=typographyForLayout();
  function upload(index:number,image?:HTMLImageElement){const record=textures.get(index);if(!record||cancelled)return;gl!.bindTexture(gl!.TEXTURE_2D,record.texture);gl!.texImage2D(gl!.TEXTURE_2D,0,gl!.RGBA,gl!.RGBA,gl!.UNSIGNED_BYTE,cardBitmap(artists[index],index,type,image));}
  function textureFor(index:number){const cached=textures.get(index);if(cached)return cached.texture;const texture=gl!.createTexture();if(!texture)throw Error('Texture unavailable');gl!.bindTexture(gl!.TEXTURE_2D,texture);gl!.texParameteri(gl!.TEXTURE_2D,gl!.TEXTURE_MIN_FILTER,gl!.NEAREST);gl!.texParameteri(gl!.TEXTURE_2D,gl!.TEXTURE_MAG_FILTER,gl!.NEAREST);gl!.texParameteri(gl!.TEXTURE_2D,gl!.TEXTURE_WRAP_S,gl!.CLAMP_TO_EDGE);gl!.texParameteri(gl!.TEXTURE_2D,gl!.TEXTURE_WRAP_T,gl!.CLAMP_TO_EDGE);textures.set(index,{texture});upload(index);
   if(artists[index].image){const image=new Image();image.crossOrigin='anonymous';image.referrerPolicy='no-referrer';image.onload=()=>{if(!cancelled)upload(index,image);};image.onerror=()=>{};image.src=artists[index].image;textures.get(index)!.image=image;}
   return texture;
  }
  fontReady.then(()=>{if(!cancelled)textures.forEach((record,index)=>upload(index,record.image?.complete?record.image:undefined));});
  const render=(time:number)=>{if(cancelled)return;frame=requestAnimationFrame(render);if(document.visibilityState==='hidden')return;
   const delta=Math.min(40,time-lastFrame||16);lastFrame=time;syncRows();position.target=clamp(position.target);position.value=clamp(position.value+(position.target-position.value)*(reducedMotion.matches?1:Math.min(1,delta*.011)));
   const aspect=width/height,scene=layout();
   const nextType=typographyForLayout();
   if(typographyKey(nextType)!==typographyKey(type)){type=nextType;textures.forEach((record,index)=>upload(index,record.image?.complete?record.image:undefined));}
   gl.viewport(0,0,width,height);gl.clearColor(.015,.024,.032,1);gl.clear(gl.COLOR_BUFFER_BIT);
   gl.useProgram(backgroundProgram);gl.uniform1f(backgroundUniforms.motion,position.value);gl.uniform2f(backgroundUniforms.resolution,width,height);gl.drawArrays(gl.TRIANGLES,0,6);
   const visibleColumns=aspect/scene.columnStep+2;
   hitAreas=[];
   const visible=artists.map((_,i)=>i).filter(i=>Math.abs(columnAt(i)-position.value)<visibleColumns);
   for(const index of [...textures.keys()])if(Math.abs(columnAt(index)-position.value)>visibleColumns+3){const old=textures.get(index)!;old.image&&(old.image.onload=null);gl.deleteTexture(old.texture);textures.delete(index);}
   gl.useProgram(cardProgram);gl.uniform1f(cardUniforms.aspect,aspect);gl.uniform2f(cardUniforms.resolution,width,height);gl.uniform1i(cardUniforms.texture,0);
   const drawCard=(index:number,pass:number)=>{const column=columnAt(index),row=index%scene.rows,dx=column-position.value,focus=index===position.hover?1:0;const accent=accentFor(artists[index]);
    const viewportFit=Math.min(1,aspect*.86/(scene.sizeX*.89));
    const centerX=dx*scene.columnStep+(pass===0?.025:0),centerY=((scene.rows-1)/2-row)*scene.rowStep+focus*.025-(pass===0?.025:0),centerZ=-Math.min(.6,Math.abs(dx)*.055)+focus*.06;
    gl.uniform3f(cardUniforms.center,centerX,centerY,centerZ);
    gl.uniform2f(cardUniforms.size,scene.sizeX*viewportFit,scene.sizeY*viewportFit);
    const yaw=Math.round(Math.max(-.16,Math.min(.16,-dx*.055))*24)/24;
    gl.uniform1f(cardUniforms.yaw,yaw);
    gl.uniform1f(cardUniforms.pitch,0);gl.uniform1f(cardUniforms.roll,0);
    gl.uniform3f(cardUniforms.accent,...accent);gl.uniform1f(cardUniforms.focus,focus);gl.uniform1i(cardUniforms.pass,pass);
    if(pass===1){
     const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([cornerX,cornerY])=>{
      const x=cornerX*scene.sizeX*viewportFit,y=cornerY*scene.sizeY*viewportFit;
      const perspective=5.35/Math.max(3.2,6-(-x*Math.sin(yaw)+centerZ));
      const projectedX=Math.floor((x*Math.cos(yaw)+centerX)*perspective/aspect*width/2+.5);
      const projectedY=Math.floor((y+centerY)*perspective*height/2+.5);
      return {x:width/2+projectedX,y:height/2-projectedY};
     });
     hitAreas.push({index,corners});
     gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,textureFor(index));
    }gl.drawArrays(gl.TRIANGLES,0,6);
   };
   for(const index of visible)drawCard(index,0);
   for(const index of visible.sort((a,b)=>Math.abs(columnAt(b)-position.value)-Math.abs(columnAt(a)-position.value)))drawCard(index,1);
   syncEditLink();
  };
  frame=requestAnimationFrame(render);
  return()=>{cancelled=true;cancelAnimationFrame(frame);cleanEvents();textures.forEach(record=>{if(record.image){record.image.onload=null;record.image.onerror=null;}gl.deleteTexture(record.texture);});gl.deleteProgram(cardProgram);gl.deleteProgram(backgroundProgram);gl.deleteVertexArray(vao);};
 },[signature]);
 return <div className="canvas-deck-shell">
  <div className="canvas-deck-header"><span>АРХИВ ДОСЬЕ</span><span>ЗАПИСЕЙ: {artists.length}</span></div>
  {artists.length?<canvas ref={canvasRef} className="canvas-deck-stage" tabIndex={0} aria-label="Трёхмерная колода досье. Клик или Enter открывает источник в новом окне. Стрелки влево и вправо переключают записи, плюс и минус меняют масштаб."/>:
   <div className="canvas-deck-stage canvas-deck-empty" role="status">Сигнал не обнаружен. Измените запрос или фильтр.</div>}
  {showLocalAdmin&&artists.length>0&&<a ref={editRef} className="canvas-deck-edit" href={`${adminUrl}/#catalog`} aria-label="Редактировать досье" title="Редактировать досье" tabIndex={-1}><Pencil size={17} aria-hidden="true"/></a>}
  <div className="canvas-deck-status"><span><i aria-hidden="true"/> КАТАЛОГ</span><span>КЛИК — ОТКРЫТЬ · ← → · + −</span></div>
  <ol className="sr-only" aria-label="Записи в трёхмерной колоде">{artists.map(artist=><li key={artist.id}>{artist.name}</li>)}</ol>
 </div>;
}
