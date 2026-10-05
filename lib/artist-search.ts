import type {Artist} from './types';

type SearchableArtist=Pick<Artist,'name'|'url'|'tags'|'description'>;
type SearchField=keyof SearchableArtist;
const defaultFields:readonly SearchField[]=['name','tags','description'];
const normalizeSearch=(value:string)=>value.normalize('NFKC').toLowerCase().trim().replace(/\s+/g,' ');

export function matchesArtistSearch(artist:SearchableArtist,query:string,fields:readonly SearchField[]=defaultFields):boolean{
 const search=normalizeSearch(query);
 if(!search)return true;
 if(normalizeSearch(fields.map(field=>artist[field]??'').join(' ')).includes(search))return true;
 const name=normalizeSearch(artist.name);
 // Once a complete handle is entered, accidental text after it should not hide the artist.
 return Array.from(name).length>=3&&search.startsWith(name);
}
