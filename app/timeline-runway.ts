export function timelineRunwayFrame(width:number,height:number,timeMs=0){
 const seconds=Math.max(0,timeMs)/1000;
 const maxRadius=Math.min(460,Math.max(140,width*.46));
 return {
  seconds,breath:Math.sin(seconds*.55),
  horizon:height*.43+Math.sin(seconds*.42)*2.5,
  vanishX:width*.5+Math.sin(seconds*.28)*width*.012,
  gridShift:seconds*18%94,
  radar:Array.from({length:4},(_,index)=>{
   const phase=(seconds*.065+index/4)%1;
   return {radius:38+phase*(maxRadius-38),alpha:Math.sin(phase*Math.PI)*.22};
  }),
  depths:Array.from({length:7},(_,index)=>(index/7+seconds*.08)%1),
 };
}

/** Clock-driven decorative backdrop; only the date rail follows card scrolling. */
export function drawTimelineRunway(
 canvas:HTMLCanvasElement,
 railPosition?:number,
 dateTicks:Array<{x:number;label:string}>=[],
 timeMs=0,
){
 const bounds=canvas.getBoundingClientRect();
 const width=bounds.width,height=bounds.height;
 if(!width||!height)return;
 const ratio=Math.min(window.devicePixelRatio||1,2);
 const pixelWidth=Math.round(width*ratio),pixelHeight=Math.round(height*ratio);
 if(canvas.width!==pixelWidth||canvas.height!==pixelHeight){canvas.width=pixelWidth;canvas.height=pixelHeight;}
 const context=canvas.getContext('2d');
 if(!context)return;
 context.setTransform(ratio,0,0,ratio,0,0);
 context.clearRect(0,0,width,height);

 const {seconds,breath,horizon,vanishX,gridShift,radar,depths}=timelineRunwayFrame(width,height,timeMs);
 const ambient=context.createRadialGradient(vanishX,horizon,12,vanishX,horizon,width*.67);
 ambient.addColorStop(0,`rgba(165, 23, 28, ${.2+breath*.035})`);
 ambient.addColorStop(.42,'rgba(75, 14, 19, .07)');
 ambient.addColorStop(1,'rgba(0, 0, 0, 0)');
 context.fillStyle=ambient;
 context.fillRect(0,0,width,height);

 context.save();
 context.lineWidth=1;
 for(const {radius,alpha} of radar){
  context.strokeStyle=`rgba(221, 39, 46, ${alpha})`;
  context.beginPath();
  context.ellipse(vanishX,horizon,radius,radius*.38,0,Math.PI,2*Math.PI);
  context.stroke();
 }
 context.restore();

 const floor=context.createLinearGradient(0,horizon,0,height);
 floor.addColorStop(0,'rgba(73, 12, 17, .12)');
 floor.addColorStop(.55,'rgba(47, 11, 15, .08)');
 floor.addColorStop(1,'rgba(115, 19, 24, .16)');
 context.fillStyle=floor;
 context.fillRect(0,horizon,width,height-horizon);

 const sweepX=(seconds*48)%(width+320)-160;
 const sweep=context.createLinearGradient(sweepX-120,0,sweepX+120,0);
 sweep.addColorStop(0,'rgba(235, 49, 54, 0)');
 sweep.addColorStop(.5,'rgba(235, 49, 54, .075)');
 sweep.addColorStop(1,'rgba(235, 49, 54, 0)');
 context.fillStyle=sweep;
 context.fillRect(0,horizon,width,height-horizon);

 const spacing=94,shift=gridShift;
 context.strokeStyle='rgba(234, 56, 62, .32)';
 context.lineWidth=1;
 for(let bottomX=-width;bottomX<width*2;bottomX+=spacing){
  const x=bottomX-shift;
  context.beginPath();
  context.moveTo(vanishX+(x-vanishX)*.04,horizon);
  context.lineTo(x,height);
  context.stroke();
 }
 for(const depth of depths){
  const y=horizon+(height-horizon)*depth*depth;
  const fade=Math.min(1,depth*8,(1-depth)*8);
  context.strokeStyle=`rgba(231, 57, 63, ${(.12+depth*.2)*fade})`;
  context.beginPath();
  context.moveTo(0,y);
  context.lineTo(width,y);
  context.stroke();
 }

 // The single date scale stays still while the radar and floor animate behind it.
 const railBottom=height-(dateTicks.length?60:24);
 const railY=Math.min(railBottom,railPosition===undefined?height*.79:Math.max(Math.min(height*.43+24,railBottom),railPosition));
 const rail=context.createLinearGradient(0,railY,0,railY+18);
 rail.addColorStop(0,'rgba(255, 239, 71, .55)');
 rail.addColorStop(.18,'rgba(210, 27, 34, .64)');
 rail.addColorStop(1,'rgba(66, 5, 10, 0)');
 context.fillStyle=rail;
 context.fillRect(0,railY,width,18);

 context.save();
 context.textAlign='center';
 context.textBaseline='middle';
 context.font='700 10px ui-monospace, SFMono-Regular, Menlo, monospace';
 let lastLabelRight=-Infinity;
 for(const tick of [...dateTicks].sort((a,b)=>a.x-b.x)){
  const x=tick.x;
  if(x<0||x>width)continue;
  context.fillStyle='#f3e783';
  context.fillRect(x-1,railY-3,2,8);
  // Offscreen and tightly spaced cards must not pile their labels up at the edges.
  if(x<38||x>width-38||x-34<lastLabelRight+6)continue;
  lastLabelRight=x+34;
  context.strokeStyle='rgba(255, 232, 91, .78)';
  context.beginPath();
  context.moveTo(x,railY);
  context.lineTo(x,railY+12);
  context.lineTo(x,railY+25);
  context.stroke();
  context.fillStyle='#f3e783';
  context.fillRect(x-1,railY-1,3,3);
  context.fillStyle='rgba(12, 14, 16, .88)';
  context.fillRect(x-34,railY+25,68,19);
  context.strokeStyle='rgba(229, 48, 53, .55)';
  context.strokeRect(x-34,railY+25,68,19);
  context.fillStyle='#f3e783';
  context.fillText(tick.label,x,railY+35,64);
 }
 context.restore();
}
