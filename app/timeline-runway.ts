/** Decorative, scroll- and pointer-reactive backdrop. The interactive cards stay in the DOM. */
export function drawTimelineRunway(
 canvas:HTMLCanvasElement,
 scrollLeft:number,
 railPosition?:number,
 dateTicks:Array<{x:number;label:string}>=[],
 pointer:{x:number;y:number}|null=null,
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

 const pointerOffsetX=pointer?(pointer.x-width*.5)*.035:0;
 const pointerOffsetY=pointer?(pointer.y-height*.43)*.025:0;
 const horizon=height*.43+pointerOffsetY,vanishX=width*.5+pointerOffsetX;
 const ambient=context.createRadialGradient(vanishX,horizon,12,vanishX,horizon,width*.67);
 ambient.addColorStop(0,'rgba(165, 23, 28, .16)');
 ambient.addColorStop(.42,'rgba(75, 14, 19, .07)');
 ambient.addColorStop(1,'rgba(0, 0, 0, 0)');
 context.fillStyle=ambient;
 context.fillRect(0,0,width,height);

 if(pointer){
  const cursorGlow=context.createRadialGradient(pointer.x,pointer.y,0,pointer.x,pointer.y,Math.min(width,height)*.34);
  cursorGlow.addColorStop(0,'rgba(232, 47, 52, .10)');
  cursorGlow.addColorStop(1,'rgba(232, 47, 52, 0)');
  context.fillStyle=cursorGlow;
  context.fillRect(0,0,width,height);
 }

 context.save();
 context.strokeStyle='rgba(221, 39, 46, .17)';
 context.lineWidth=1;
 for(const radius of [70,145,235,340]){
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

 const spacing=94,shift=(scrollLeft*.42+(pointer?.x||0)*.025)%spacing;
 context.strokeStyle='rgba(234, 56, 62, .23)';
 context.lineWidth=1;
 for(let bottomX=-width;bottomX<width*2;bottomX+=spacing){
  const x=bottomX-shift;
  context.beginPath();
  context.moveTo(vanishX+(x-vanishX)*.04,horizon);
  context.lineTo(x,height);
  context.stroke();
 }
 for(const depth of [.1,.17,.27,.41,.59,.81,1]){
  const y=horizon+(height-horizon)*depth*depth;
  context.strokeStyle=`rgba(231, 57, 63, ${.09+depth*.17})`;
  context.beginPath();
  context.moveTo(0,y);
  context.lineTo(width,y);
  context.stroke();
 }

 const railY=railPosition===undefined?height*.79:Math.max(horizon+24,Math.min(height-24,railPosition));
 const rail=context.createLinearGradient(0,railY,0,railY+18);
 rail.addColorStop(0,'rgba(255, 239, 71, .55)');
 rail.addColorStop(.18,'rgba(210, 27, 34, .64)');
 rail.addColorStop(1,'rgba(66, 5, 10, 0)');
 context.fillStyle=rail;
 context.fillRect(0,railY,width,18);
 context.fillStyle='rgba(255, 227, 84, .64)';
 for(let x=-spacing-shift;x<width+spacing;x+=spacing){
  context.fillRect(x,railY-3,2,8);
 }

 context.save();
 context.textAlign='center';
 context.textBaseline='middle';
 context.font='700 10px ui-monospace, SFMono-Regular, Menlo, monospace';
 for(const tick of dateTicks){
  const x=Math.max(38,Math.min(width-38,tick.x));
  context.strokeStyle='rgba(255, 232, 91, .62)';
  context.beginPath();
  context.moveTo(tick.x,railY+17);
  context.lineTo(tick.x,railY+25);
  context.stroke();
  context.fillStyle='rgba(12, 14, 16, .88)';
  context.fillRect(x-34,railY+25,68,19);
  context.strokeStyle='rgba(229, 48, 53, .55)';
  context.strokeRect(x-34,railY+25,68,19);
  context.fillStyle='#f3e783';
  context.fillText(tick.label,x,railY+35,64);
 }
 context.restore();
}
