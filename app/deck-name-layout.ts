type NameLayout={fontSize:number;lines:string[]};
type MeasureText=(text:string,fontSize:number)=>number;

export function layoutDeckName(name:string,preferredSize:number,maxWidth:number,measure:MeasureText):NameLayout{
 const value=name.trim().replace(/\s+/g,' ');
 const minimumSize=Math.min(preferredSize,10);
 const words=value.split(' ');
 // Handles (including dots and underscores) stay intact; phrases wrap at spaces.
 for(let fontSize=preferredSize;fontSize>=minimumSize;fontSize--){
  if(words.some(word=>measure(word,fontSize)>maxWidth))continue;
  const lines:string[]=[];
  let line='';
  for(const word of words){
   const next=line?`${line} ${word}`:word;
   if(line&&measure(next,fontSize)>maxWidth){lines.push(line);line=word;}
   else line=next;
  }
  lines.push(line);
  if(lines.length<=2)return {fontSize,lines};
 }
 // An exceptionally long handle needs two balanced lines, never a lone tail.
 const characters=Array.from(value);
 for(let fontSize=preferredSize;fontSize>=minimumSize;fontSize--){
  let best:{lines:string[];difference:number}|undefined;
  for(let index=2;index<=characters.length-2;index++){
   const first=characters.slice(0,index).join('').trimEnd();
   const second=characters.slice(index).join('').trimStart();
   if(Array.from(first).length<2||Array.from(second).length<2)continue;
   const firstWidth=measure(first,fontSize),secondWidth=measure(second,fontSize);
   if(firstWidth>maxWidth||secondWidth>maxWidth)continue;
   const difference=Math.abs(firstWidth-secondWidth);
   if(!best||difference<best.difference)best={lines:[first,second],difference};
  }
  if(best)return {fontSize,lines:best.lines};
 }
 // Keep pathological lengths inside the plate without making the font unreadable.
 let first='';
 while(characters.length&&measure(first+characters[0],minimumSize)<=maxWidth)first+=characters.shift();
 let second=characters.join('').trimStart();
 while(second&&measure(second+'…',minimumSize)>maxWidth)second=Array.from(second).slice(0,-1).join('');
 return {fontSize:minimumSize,lines:[first,second+'…']};
}
