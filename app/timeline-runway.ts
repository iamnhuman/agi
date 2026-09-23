/** Decorative, scroll-reactive backdrop. The interactive video cards stay in the DOM. */
export function drawTimelineRunway(canvas:HTMLCanvasElement,scrollLeft:number){
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

 const horizon=height*.43,vanishX=width*.5;
 const ambient=context.createRadialGradient(vanishX,horizon,12,vanishX,horizon,width*.67);
 ambient.addColorStop(0,'rgba(165, 23, 28, .16)');
 ambient.addColorStop(.42,'rgba(75, 14, 19, .07)');
 ambient.addColorStop(1,'rgba(0, 0, 0, 0)');
 context.fillStyle=ambient;
 context.fillRect(0,0,width,height);

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

 const spacing=94,shift=(scrollLeft*.42)%spacing;
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

 const railY=height*.79;
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
}
