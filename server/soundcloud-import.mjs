import {parseSoundCloudUrl} from '../lib/soundcloud.mjs';
import {pageMeta,htmlAttributes,responseText} from './page-metadata.mjs';

function imageUrl(raw){
 try{
  const url=new URL(raw);
  if(url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&/(^|\.)sndcdn\.com$/.test(url.hostname))return url.href;
 }catch{}
 return '';
}
function dateValue(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value))return '';
 const date=value.slice(0,10),time=Date.parse(date);
 return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===date?date:'';
}
function samePage(raw,link){
 try{return new URL(parseSoundCloudUrl(raw).url).pathname===new URL(link.url).pathname;}catch{return false;}
}
function pageData(html,link){
 let name='',image='',publishedAt='';
 const hydration=html.match(/(?:window\.)?__sc_hydration\s*=\s*(\[[\s\S]*?\])\s*;/)?.[1];
 if(hydration)try{
  const kind=link.kind==='playlist'?'playlist':link.kind==='profile'?'user':'sound';
  const item=JSON.parse(hydration).find(item=>item.hydratable===kind&&samePage(item.data?.permalink_url,link))?.data;
  if(item){
   name=link.kind==='profile'?item.username:item.title+(item.user?.username?' — '+item.user.username:'');
   image=imageUrl(item.artwork_url)||imageUrl(item.avatar_url)||imageUrl(item.tracks?.find(track=>imageUrl(track.artwork_url))?.artwork_url)||imageUrl(item.user?.avatar_url);
   if(link.kind!=='profile')publishedAt=dateValue(item.display_date)||dateValue(item.created_at);
  }
 }catch{}
 // Read only the requested recording/playlist, never a nested track's date.
 if(!publishedAt&&link.kind!=='profile')for(const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
  if(htmlAttributes(script[1]).type!=='application/ld+json')continue;
  try{
   const data=JSON.parse(script[2]),items=Array.isArray(data)?data:Array.isArray(data['@graph'])?data['@graph']:[data];
   const types=link.kind==='playlist'?['MusicPlaylist','MusicAlbum']:['MusicRecording','AudioObject'];
   const item=items.find(item=>types.includes(item['@type'])&&samePage(item.url||item['@id'],link));
   publishedAt=dateValue(item?.datePublished)||dateValue(item?.uploadDate);
   if(publishedAt)break;
  }catch{}
 }
 const pageMatches=samePage(pageMeta(html,'og:url'),link);
 if(pageMatches){
  name=name||pageMeta(html,'og:title')||pageMeta(html,'twitter:title');
  image=imageUrl(pageMeta(html,'og:image'))||image||imageUrl(pageMeta(html,'twitter:image'));
  if(link.kind!=='profile')publishedAt=publishedAt||dateValue(pageMeta(html,'article:published_time'))||dateValue(pageMeta(html,'datePublished'));
 }
 return {name:typeof name==='string'?name.slice(0,160):'',image,publishedAt};
}
async function readPage(initial,fetcher){
 let link=initial;
 for(let redirects=0;redirects<4;redirects++){
  const response=await fetcher(link.url,{redirect:'manual',signal:AbortSignal.timeout(12000),headers:{'User-Agent':'Mozilla/5.0'}});
  const location=response.headers.get('location');
  if(response.status>=300&&response.status<400&&location){
   await response.body?.cancel();
   const target=new URL(location,link.url);
   if(target.protocol!=='https:')throw Error('Небезопасное перенаправление SoundCloud.');
   link=parseSoundCloudUrl(target.href);continue;
  }
  if(!response.ok){await response.body?.cancel();return {link,html:''};}
  return {link,html:await responseText(response)};
 }
 throw Error('Слишком много перенаправлений SoundCloud.');
}
async function readEmbed(link,fetcher){
 try{
  const url=new URL('https://soundcloud.com/oembed');
  url.searchParams.set('format','json');url.searchParams.set('url',link.url);
  const response=await fetcher(url.href,{redirect:'manual',signal:AbortSignal.timeout(12000)});
  if(!response.ok){await response.body?.cancel();return {};}
  const data=JSON.parse(await responseText(response,100000));
  if(data.provider_name!=='SoundCloud')return {};
  return {name:typeof data.title==='string'?data.title.slice(0,160):'',image:imageUrl(data.thumbnail_url)};
 }catch{return {};}
}

export async function importSoundCloud(raw,fetcher=fetch){
 let link=parseSoundCloudUrl(raw),page,embed;
 const read=()=>readPage(link,fetcher).catch(()=>({link,html:''}));
 if(link.kind==='short'){
  page=await read();link=page.link;
  embed=link.kind==='short'?{}:await readEmbed(link,fetcher);
 }else{
  [page,embed]=await Promise.all([read(),readEmbed(link,fetcher)]);
  if(page.link.url!==link.url){link=page.link;embed=await readEmbed(link,fetcher);}
 }
 const data=pageData(page.html,link),name=embed.name||data.name,image=embed.image||data.image;
 const publishedAt=data.publishedAt,metadataLoaded=Boolean(name||image||publishedAt);
 return {url:link.url,platform:'SoundCloud',videoId:'',fetchUrl:link.url,reference:link.kind==='profile',isVideo:false,
  name:name||new URL(link.url).pathname.split('/').filter(Boolean).at(-1),image,publishedAt,
  dateSource:publishedAt?'source':'unknown',dateUrl:publishedAt?link.url:'',metadataLoaded,
  ...(!metadataLoaded?{notice:'SoundCloud не отдал данные. Ссылка принята — название, дату и обложку можно заполнить вручную.'}:{})};
}
