import type {Artist,Section,Video} from '@/lib/types';

export type InitialCatalog={artists:Artist[];sections:Section[];videos:Video[]};

// Start the current catalog and the display font together. The first catalog
// render must never use the build's old photos or measure text in a fallback font.
export async function prepareWorkspace(
 url:string|null,
 fonts:Pick<FontFaceSet,'load'>|undefined,
 fetcher:typeof fetch=fetch,
 signal?:AbortSignal,
):Promise<InitialCatalog|null>{
 const fontReady=Promise.resolve().then(()=>fonts?.load('400 12px "Press Start 2P"','ИИзм AI')).catch(()=>{});
 const catalogReady=url?(async()=>{
  const response=await fetcher(url,{cache:'no-store',signal});
  if(!response.ok)throw Error('Не удалось загрузить архив.');
  const catalog=await response.json();
  if(!catalog||!Array.isArray(catalog.artists)||!Array.isArray(catalog.sections)||!Array.isArray(catalog.videos))throw Error('Не удалось прочитать архив.');
  return catalog as InitialCatalog;
 })():Promise.resolve(null);
 const [catalog]=await Promise.all([catalogReady,fontReady]);
 return catalog;
}
