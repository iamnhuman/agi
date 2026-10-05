'use client';

import {useEffect,useRef} from 'react';
import {paintSignalScanlines,signalHash,signalRasterScale} from './signal-screen';

// Fixed-cell light sweeps and independent glyph clocks, following the visual
// mechanics described at https://github.com/Rezmason/matrix. No shader dependency.
const katakana=Array.from('ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝ');
const glyphs=[...katakana,...Array.from('0123456789Z=*+<>')];
const colours=['#ffbbc6','#ff8295','#f4516b','#d93450','#a0213d','#64172b','#360c1b'];
const atlasCell=16,atlasColumns=16,atlasRows=Math.ceil(glyphs.length/atlasColumns);
const wrap=(value:number,range:number)=>((value%range)+range)%range;
const random=(seed:number,salt:number)=>signalHash(seed^salt)/0xffffffff;

type RainCell={seed:number;glyph:number;nextChange:number;period:number;shade:number;brightness:number};
type RainColumn={x:number;phase:number;speed:number;trail:number;cycle:number;brightness:number;cursor:boolean;cells:RainCell[]};
type RainLayer={pitch:number;size:number;offset:number;opacity:number;columns:RainColumn[]};

function glyphAtlas(){
 const canvas=document.createElement('canvas');
 canvas.width=atlasColumns*atlasCell;canvas.height=atlasRows*atlasCell*colours.length;
 const context=canvas.getContext('2d');if(!context)return canvas;
 context.font='900 13px "Hiragino Kaku Gothic ProN","Yu Gothic",ui-monospace,monospace';
 context.textAlign='center';context.textBaseline='middle';
 colours.forEach((colour,colourIndex)=>{
  context.fillStyle=colour;
  glyphs.forEach((glyph,index)=>{
   context.save();
   context.translate((index%atlasColumns+.5)*atlasCell,(colourIndex*atlasRows+Math.floor(index/atlasColumns)+.5)*atlasCell);
   // Widen and mirror half-width kana; digits retain their normal orientation.
   context.scale(index<katakana.length?-1.55:1.1,1);
   context.fillText(glyph,0,0);context.restore();
  });
 });
 const pixels=context.getImageData(0,0,canvas.width,canvas.height);
 for(let index=3;index<pixels.data.length;index+=4)pixels.data[index]=pixels.data[index]>=80?255:0;
 context.putImageData(pixels,0,0);
 return canvas;
}

function createLayer(width:number,height:number,time:number,far:boolean):RainLayer{
 const pitch=far?14:20,size=far?12:18,offset=far?6:0;
 const spacing=far?pitch*2:pitch,rows=Math.ceil(height/pitch);
 const columns=Array.from({length:Math.ceil(width/spacing)},(_,index)=>{
  const seed=signalHash(index*0x9e3779b1+(far?911:317));
  const trail=Math.max(10,Math.round(rows*(.3+random(seed,17)*.35)));
  return {x:index*spacing+offset,phase:random(seed,31)*160,
   speed:(far?4:7)+random(seed,43)*(far?4:8),trail,
   cycle:trail+8+Math.round(random(seed,47)*20),
   brightness:.58+random(seed,53)*.42,cursor:!far&&random(seed,59)>.16,
   cells:Array.from({length:rows},(_,row)=>{
    const cellSeed=signalHash(seed^Math.imul(row,0x85ebca6b));
    const period=cellSeed%11===0?2+random(cellSeed,61)*3:.28+random(cellSeed,67)*1.5;
    return {seed:cellSeed,glyph:cellSeed%glyphs.length,period,
     nextChange:time+random(cellSeed,71)*period,shade:.65+random(cellSeed,73)*.35,brightness:0};
   })};
 });
 return {pitch,size,offset:far?4:0,opacity:far?.22:.92,columns};
}

function paintLayer(context:CanvasRenderingContext2D,atlas:HTMLCanvasElement,layer:RainLayer,time:number,delta:number){
 const decay=Math.exp(-delta/.18);
 for(const column of layer.columns){
  const head=column.phase+time*column.speed;
  const headRow=Math.floor(head);
  for(let row=0;row<column.cells.length;row++){
   const cell=column.cells[row];
   // Coordinates never follow the head: a wave illuminates the existing grid.
   const distance=wrap(headRow-row,column.cycle),isHead=distance===0&&column.cursor;
   const envelope=distance<column.trail?Math.pow(1-distance/column.trail,.72):0;
   const target=envelope*column.brightness*cell.shade;
   cell.brightness=Math.max(target,cell.brightness*decay);
   if(time>=cell.nextChange){
    cell.seed=signalHash(cell.seed+0x27d4eb2d);
    cell.glyph=cell.seed%glyphs.length;
    cell.nextChange=time+cell.period*(.75+random(cell.seed,79)*.5);
   }
   if(cell.brightness<.025)continue;
   const colour=isHead?0:distance<3?1:cell.brightness>.65?2:cell.brightness>.45?3:cell.brightness>.25?4:cell.brightness>.12?5:6;
   const sx=cell.glyph%atlasColumns*atlasCell,sy=(colour*atlasRows+Math.floor(cell.glyph/atlasColumns))*atlasCell;
   const x=column.x,y=row*layer.pitch+layer.offset;
   context.globalAlpha=layer.opacity*(isHead?1:.45+cell.brightness*.55);
   context.drawImage(atlas,sx,sy,atlasCell,atlasCell,x,y,layer.size,layer.size);
   if(isHead){
    // A small pixel halo leaves the core sharp, instead of blurring the raster.
    context.globalAlpha=layer.opacity*.09;
    for(const [dx,dy] of [[-2,0],[2,0],[0,-2],[0,2]])
     context.drawImage(atlas,sx,sy,atlasCell,atlasCell,x+dx,y+dy,layer.size,layer.size);
   }
  }
 }
}

export default function SignalRain({active}:{active:boolean}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const canvas=ref.current;if(!active||!canvas)return;
  const context=canvas.getContext('2d',{alpha:false});if(!context)return;
  const atlas=glyphAtlas(),reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  let width=1,height=1,frame=0,lastFrame=0,time=0;
  let layers:RainLayer[]=[],backdrop:CanvasGradient;
  const resize=()=>{
   const bounds=canvas.getBoundingClientRect();
   const nextWidth=Math.max(1,Math.round(bounds.width)),nextHeight=Math.max(1,Math.round(bounds.height));
   if(layers.length&&nextWidth===width&&nextHeight===height)return;
   width=nextWidth;height=nextHeight;
   canvas.width=Math.max(1,Math.ceil(width*signalRasterScale));
   canvas.height=Math.max(1,Math.ceil(height*signalRasterScale));
   context.setTransform(signalRasterScale,0,0,signalRasterScale,0,0);
   context.imageSmoothingEnabled=false;
   backdrop=context.createRadialGradient(width*.5,height*.46,0,width*.5,height*.46,Math.max(width,height)*.7);
   backdrop.addColorStop(0,'#14080d');backdrop.addColorStop(.6,'#090609');backdrop.addColorStop(1,'#030406');
   layers=[createLayer(width,height,time,true),createLayer(width,height,time,false)];
  };
  const draw=(now:number)=>{
   if(document.visibilityState!=='visible'){frame=0;lastFrame=0;return;}
   frame=requestAnimationFrame(draw);
   if(lastFrame&&now-lastFrame<(reducedMotion.matches?48:32))return;
   const delta=lastFrame?Math.min(.08,(now-lastFrame)*.001):0;lastFrame=now;
   const simulationDelta=delta*(reducedMotion.matches?.35:1);time+=simulationDelta;
   context.globalAlpha=1;context.fillStyle=backdrop;context.fillRect(0,0,width,height);
   for(const layer of layers)paintLayer(context,atlas,layer,time,simulationDelta);
   context.globalAlpha=1;paintSignalScanlines(context,width,height);
  };
  const onVisibility=()=>{
   if(document.visibilityState==='visible'){lastFrame=0;if(!frame)frame=requestAnimationFrame(draw);}
   else{cancelAnimationFrame(frame);frame=0;lastFrame=0;}
  };
  resize();const observer=new ResizeObserver(resize);observer.observe(canvas);
  document.addEventListener('visibilitychange',onVisibility);
  frame=requestAnimationFrame(draw);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',onVisibility);};
 },[active]);
 return <canvas ref={ref} className="signal-rain" aria-hidden="true"/>;
}
