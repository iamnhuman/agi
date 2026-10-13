import {orderVideos as sortVideos} from '../lib/video-order.mjs';

export type VideoOrder='desc'|'asc'|'dates';

export function orderVideos<T extends {id:string;publishedAt:string}>(videos:readonly T[],order:VideoOrder='desc',timelineOrder:readonly string[]=[]):T[]{
 return sortVideos(videos,order,timelineOrder);
}
