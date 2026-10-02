'use client';

import {useEffect,useRef} from 'react';
import {paintSignalScanlines,signalHash,signalRasterScale} from './signal-screen';

const glyphs=Array.from('アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン信号電光未来断片夢影機界壊警報空網路炎星龍真偽視覚記録通信回路秘密変換転送⌁⌑⌖⌗⌘⌬⍟⎔⟁⊗╳∴≋≡<>/\\|:;ABCDEFGHJKLMNPRSTUVWXYZ');
const colours=['#ffe3d2','#e8abb1','#ff7380','#bf7780','#ae4962','#803249'];
const atlasCell=32,atlasColumns=16,atlasRows=Math.ceil(glyphs.length/atlasColumns);
const nearPlane=.85,depthRange=5.8,glyphSpacing=.071,glyphSize=.048;
const wrap=(value:number,range:number)=>((value%range)+range)%range;

type Stream={seed:number;x:number;z:number;phase:number;speed:number;trail:number;spin:number};
type Camera={x:number;y:number;yaw:number;pitch:number;focal:number;cx:number;cy:number};

function glyphAtlas(){
 const canvas=document.createElement('canvas');
 canvas.width=atlasColumns*atlasCell;canvas.height=atlasRows*atlasCell*colours.length;
 const context=canvas.getContext('2d');if(!context)return canvas;
 context.font='900 24px "Hiragino Kaku Gothic ProN","Yu Gothic",ui-monospace,monospace';
 context.textAlign='center';context.textBaseline='middle';
 colours.forEach((colour,colourIndex)=>{
  context.fillStyle=colour;
  glyphs.forEach((glyph,index)=>context.fillText(glyph,
   (index%atlasColumns+.5)*atlasCell,
   (colourIndex*atlasRows+Math.floor(index/atlasColumns)+.5)*atlasCell));
 });
 // The atlas has solid pixel edges, including when glyphs turn or move closer.
 const pixels=context.getImageData(0,0,canvas.width,canvas.height);
 for(let index=3;index<pixels.data.length;index+=4)pixels.data[index]=pixels.data[index]>=96?255:0;
 context.putImageData(pixels,0,0);
 return canvas;
}

function project(x:number,y:number,z:number,camera:Camera){
 x-=camera.x;y-=camera.y;
 const cosYaw=Math.cos(camera.yaw),sinYaw=Math.sin(camera.yaw);
 const cosPitch=Math.cos(camera.pitch),sinPitch=Math.sin(camera.pitch);
 const viewX=x*cosYaw-z*sinYaw,rotatedZ=x*sinYaw+z*cosYaw;
 const viewY=y*cosPitch-rotatedZ*sinPitch,viewZ=y*sinPitch+rotatedZ*cosPitch;
 if(viewZ<.5)return null;
 const scale=camera.focal/viewZ;
 return {x:camera.cx+viewX*scale,y:camera.cy+viewY*scale,scale,z:viewZ};
}

export default function SignalRain({active}:{active:boolean}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const canvas=ref.current;if(!active||!canvas)return;
  const context=canvas.getContext('2d',{alpha:false});if(!context)return;
  const atlas=glyphAtlas(),reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  let width=1,height=1,focal=1,frame=0,lastFrame=0,lastPointer=0;
  let streams:Stream[]=[];
  const start=performance.now(),pointer={x:0,y:0},cameraOffset={x:0,y:0};
  const resize=()=>{
   const bounds=canvas.getBoundingClientRect();width=Math.max(1,bounds.width);height=Math.max(1,bounds.height);
   canvas.width=Math.max(1,Math.ceil(width*signalRasterScale));
   canvas.height=Math.max(1,Math.ceil(height*signalRasterScale));
   context.setTransform(signalRasterScale,0,0,signalRasterScale,0,0);
   context.imageSmoothingEnabled=false;
   focal=height*.96;
   const count=Math.max(90,Math.min(224,Math.round(width/7)));
   streams=Array.from({length:count},(_,index)=>{
    const seed=signalHash(index*0x9e3779b1+317);
    const random=(salt:number)=>signalHash(seed^salt)/0xffffffff;
    const band=random(13);
    const z=band<.16?1.05+random(17)*.8:band<.58?1.85+random(17)*1.75:3.6+random(17)*2.6;
    return {seed,z,x:(random(23)-.5)*width/focal*z*1.5,
     phase:random(31)*24,speed:.27+random(43)*.31,trail:12+Math.floor(random(47)*19),spin:random(59)*Math.PI*2};
   });
  };
  const onPointerMove=(event:PointerEvent)=>{
   if(event.pointerType!=='mouse')return;
   const bounds=canvas.getBoundingClientRect();
   pointer.x=Math.max(-1,Math.min(1,(event.clientX-bounds.left)/width*2-1));
   pointer.y=Math.max(-1,Math.min(1,(event.clientY-bounds.top)/height*2-1));
   lastPointer=performance.now();
  };
  const clearPointer=()=>{pointer.x=0;pointer.y=0;};
  const drawFloor=(camera:Camera)=>{
   const extent=width/height*5.5;
   context.strokeStyle='#d54b6420';context.lineWidth=1;
   const segment=(x1:number,z1:number,x2:number,z2:number)=>{
    const a=project(x1,.58,z1,camera),b=project(x2,.58,z2,camera);
    if(!a||!b)return;
    context.beginPath();context.moveTo(a.x,a.y);context.lineTo(b.x,b.y);context.stroke();
   };
   for(let x=-extent;x<=extent;x+=.8)segment(x,.8,x,8);
   for(const z of [.95,1.2,1.55,2.05,2.8,4,6.5])segment(-extent,z,extent,z);
  };
  const draw=(now:number)=>{
   frame=requestAnimationFrame(draw);
   if(document.visibilityState!=='visible'||now-lastFrame<(reducedMotion.matches?48:32))return;
   const delta=Math.min(64,now-lastFrame||32);lastFrame=now;
   const time=(now-start)*.001*(reducedMotion.matches?.3:1);
   const spinTime=reducedMotion.matches?0:time;
   if(now-lastPointer>2400)clearPointer();
   const ease=1-Math.exp(-delta/180);
   cameraOffset.x+=(pointer.x-cameraOffset.x)*ease;cameraOffset.y+=(pointer.y-cameraOffset.y)*ease;
   const parallax=reducedMotion.matches?0:1;
   const camera:Camera={focal,cx:width/2,cy:height*.48,
    x:(cameraOffset.x*.14+Math.sin(time*.16)*.055)*parallax,
    y:(cameraOffset.y*.09+Math.sin(time*.11)*.025)*parallax,
    yaw:(cameraOffset.x*.034+Math.sin(time*.13)*.018)*parallax,
    pitch:(cameraOffset.y*.022+Math.sin(time*.09)*.008)*parallax};
   const backdrop=context.createRadialGradient(width*.52,height*.47,0,width*.52,height*.47,Math.max(width,height)*.72);
   backdrop.addColorStop(0,'#180c17');backdrop.addColorStop(.6,'#0d0811');backdrop.addColorStop(1,'#05070b');
   context.globalAlpha=1;context.fillStyle=backdrop;context.fillRect(0,0,width,height);
   drawFloor(camera);
   const depthOrder=streams.map(stream=>({stream,z:nearPlane+wrap(stream.z-nearPlane-time*.045,depthRange)})).sort((a,b)=>b.z-a.z);
   for(const {stream,z} of depthOrder){
    const span=height/focal*stream.z*1.35,cycle=span+stream.trail*glyphSpacing+1;
    const head=wrap(time*stream.speed+stream.phase,cycle)-span/2-.5;
    const depthFade=Math.min(1,(z-nearPlane)/.35,(nearPlane+depthRange-z)/.5);
    const proximity=1-(z-nearPlane)/depthRange;
    const brightness=(.28+proximity*.66)*depthFade;
    const mutation=reducedMotion.matches?0:Math.floor(time/(.16+(stream.seed%8)*.035));
    const worldX=stream.x+Math.sin(spinTime*.16+stream.spin)*.055;
    for(let step=stream.trail-1;step>=0;step--){
     const worldY=head-step*glyphSpacing;
     const point=project(worldX,worldY,z,camera);if(!point)continue;
     const size=Math.round(glyphSize*point.scale/2)*2;
     if(size<4||point.x+size<0||point.x-size>width||point.y+size<0||point.y-size>height)continue;
     const fade=1-step/stream.trail;
     const glyphIndex=signalHash(stream.seed^Math.imul(step+1,0x85ebca6b)^Math.imul(mutation+1,0x27d4eb2d))%glyphs.length;
     const colour=step===0?(z<3.6?0:1):step<3?1:step<9?2:proximity>.4?4:5;
     const sx=glyphIndex%atlasColumns*atlasCell,sy=(colour*atlasRows+Math.floor(glyphIndex/atlasColumns))*atlasCell;
     context.globalAlpha=Math.min(1,brightness*(.18+fade*.82)*(step===0?1.2:1));
     const turn=.74+.26*Math.abs(Math.cos(stream.spin+spinTime*.4+step*.43));
     const spriteWidth=Math.max(4,Math.round(size*turn/2)*2);
     const x=Math.round(point.x/2)*2,y=Math.round(point.y/2)*2;
     if(z<2.3){
      context.save();context.translate(x,y);context.rotate(Math.sin(stream.spin+spinTime*.3+step*.27)*.085);
      context.drawImage(atlas,sx,sy,atlasCell,atlasCell,-spriteWidth/2,-size/2,spriteWidth,size);context.restore();
     }else context.drawImage(atlas,sx,sy,atlasCell,atlasCell,x-spriteWidth/2,y-size/2,spriteWidth,size);
     if(step===0&&z<2.4){
      context.globalAlpha=brightness*.18;context.fillStyle='#ffe3d2';
      context.fillRect(x-2,y+size*.32,4,Math.max(2,size*.18));
     }
    }
   }
   context.globalAlpha=1;
   paintSignalScanlines(context,width,height);
   // Sparse phosphor cells share the console's half-resolution raster, rather
   // than blurring the projected glyphs with a second image filter.
   context.fillStyle='#e16a7d0a';
   const noiseFrame=reducedMotion.matches?0:Math.floor(time*6);
   for(let cell=0;cell<Math.floor(width*height/6200);cell++){
    const seed=signalHash(cell*997+noiseFrame*31);
    context.fillRect(seed%canvas.width*2,(seed>>>16)%canvas.height*2,2,2);
   }
  };
  resize();const observer=new ResizeObserver(resize);observer.observe(canvas);
  window.addEventListener('pointermove',onPointerMove,{passive:true});window.addEventListener('blur',clearPointer);
  frame=requestAnimationFrame(draw);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('pointermove',onPointerMove);window.removeEventListener('blur',clearPointer);};
 },[active]);
 return <canvas ref={ref} className="signal-rain" aria-hidden="true"/>;
}
