import type {Artist} from './types';

type SearchableArtist=Pick<Artist,'name'|'url'|'tags'>;
type SearchField=keyof SearchableArtist;
const defaultFields:readonly SearchField[]=['name','url','tags'];
const normalizeSearch=(value:string)=>value.normalize('NFKC').toLowerCase().trim().replace(/\s+/g,' ');

export function matchesArtistSearch(artist:SearchableArtist,query:string,fields:readonly SearchField[]=defaultFields):boolean{
 const search=normalizeSearch(query);
 if(!search)return true;
 if(normalizeSearch(fields.map(field=>artist[field]??'').join(' ')).includes(search))return true;
 // Match a handle written with an @ prefix or spaces, independently of its display name.
 const handleQuery=search.replace(/^@/,'').replace(/ /g,'');
 if(fields.includes('url')&&handleQuery!==search&&/^[a-z0-9._-]+$/.test(handleQuery)){
  try{if(new URL(artist.url).pathname.toLowerCase().split('/').some(part=>part.includes(handleQuery)))return true;}catch{}
 }
 const name=normalizeSearch(artist.name);
 // Once a complete handle is entered, accidental text after it should not hide the artist.
 return Array.from(name).length>=3&&search.startsWith(name);
}
