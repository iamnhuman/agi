const pageHosts=new Set(['soundcloud.com','www.soundcloud.com','m.soundcloud.com']);
const shortHosts=new Set(['on.soundcloud.com','soundcloud.app.goo.gl']);
const reserved=new Set(['discover','stream','feed','search','you','upload','settings','login','signin','signup','logout','terms-of-use','pages','jobs','oembed']);
const profileTabs=new Set(['tracks','albums','sets','reposts','likes','popular-tracks']);

export function isSoundCloudHost(host){return pageHosts.has(host)||shortHosts.has(host);}

export function parseSoundCloudUrl(raw){
 const url=new URL(raw);
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.port||!isSoundCloudHost(url.hostname))throw Error('Нужна ссылка SoundCloud на трек, плейлист или профиль.');
 const parts=url.pathname.split('/').filter(Boolean);
 if(shortHosts.has(url.hostname)){
  if(parts.length!==1||!/^[a-z\d_-]+$/i.test(parts[0]))throw Error('Некорректная короткая ссылка SoundCloud.');
  return {url:`https://${url.hostname}/${parts[0]}`,kind:'short'};
 }
 if(!parts.length||parts.some(part=>!/^[a-z\d_-]+$/i.test(part))||reserved.has(parts[0].toLowerCase()))throw Error('Нужна ссылка SoundCloud на трек, плейлист или профиль.');
 let kind='track',path=parts;
 if(parts.length===1||parts.length===2&&profileTabs.has(parts[1].toLowerCase())){kind='profile';path=parts.slice(0,1);}
 else if(parts[1].toLowerCase()==='sets'){
  if(parts.length!==3&&!(parts.length===4&&/^s-[a-z\d]+$/i.test(parts[3])))throw Error('Некорректная ссылка на плейлист SoundCloud.');
  kind='playlist';
 }else if(parts.length!==2&&!(parts.length===3&&/^s-[a-z\d]+$/i.test(parts[2])))throw Error('Некорректная ссылка на трек SoundCloud.');
 const canonical=new URL('https://soundcloud.com/'+path.map((part,index)=>index>1&&/^s-/i.test(part)?part:part.toLowerCase()).join('/'));
 const secret=url.searchParams.get('secret_token');
 if(secret&&kind!=='profile'){
  if(!/^s-[a-z\d]+$/i.test(secret))throw Error('Некорректная приватная ссылка SoundCloud.');
  canonical.searchParams.set('secret_token',secret);
 }
 return {url:canonical.href,kind};
}

export function soundcloudPlayerUrl(raw){
 try{
  const link=parseSoundCloudUrl(raw);
  if(!['track','playlist'].includes(link.kind))return '';
  const url=new URL('https://w.soundcloud.com/player/');
  url.searchParams.set('url',link.url);
  url.searchParams.set('auto_play','true');
  url.searchParams.set('show_artwork','true');
  url.searchParams.set('color','#ff5500');
  return url.href;
 }catch{return '';}
}
