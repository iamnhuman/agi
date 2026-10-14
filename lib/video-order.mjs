/**
 * @template T
 * @param {readonly T[]} videos
 * @param {'desc'|'asc'} [order]
 * @returns {T[]}
 */
export function orderVideos(videos,order='desc'){
 const items=[...videos];
 return order==='desc'?items.reverse():items;
}

/**
 * Restore a complete chronological order when explicitly repairing the archive.
 * Empty dates precede dated entries in storage, so they follow them in desc view.
 * @template {{publishedAt:string,manualPosition?:boolean}} T
 * @param {readonly T[]} videos
 * @returns {T[]}
 */
export function sortVideosByDate(videos){
 return [...videos].sort((a,b)=>a.publishedAt.localeCompare(b.publishedAt));
}

/**
 * Insert or relocate one automatic card; retain every other card's relative order.
 * Manually positioned cards do not act as date boundaries.
 * @template {{id:string,publishedAt:string,manualPosition?:boolean}} T
 * @param {readonly T[]} videos
 * @param {T} video
 * @returns {T[]}
 */
export function placeVideoByDate(videos,video){
 const items=videos.filter(item=>item.id!==video.id);
 const at=items.findIndex(item=>!item.manualPosition&&item.publishedAt>video.publishedAt);
 items.splice(at<0?items.length:at,0,video);
 return items;
}

/**
 * Preview automatic placement using the same rule as the catalog store.
 * @template {{id:string,publishedAt:string,manualPosition?:boolean}} T
 * @param {readonly T[]} videos
 * @param {T} video
 * @param {'desc'|'asc'} [order]
 * @returns {number}
 */
export function videoPositionByDate(videos,video,order='desc'){
 const candidate={...video};delete candidate.manualPosition;
 const items=placeVideoByDate(videos,candidate);
 const at=items.indexOf(candidate);
 return order==='desc'?items.length-at:at+1;
}
