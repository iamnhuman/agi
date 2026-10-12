import type {CSSProperties} from 'react';

export function materialHash(id:string,seed=0x5e2d3a91){
 let hash=2166136261^seed;
 for(let index=0;index<id.length;index++)hash=Math.imul(hash^id.charCodeAt(index),16777619);
 hash=Math.imul(hash^(hash>>>16),0x85ebca6b);
 return (hash^(hash>>>13))>>>0;
}

// Keep each casing's crop and patina attached to the record when it moves.
export function cardMaterial(id:string):CSSProperties{
 const grain=materialHash(id),light=materialHash(id,0x1a7c4f63),panel=materialHash(id,0x71af9d23);
 return {
  '--case-grain-x':`${grain%1024}px`,
  '--case-grain-y':`${(grain>>>10)%1024}px`,
  '--case-grain-size':`${280+(grain>>>20)%201}px`,
  '--case-panel-x':`${panel%1024}px`,
  '--case-panel-y':`${(panel>>>10)%1024}px`,
  '--case-panel-size':`${260+(panel>>>20)%181}px`,
  '--case-brush-angle':`${64+light%57}deg`,
  '--case-patina-x':`${12+(light>>>8)%77}%`,
  '--case-patina-y':`${15+(light>>>16)%71}%`,
  '--dossier-sheen-x':`${18+grain%65}%`,
  '--dossier-light-x':`${16+light%69}%`,
  '--dossier-light-y':`${12+(light>>>8)%70}%`,
  '--dossier-metal-angle':`${136+(grain>>>8)%23}deg`,
  '--dossier-grain-angle':`${80+(grain>>>16)%21}deg`,
  '--dossier-grain-step':`${5+(light>>>16)%5}px`,
 } as CSSProperties;
}

export function hardwareCode(id:string){
 return `D-${materialHash(id).toString(16).slice(-4).toUpperCase().padStart(4,'0')}`;
}
