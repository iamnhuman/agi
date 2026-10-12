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

function jsonMetadata(payload,link) {
  const identifier=new URL(link.url).pathname.split('/').pop();
  if(link.redditType==='subreddit'){
    const data=payload?.data;
    if(payload?.kind!=='t5'||data?.display_name?.toLowerCase()!==identifier)return null;
    return {name:`r/${data.display_name}`,description:String(data.public_description||data.description||'').slice(0,1500),image:imageUrl(data.community_icon,data.icon_img,data.banner_background_image,data.banner_img,data.header_img)};
  }
  if(link.redditType==='user'){
    const data=payload?.data;
    if(payload?.kind!=='t2'||data?.name?.toLowerCase()!==identifier)return null;
    return {name:`u/${data.name}`,description:String(data.subreddit?.public_description||'').slice(0,1500),image:imageUrl(data.icon_img,data.snoovatar_img,data.subreddit?.icon_img)};
  }
  const listing=Array.isArray(payload)?payload[0]:payload;
  const data=listing?.data?.children?.find(child=>child.kind==='t3'&&child.data?.id?.toLowerCase()===identifier)?.data;
  if(!data)return null;
  const gallery=(data.gallery_data?.items||[]).map(item=>data.media_metadata?.[item.media_id]?.s?.u);
  const previews=(data.preview?.images||[]).map(item=>item.source?.url);
  return {name:String(data.title||'').slice(0,120),description:String(data.selftext||'').slice(0,1500),image:imageUrl(data.url_overridden_by_dest,data.url,...gallery,...previews,data.secure_media?.oembed?.thumbnail_url,data.thumbnail)};
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
  return {name:link.isPost?title.replace(/\s*[:|–-]\s*(?:r\/\S+\s*[-–]\s*)?Reddit.*$/i,'').slice(0,120):link.name,description:(pageMeta(html,'og:description')||pageMeta(html,'description')).slice(0,1500),image};
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

export async function importRedditArtist(initialLink,fetcher=fetch) {
  let link=initialLink,metadata=null;
  const signal=AbortSignal.timeout(12000);
  if(link.redditType==='share')try{
    const result=await redditResponse(link.url,fetcher,signal);
    await result.response.body?.cancel();
    const resolved=parseArtistLink(result.url);
    if(resolved.platform==='Reddit'&&resolved.redditType==='post')link=resolved;
  }catch{}
  if(link.redditType!=='share'){
    for(const target of [link.fetchUrl,link.fetchUrl.replace('www.reddit.com','old.reddit.com')]){
      try{
        const {response}=await redditResponse(target,fetcher,signal);
        if(response.ok&&response.headers.get('content-type')?.includes('application/json')){
          const found=jsonMetadata(JSON.parse(await responseText(response)),link);if(found)metadata=found;
        }
        else await response.body?.cancel();
      }catch{}
      if(metadata?.image||signal.aborted)break;
    }
  }
  if(!metadata?.image&&!signal.aborted){
    for(const target of [link.url,link.url.replace('www.reddit.com','old.reddit.com')]){
      try{
        const {response}=await redditResponse(target,fetcher,signal);
        if(response.ok&&response.headers.get('content-type')?.includes('text/html')){
          const fallback=htmlMetadata(await responseText(response),link);
          if(fallback)metadata=metadata?{...metadata,image:fallback.image}:fallback;
        }else await response.body?.cancel();
      }catch{}
      if(metadata?.image||signal.aborted)break;
    }
  }
  const image=metadata?.image||'';
  return {metadataLoaded:Boolean(metadata),profileAvatar:!link.isPost&&Boolean(image),coverLoaded:Boolean(image),lowResolution:false,artist:{name:metadata?.name||link.name,url:link.url,platform:'Reddit',description:metadata?.description||'',image,tags:''},notice:metadata?'Данные Reddit загружены. Проверьте карточку перед сохранением.':'Ссылка Reddit принята. Данные страницы недоступны — заполните карточку вручную.',...(!image?{imageNotice:metadata?'Reddit не отдал доступное изображение. Можно загрузить обложку вручную.':'Reddit ограничил загрузку данных. Ссылка принимается; обложку можно загрузить файлом или прямой ссылкой Reddit.'}:{})};
}
