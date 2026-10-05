export type VideoOrder='desc'|'asc'|'dates';

export function orderVideos<T extends {publishedAt:string}>(videos:readonly T[],order:VideoOrder='desc'):T[]{
 // Catalog storage appends new materials; edits retain their position.
 // Legacy sourceOrder values can repeat after deletion or batch imports.
 const items=[...videos];
 if(order==='desc')return items.reverse();
 if(order==='asc')return items;
 return items.sort((a,b)=>{
  if(!a.publishedAt)return b.publishedAt?1:0;
  if(!b.publishedAt)return -1;
  return a.publishedAt.localeCompare(b.publishedAt);
 });
}
