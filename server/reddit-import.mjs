import {parseArtistLink} from './links.mjs';
import {remoteAvatarUrl,isRedditImageHost} from './avatar-files.mjs';
import {decodeHtml,htmlAttributes,pageMeta,responseText} from './page-metadata.mjs';

function imageUrl(...candidates) {
  for(const candidate of candidates){
    if(typeof candidate!=='string'||!candidate)continue;
    try{
      const url=remoteAvatarUrl(decodeHtml(candidate));
      if(isRedditImageHost(url.hostname))return url.href;
    }catch{}
  }
  return '';
}

function postMedia(data) {
  const gallery=(data.gallery_data?.items||[]).map(item=>data.media_metadata?.[item.media_id]?.s?.u);
  const previews=(data.preview?.images||[]).map(item=>item.source?.url);
  return {
    image:imageUrl(data.url_overridden_by_dest,data.url,...gallery,...previews,data.secure_media?.oembed?.thumbnail_url,data.media?.oembed?.thumbnail_url,data.thumbnail),
    isVideo:Boolean(data.is_video||data.media?.reddit_video||data.secure_media?.reddit_video||data.preview?.reddit_video_preview||data.media?.oembed?.type==='video'||data.secure_media?.oembed?.type==='video'||['hosted:video','rich:video'].includes(data.post_hint)),
  };
}

function postDate(value) {
  if(typeof value==='number'&&(!Number.isFinite(value)||value<=0))return '';
  if(typeof value!=='number'&&(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)))return '';
  try{
    const date=new Date(typeof value==='number'?value*1000:value).toISOString().match(/^\d{4}-\d{2}-\d{2}/)?.[0]||'';
    return typeof value==='string'&&date!==value.slice(0,10)?'':date;
  }catch{return '';}
}

function mergeMetadata(current,incoming) {
  if(!current)return incoming;
  return {...incoming,...current,name:current.name||incoming.name,image:current.image||incoming.image,publishedAt:current.publishedAt||incoming.publishedAt,isVideo:current.isVideo||incoming.isVideo};
}

function rssMetadata(xml,link) {
  const identifier=new URL(link.url).pathname.split('/').pop();
  // A post feed also contains comments; only the requested post owns its date.
  const entry=(xml.match(/<entry\b[^>]*>[\s\S]*?<\/entry>/gi)||[]).find(value=>value.match(/<id>([^<]*)<\/id>/i)?.[1]===`t3_${identifier}`);
  if(!entry)return null;
  const content=decodeHtml(entry.match(/<content\b[^>]*>([\s\S]*?)<\/content>/i)?.[1]||'');
  const images=(content.match(/<img\b[^>]*>/gi)||[]).map(tag=>htmlAttributes(tag).src);
  const thumbnail=htmlAttributes(entry.match(/<media:thumbnail\b[^>]*>/i)?.[0]||'').url;
  return {name:decodeHtml(entry.match(/<title\b[^>]*>([^<]*)<\/title>/i)?.[1]||'').slice(0,160),image:imageUrl(...images,thumbnail),publishedAt:postDate(entry.match(/<published>([^<]*)<\/published>/i)?.[1]),isVideo:/href=["']https:\/\/v\.redd\.it\//i.test(content)};
}

function jsonMetadata(payload,link) {
  const identifier=new URL(link.url).pathname.split('/').pop();
  if(link.redditType==='subreddit'){
    const data=payload?.data;
    if(payload?.kind!=='t5'||data?.display_name?.toLowerCase()!==identifier)return null;
    return {name:`r/${data.display_name}`,image:imageUrl(data.community_icon,data.icon_img,data.banner_background_image,data.banner_img,data.header_img)};
  }
  if(link.redditType==='user'){
    const data=payload?.data;
    if(payload?.kind!=='t2'||data?.name?.toLowerCase()!==identifier)return null;
    return {name:`u/${data.name}`,image:imageUrl(data.icon_img,data.snoovatar_img,data.subreddit?.icon_img)};
  }
  const listing=Array.isArray(payload)?payload[0]:payload;
  const data=listing?.data?.children?.find(child=>child.kind==='t3'&&child.data?.id?.toLowerCase()===identifier)?.data;
  if(!data)return null;
  const media=postMedia(data),parent=postMedia(data.crosspost_parent_list?.[0]||{});
  return {name:String(data.title||'').slice(0,160),image:media.image||parent.image,isVideo:media.isVideo||parent.isVideo,publishedAt:postDate(data.created_utc)};
}

function htmlMetadata(html,link) {
  const title=pageMeta(html,'og:title')||pageMeta(html,'twitter:title')||decodeHtml(html.match(/<title\b[^>]*>([^<]*)<\/title>/i)?.[1]||'');
  const valid=title&&!/^(?:reddit(?:\s*[-–|:]\s*dive into anything)?|welcome to reddit|log in.*|login.*|sign in.*|blocked.*|access denied.*)$/i.test(title.trim())&&!/blocked by network security|too many requests/i.test(title);
  let image='';
  // Community/profile pages must not accidentally take a photo from their feed.
  if(!link.isPost){
    const expected=link.name.toLowerCase();
    for(const tag of html.match(/<(?:img|faceplate-img|shreddit-subreddit-header|shreddit-profile-header)\b[^>]*>/gi)||[]){
      const attrs=htmlAttributes(tag);
      const alt=(attrs.alt||'').toLowerCase();
      if(alt===`${expected} icon`||alt===`${expected} avatar`||attrs['prefixed-name']?.toLowerCase()===expected){
        image=imageUrl(attrs['icon-url'],attrs.src);if(image)break;
      }
    }
    const ogImage=pageMeta(html,'og:image');
    if(!image&&/\/(?:communityIcon_|bannerBackgroundImage_|avatars\/)/i.test(ogImage))image=imageUrl(ogImage);
  }else image=imageUrl(pageMeta(html,'og:image'),pageMeta(html,'twitter:image'));
  if(!valid&&!image)return null;
  const result={name:link.isPost?title.replace(/\s*[:|–-]\s*(?:r\/\S+\s*[-–]\s*)?Reddit.*$/i,'').slice(0,160):link.name,image};
  if(link.isPost){
    const identifier=new URL(link.url).pathname.split('/').pop();
    const tag=(html.match(/<shreddit-post\b[^>]*>/gi)||[]).map(htmlAttributes).find(attrs=>attrs.id===`t3_${identifier}`)||{};
    const time=html.match(/<time\b[^>]*>/i)?.[0]||'';
    result.publishedAt=postDate(pageMeta(html,'article:published_time')||tag['created-timestamp']||htmlAttributes(time).datetime);
    result.isVideo=tag['post-type']==='video'||pageMeta(html,'og:type').startsWith('video')||Boolean(pageMeta(html,'og:video')||pageMeta(html,'og:video:url'));
  }
  return result;
}

async function redditResponse(target,fetcher,signal) {
  let url=new URL(target);
  for(let redirect=0;redirect<=3;redirect++){
    if(url.protocol!=='https:'||url.username||url.password||url.port||!['www.reddit.com','reddit.com','old.reddit.com','new.reddit.com','m.reddit.com'].includes(url.hostname))throw Error('Reddit перенаправил запрос за пределы поддерживаемых адресов.');
    if(!/^\/(?:r|u|user|comments|gallery)\//.test(url.pathname))throw Error('Reddit перенаправил запрос на страницу входа или служебный адрес.');
    const response=await fetcher(url.href,{redirect:'manual',signal,headers:{'User-Agent':'Mozilla/5.0 (compatible; ArtAtlas/1.0)'}});
    if(response.status>=300&&response.status<400&&response.headers.get('location')){
      const location=response.headers.get('location');await response.body?.cancel();url=new URL(location,url);continue;
    }
    return {response,url:url.href};
  }
  throw Error('Слишком много перенаправлений Reddit.');
}

export async function readRedditMetadata(initialLink,fetcher=fetch,{includeDate=false}={}) {
  let link=initialLink,metadata=null,sourceUrl=link.url;
  const signal=AbortSignal.timeout(12000);
  const complete=()=>metadata?.image&&(!includeDate||!link.isPost||metadata.publishedAt);
  if(link.redditType==='share')try{
    const result=await redditResponse(link.url,fetcher,signal);
    await result.response.body?.cancel();
    const resolved=parseArtistLink(result.url);
    if(resolved.platform==='Reddit'&&resolved.redditType==='post'){link=resolved;sourceUrl=result.url;}
  }catch{}
  if(link.redditType!=='share'){
    for(const target of [link.fetchUrl,link.fetchUrl.replace('www.reddit.com','old.reddit.com')]){
      try{
        const {response}=await redditResponse(target,fetcher,signal);
        if(response.ok&&response.headers.get('content-type')?.includes('application/json')){
          const found=jsonMetadata(JSON.parse(await responseText(response)),link);if(found)metadata=mergeMetadata(metadata,found);
        }
        else await response.body?.cancel();
      }catch{}
      if(complete()||signal.aborted)break;
    }
  }
  if(link.redditType==='post'&&!complete()&&!signal.aborted)try{
    const {response}=await redditResponse(`${link.url}/.rss`,fetcher,signal);
    if(response.ok&&/\b(?:atom\+xml|rss\+xml|xml)\b/i.test(response.headers.get('content-type')||'')){
      const fallback=rssMetadata(await responseText(response),link);
      if(fallback)metadata=mergeMetadata(metadata,fallback);
    }else await response.body?.cancel();
  }catch{}
  if(!complete()&&!signal.aborted){
    for(const target of [link.url,link.url.replace('www.reddit.com','old.reddit.com')]){
      try{
        const {response}=await redditResponse(target,fetcher,signal);
        if(response.ok&&response.headers.get('content-type')?.includes('text/html')){
          const fallback=htmlMetadata(await responseText(response),link);
          if(fallback)metadata=mergeMetadata(metadata,fallback);
        }else await response.body?.cancel();
      }catch{}
      if(complete()||signal.aborted)break;
    }
  }
  if(link.redditType==='post'&&!complete()&&!signal.aborted)try{
    const target=new URL('https://www.reddit.com/oembed');target.searchParams.set('url',link.url);
    const response=await fetcher(target.href,{redirect:'manual',signal,headers:{'User-Agent':'Mozilla/5.0 (compatible; ArtAtlas/1.0)'}});
    if(response.ok&&response.headers.get('content-type')?.includes('application/json')){
      const data=JSON.parse(await responseText(response));
      if(data.provider_name?.toLowerCase()==='reddit'&&typeof data.title==='string')metadata=mergeMetadata(metadata,{name:data.title.slice(0,160),image:imageUrl(data.thumbnail_url)});
    }else await response.body?.cancel();
  }catch{}
  return {link,metadata,sourceUrl};
}

export async function importRedditArtist(initialLink,fetcher=fetch) {
  const {link,metadata}=await readRedditMetadata(initialLink,fetcher),image=metadata?.image||'';
  return {metadataLoaded:Boolean(metadata),profileAvatar:!link.isPost&&Boolean(image),coverLoaded:Boolean(image),lowResolution:false,artist:{name:(metadata?.name||link.name).slice(0,120),url:link.url,platform:'Reddit',image,tags:''},notice:metadata?'Данные Reddit загружены. Проверьте карточку перед сохранением.':'Ссылка Reddit принята. Данные страницы недоступны — заполните карточку вручную.',...(!image?{imageNotice:metadata?'Reddit не отдал доступное изображение. Можно загрузить обложку вручную.':'Reddit ограничил загрузку данных. Ссылка принимается; обложку можно загрузить файлом или прямой ссылкой Reddit.'}:{})};
}
