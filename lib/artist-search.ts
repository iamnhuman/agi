import type {Artist} from './types';

type SearchableArtist=Pick<Artist,'name'|'url'|'tags'>;
type SearchField=keyof SearchableArtist;
const defaultFields:readonly SearchField[]=['name','url','tags'];
const normalizeSearch=(value:string)=>value.normalize('NFKC').toLowerCase().trim().replace(/\s+/g,' ');
const transliteration:Readonly<Record<string,string>>={
 а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',
 н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',
 ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',і:'i',ї:'yi',є:'ye',ґ:'g',ў:'u',
};
// Transliterate before removing accents so й keeps its sound, while á and а both become a.
const foldSearch=(value:string)=>normalizeSearch(value).replace(/[а-яёіїєґў]/g,letter=>transliteration[letter])
 .normalize('NFKD').replace(/\p{M}/gu,'').trim();
const compactSearch=(value:string)=>value.replace(/[^\p{L}\p{N}]+/gu,'');

export function matchesArtistSearch(artist:SearchableArtist,query:string,fields:readonly SearchField[]=defaultFields):boolean{
 const search=normalizeSearch(query);
 if(!search)return true;
 const text=fields.map(field=>artist[field]??'').join(' ');
 const folded=foldSearch(search);
 if(normalizeSearch(text).includes(search))return true;
 if(!folded)return false;
 if(foldSearch(text).includes(folded))return true;
 const candidates:string[]=[];
 if(fields.includes('name')){
  const name=foldSearch(artist.name);
  // Once a complete name is entered, accidental text after it should not hide the artist.
  if(name&&Array.from(normalizeSearch(artist.name)).length>=3&&folded.startsWith(name))return true;
  candidates.push(compactSearch(name));
 }
 // Handles remain searchable with spaces, punctuation or an @ prefix, independently of the name.
 if(fields.includes('url')){
  try{
   candidates.push(...new URL(artist.url).pathname.split('/').filter(Boolean)
    .map(part=>compactSearch(foldSearch(decodeURIComponent(part)))));
  }catch{}
 }
 const compactQuery=compactSearch(folded);
 if(!compactQuery)return false;
 return candidates.some(value=>value.includes(compactQuery));
}
