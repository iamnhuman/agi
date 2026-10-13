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
