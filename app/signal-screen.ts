export const signalRasterScale=.5;

export function signalHash(value:number){
 value=Math.imul(value^(value>>>16),0x45d9f3b);
 value=Math.imul(value^(value>>>16),0x45d9f3b);
 return (value^(value>>>16))>>>0;
}

export function signalGlyphFrame(seed:number,cell:number,time:number,count:number){
 const identity=signalHash(seed^Math.imul(cell,0x85ebca6b));
 // Each fixed cell changes independently; a few hold their glyph longer.
 const period=identity%9===0?1.1+(identity%5)*.12:.09+(identity%13)*.027;
 const clock=time+identity%1000/1000,revision=Math.floor(clock/period);
 const glyph=(version:number)=>signalHash(identity^Math.imul(version+1,0x27d4eb2d))%count;
 const afterimage=identity%7===0?Math.max(0,1-(clock%period)/.07)*.35:0;
 return {index:glyph(revision),previous:glyph(revision-1),afterimage};
}

export function paintSignalScanlines(context:CanvasRenderingContext2D,width:number,height:number){
 for(let y=0;y<height;y+=4){
  context.fillStyle=y%12===0?'#5f152417':'#f45b6d09';
  context.fillRect(0,y,width,1);
 }
}
