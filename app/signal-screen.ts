export const signalRasterScale=.5;

export function signalHash(value:number){
 value=Math.imul(value^(value>>>16),0x45d9f3b);
 value=Math.imul(value^(value>>>16),0x45d9f3b);
 return (value^(value>>>16))>>>0;
}

export function paintSignalScanlines(context:CanvasRenderingContext2D,width:number,height:number){
 for(let y=0;y<height;y+=4){
  context.fillStyle=y%12===0?'#5f152417':'#f45b6d09';
  context.fillRect(0,y,width,1);
 }
}
