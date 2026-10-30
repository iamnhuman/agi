import {htmlAttributes,responseText} from './page-metadata.mjs';

function authorName(value){
 return typeof value==='string'?value.replace(/\s+/g,' ').trim().slice(0,160):'';
}

export function youtubePageAuthor(html){
 // YouTube exposes the channel as a Person, separate from the video's title.
 const person=html.match(/<span\b[^>]*\bitemprop\s*=\s*["']author["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]||'';
 for(const tag of person.match(/<(?:link|meta)\b[^>]*>/gi)||[]){
  const attrs=htmlAttributes(tag);
  if(attrs.itemprop==='name'&&authorName(attrs.content))return authorName(attrs.content);
 }
 for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){
  const attrs=htmlAttributes(tag);
  if(attrs.name==='author'&&authorName(attrs.content))return authorName(attrs.content);
 }
 return '';
}

export async function youtubeEmbedAuthor(link,fetcher){
 try{
  const url=new URL('https://www.youtube.com/oembed');
  url.searchParams.set('url',link.fetchUrl);url.searchParams.set('format','json');
  const response=await fetcher(url.href,{redirect:'manual',signal:AbortSignal.timeout(12000)});
  if(!response.ok){await response.body?.cancel();return '';}
  const data=JSON.parse(await responseText(response,100000));
  return data?.provider_name==='YouTube'?authorName(data.author_name):'';
 }catch{return '';}
}
