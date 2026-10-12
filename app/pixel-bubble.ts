export const PIXEL_BUBBLE_DURATION=2400;
const headline=Array.from('信号が破損しました');
const outline:[number,number][]=[
 [12,3],[288,3],[297,12],[297,82],[288,91],[163,91],
 [150,99],[137,91],[12,91],[3,82],[3,12],
];

export function pixelBubbleFrame(elapsed:number,reducedMotion=false){
 const time=Math.max(0,Math.min(PIXEL_BUBBLE_DURATION,elapsed));
 const phase=time>=1840?'hold':time<260?'boot':time<1160?'scan':'fault';
 const progress=reducedMotion?1:Math.max(0,Math.min(1,(time-160)/1800));
 const scanX=!reducedMotion&&time>=280&&time<=1640?34+Math.floor((time-280)/1360*116)*2:null;
 const glitch=!reducedMotion?(time>=1220&&time<1280?2:time>=1680&&time<1740?-2:0):0;
 const activityStep=Math.floor(time/(reducedMotion?180:70));
 const radarStep=activityStep%16;
 const carrier=reducedMotion?(phase==='boot'||phase==='fault'?2:phase==='scan'?6:0):phase==='boot'?Math.floor(time/35):phase==='scan'?6+Math.floor((time-260)/140)%3:phase==='fault'?Math.max(0,7-Math.floor((time-1160)/95)):0;
 const alarm=!reducedMotion&&phase==='fault'&&Math.floor((time-1160)/240)%2===0;
 // Instrument clocks remain active through the error latch, including reduced motion.
 const statusLamp=activityStep%3,packetColumn=activityStep%6;
 const crcCell=Math.floor(activityStep/2)%4,dataHead=activityStep%12;
 const dataHeights=Array.from({length:12},(_,segment)=>1+(segment*3+activityStep*(segment%3+1))%8);
 const screenGlyph=Math.floor(time/(reducedMotion?360:120))%headline.length;
 const caseCorner=Math.floor(time/(reducedMotion?360:210))%4;
 return {time,phase,progress,scanX,glitch,radarStep,carrier,alarm,
  activityStep,statusLamp,packetColumn,crcCell,dataHead,dataHeights,screenGlyph,caseCorner};
}

export function createPixelBubbleRenderer(canvas:HTMLCanvasElement){
 const context=canvas.getContext('2d');
 const letters=document.createElement('canvas');letters.width=300;letters.height=100;
 const brightLetters=document.createElement('canvas');brightLetters.width=300;brightLetters.height=100;
 for(const [layer,color] of [[letters,'#ffe1e6'],[brightLetters,'#fff3ce']] as const){
  const copy=layer.getContext('2d');if(!copy)continue;
  copy.textBaseline='middle';copy.textAlign='center';
  copy.font='600 20px "Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif';
  headline.forEach((glyph,index)=>{
   const x=168+(index-(headline.length-1)/2)*24;
   copy.fillStyle='#79283c';copy.fillText(glyph,x,50);
   copy.fillStyle=color;copy.fillText(glyph,x,49);
  });
 }
 return (elapsed:number,reducedMotion=false)=>{
  if(!context)return;
  const {phase,scanX,glitch,radarStep,alarm,activityStep,statusLamp,packetColumn,
   crcCell,dataHead,dataHeights,screenGlyph,caseCorner}=pixelBubbleFrame(elapsed,reducedMotion);
  const failed=phase==='fault'||phase==='hold';
  const ink=failed?'#ef7086':'#ffc96a',bright=failed?'#ffbfcb':'#ffe7a0';
  const gateX=scanX===null?null:48+Math.floor((scanX-34)/232*118)*2;
  const pixel=(x:number,y:number,width:number,height:number,color:string)=>{
   context.fillStyle=color;context.fillRect(Math.round(x),Math.round(y),width,height);
  };
  const label=(value:string,x:number,y:number,color='#a7b5b7',size=5)=>{
   context.font=`${size}px "Press Start 2P",monospace`;
   context.textBaseline='top';context.textAlign='left';context.fillStyle=color;context.fillText(value,x,y);
  };
  const polygon=(points:readonly (readonly [number,number])[])=>{
   context.beginPath();points.forEach(([x,y],index)=>index?context.lineTo(x,y):context.moveTo(x,y));context.closePath();
  };
  const bay=(x:number,y:number,width:number,height:number)=>{
   const cut=2;
   polygon([[x+cut,y],[x+width-cut,y],[x+width,y+cut],[x+width,y+height-cut],
    [x+width-cut,y+height],[x+cut,y+height],[x,y+height-cut],[x,y+cut]]);
   context.fillStyle='#080e14';context.fill();context.strokeStyle='#35424b';context.lineWidth=1;context.stroke();
   pixel(x+3,y+1,width-6,1,'#00080c');pixel(x+3,y+height-1,width-6,1,'#52606a');
  };
  context.clearRect(0,0,canvas.width,canvas.height);
  context.save();context.scale(canvas.width/300,canvas.height/100);context.imageSmoothingEnabled=false;

  // A double chamfered case surrounds independent, recessed instrument bays.
  context.save();context.translate(0,2);polygon(outline);context.fillStyle='#240913';context.fill();context.restore();
  polygon(outline);
  const casing=context.createLinearGradient(0,3,0,91);
  casing.addColorStop(0,'#68767b');casing.addColorStop(.055,'#29363e');
  casing.addColorStop(.18,'#151e27');casing.addColorStop(.84,'#111923');casing.addColorStop(1,'#39444f');
  context.fillStyle=casing;context.fill();context.strokeStyle='#bd677c';context.lineWidth=1;context.stroke();
  polygon([[13,7],[287,7],[293,13],[293,81],[287,87],[161,87],[150,95],[139,87],[13,87],[7,81],[7,13]]);
  context.strokeStyle='#060c12';context.lineWidth=2;context.stroke();
  pixel(16,5,268,1,'#b6a3a84d');pixel(17,88,119,1,'#9a687b55');pixel(164,88,119,1,'#9a687b55');
  for(const [corner,[x,y]] of [[8,14],[290,14],[8,78],[290,78]].entries()){
   pixel(x,y,2,4,'#02070b');pixel(x,y,1,2,corner===caseCorner?'#d8c0c5':'#657378');
  }

  // Header: identification plate, machine code and a separate annunciator.
  bay(12,11,170,15);bay(189,11,99,15);
  pixel(17,15,9,7,'#662637');pixel(18,16,7,5,activityStep%4<2?'#ffc0ca':'#b96d80');
  pixel(21,16,1,3,'#1d1420');pixel(21,20,1,1,'#1d1420');
  label('SIGNAL // ERROR',32,16,'#ffc0ca',6);
  pixel(131,14,1,9,'#39434c');label('SYS 04',138,17,'#94a3ad',5);
  pixel(196,16,4,4,activityStep%3===0?bright:ink);pixel(197,16,2,1,'#ffe4d7');
  label(phase==='boot'?'BOOT':phase==='scan'?'ACQUIRE':'OFFLINE',206,17,failed?bright:'#e7cc93',5);
  for(let lamp=0;lamp<3;lamp++){
   const lit=lamp===statusLamp;
   pixel(273+lamp*4,15,2,6,lit?ink:'#362732');
   pixel(273+lamp*4,15,2,1,lit?bright:'#715060');
  }

  // Left terminal: a pixel radar, locked crosshair and receiving channel.
  bay(12,31,29,36);
  pixel(16,35,21,21,'#02090e');
  const angle=radarStep*Math.PI/8-Math.PI/2;
  for(let y=-8;y<=8;y++)for(let x=-8;x<=8;x++){
   const radius=Math.hypot(x,y);if(radius>=9)continue;
   const ring=radius>=7&&radius<8;
   const delta=Math.atan2(Math.sin(Math.atan2(y,x)-angle),Math.cos(Math.atan2(y,x)-angle));
   const sweep=delta>=-.6&&delta<=.1;
   const axis=x===0||y===0;
   const color=sweep?(radius<2?bright:ink):ring?'#754255':axis?'#384653':'#02090e';
   pixel(26+x,45+y,1,1,color);
  }
  for(const [x,y] of [[16,35],[34,35],[16,53],[34,53]])pixel(x,y,3,1,'#9f6676');
  if(failed){
   for(let step=-4;step<=4;step++){
    pixel(26+step,45+step,1,1,alarm?bright:ink);pixel(26+step,45-step,1,1,alarm?bright:ink);
   }
  }
  pixel(29,40,2,2,activityStep%4<2?bright:'#384653');
  pixel(22,48,2,1,activityStep%4>=2?ink:'#384653');
  label('RX',22,60,'#bfc7c4',5);

  // The message sits inside its own glass screen, with no underlining or circuit trace.
  bay(48,31,240,36);
  const glass=context.createLinearGradient(0,32,0,66);
  glass.addColorStop(0,'#131e29');glass.addColorStop(.48,'#0d131d');glass.addColorStop(1,'#070c13');
  context.fillStyle=glass;context.fillRect(50,33,236,31);
  for(let y=34;y<64;y+=3)pixel(50,y,236,1,'#ffffff04');
  for(const [side,[x,direction]] of [[53,1],[282,-1]].entries()){
   const upper=caseCorner===side*2?ink:failed?'#a95d75':'#8b7956';
   const lower=caseCorner===side*2+1?ink:failed?'#a95d75':'#8b7956';
   pixel(x,35,4*direction,1,upper);pixel(x,35,1,4,upper);
   pixel(x,61,4*direction,1,lower);pixel(x,58,1,4,lower);
  }
  context.drawImage(letters,0,0);
  // A local phosphor highlight visits each glyph without moving the message.
  const glyphX=168+(screenGlyph-(headline.length-1)/2)*24;
  context.save();context.beginPath();context.rect(glyphX-12,36,24,25);context.clip();
  context.globalAlpha=reducedMotion?.35:.65;context.drawImage(brightLetters,0,0);context.restore();
  if(gateX!==null){
   context.save();context.beginPath();context.rect(gateX-3,35,6,27);context.clip();
   pixel(gateX-3,35,6,27,'#ffc96a0d');context.drawImage(brightLetters,0,0);context.restore();
   pixel(gateX-2,32,5,2,ink);pixel(gateX-2,64,5,2,ink);
  }
  if(glitch){
   for(const [y,height,offset] of [[44,2,glitch],[53,1,-glitch]]){
    context.save();context.beginPath();context.rect(55,y,226,height);context.clip();
    pixel(55,y,226,height,'#0d131d');context.globalAlpha=.4;context.drawImage(brightLetters,-offset,0);
    context.globalAlpha=1;context.drawImage(letters,offset,0);context.restore();
   }
  }

  // Three diagnostic cartridges show packets, receiver activity and CRC state.
  bay(12,72,76,12);bay(94,72,102,12);bay(202,72,86,12);
  label('CH-07',17,76,'#a3adb1',5);
  for(let row=0;row<3;row++)for(let column=0;column<6;column++){
   const active=column===packetColumn;
   const tail=column===(packetColumn+5)%6&&(row+activityStep)%3!==1;
   pixel(57+column*4,75+row*2,2,1,active?bright:tail?ink:'#303742');
  }
  label('DATA',100,76,'#a3adb1',5);
  for(let segment=0;segment<12;segment++){
   const height=dataHeights[segment];
   const lit=(segment-dataHead+12)%12<3;
   pixel(126+segment*5,81-height,3,height,lit?ink:'#36434b');
   pixel(126+segment*5,81-height,3,1,lit?bright:'#4a535e');
  }
  label('CRC',208,76,'#a3adb1',5);
  for(let cell=0;cell<4;cell++){
   const x=230+cell*7;
   pixel(x,75,5,6,'#1d2832');pixel(x,75,5,1,'#51606b');
   const cellInk=cell===crcCell?bright:failed?'#5a3041':'#6b6049';
   if(failed){pixel(x+1,77,3,1,cellInk);pixel(x+2,76,1,3,cellInk);}
   else pixel(x+1,77,3,2,cellInk);
  }
  pixel(265,74,1,8,'#39434c');
  label(failed?'04':'OK',272,76,failed?bright:'#decf9e',5);
  for(let tooth=0;tooth<3;tooth++){
   pixel(143+tooth*5,89,3,2,tooth===statusLamp?'#71818c':'#3d4b56');
   pixel(144+tooth*5,91,1,2,tooth===statusLamp?'#c38c9f':'#8e5b71');
  }
  context.restore();
 };
}
