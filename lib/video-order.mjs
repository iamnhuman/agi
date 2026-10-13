/**
 * @template {{id:string,publishedAt:string}} T
 * @param {readonly T[]} videos
 * @param {'desc'|'asc'|'dates'} [order]
 * @param {readonly string[]} [timelineOrder]
 * @returns {T[]}
 */
export function orderVideos(videos,order='desc',timelineOrder=[]){
 const items=[...videos];
 if(order==='desc')return items.reverse();
 if(order==='asc')return items;
 const byDate=(a,b)=>{
  if(!a.publishedAt)return b.publishedAt?1:0;
  if(!b.publishedAt)return -1;
  return a.publishedAt.localeCompare(b.publishedAt);
 };
 items.sort(byDate);
 if(!timelineOrder.length)return items;
 const byId=new Map(items.map(video=>[video.id,video]));
 const ordered=[];
 for(const id of timelineOrder){
  const video=byId.get(id);
  if(video){ordered.push(video);byId.delete(id);}
 }
 // New materials enter near their date without disturbing the saved relative order.
 for(const video of items){
  if(!byId.has(video.id))continue;
  const before=ordered.findIndex(other=>byDate(video,other)<0);
  if(before<0)ordered.push(video);else ordered.splice(before,0,video);
 }
 return ordered;
}
