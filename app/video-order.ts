import {orderVideos as sortVideos} from '../lib/video-order.mjs';

export type VideoOrder='desc'|'asc';

export function orderVideos<T extends {id:string;publishedAt:string}>(videos:readonly T[],order:VideoOrder='desc'):T[]{
 return sortVideos(videos,order);
}
