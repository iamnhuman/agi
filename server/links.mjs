import {completedProfileUrl} from '../lib/profile-url.mjs';

function redditLink(url) {
  const parts=url.pathname.split('/').filter(Boolean);
  const route=parts[0]?.toLowerCase();
  const account=/^[a-zA-Z0-9_-]{1,50}$/;
  const postId=/^[a-zA-Z0-9]{1,20}$/;
  let path,name='',isPost=false,redditType='post';
  const shortHost=url.hostname.replace(/^www\./,'')==='redd.it';
  if(shortHost&&(parts.length!==1||!postId.test(parts[0])))throw new Error('Нужна короткая ссылка Reddit на публикацию.');
  if(shortHost){
    path=`comments/${parts[0].toLowerCase()}`;isPost=true;
  }else if(route==='r'&&account.test(parts[1]||'')){
    const subreddit=parts[1].toLowerCase();
    if(parts.length===2||(parts.length===3&&['about','best','hot','new','top','rising'].includes(parts[2].toLowerCase()))){
      path=`r/${subreddit}`;name=`r/${parts[1]}`;redditType='subreddit';
    }else if(parts[2]==='comments'&&postId.test(parts[3]||'')&&parts.length<=6){
      path=`comments/${parts[3].toLowerCase()}`;isPost=true;
    }else if(parts[2]==='s'&&postId.test(parts[3]||'')&&parts.length===4){
      path=`r/${subreddit}/s/${parts[3]}`;isPost=true;redditType='share';
    }
  }else if(['u','user'].includes(route)&&account.test(parts[1]||'')&&parts.length===2){
    path=`user/${parts[1].toLowerCase()}`;name=`u/${parts[1]}`;redditType='user';
  }else if(['comments','gallery'].includes(route)&&postId.test(parts[1]||'')&&parts.length<=4){
    path=`comments/${parts[1].toLowerCase()}`;isPost=true;
  }
  if(!path)throw new Error('Нужна ссылка Reddit на сообщество, профиль или публикацию.');
  const canonical=`https://www.reddit.com/${path}`;
  const fetchUrl=redditType==='share'?canonical:redditType==='post'?`${canonical}.json?raw_json=1&limit=1`:`${canonical}/about.json?raw_json=1`;
  return {url:canonical,platform:'Reddit',name,isPost,fetchUrl,redditType};
}

/** Accept public links on supported platforms, never arbitrary fetch URLs. */
export function parseArtistLink(raw) {
  const completed=completedProfileUrl(raw);
  let url;
  try { url = new URL(completed); } catch { throw new Error('Вставьте ник Instagram или полную ссылку.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) throw new Error('Некорректная ссылка.');
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if(['reddit.com','old.reddit.com','new.reddit.com','m.reddit.com','redd.it'].includes(host))return redditLink(url);
  if (!['instagram.com', 't.me', 'telegram.me'].includes(host)) throw new Error('Поддерживаются ссылки Instagram, Telegram и Reddit.');
  const parts = url.pathname.split('/').filter(Boolean);
  const telegram = host !== 'instagram.com';
  if (telegram && parts[0] === 's') parts.shift();
  if (!parts[0] || !/^[a-zA-Z0-9_.-]+$/.test(parts[0])) throw new Error('Нужна публичная ссылка на профиль или публикацию.');
  const reserved = telegram ? ['joinchat', 'c', 'share', 'addstickers', 'proxy', 'login'] : ['accounts', 'explore', 'direct', 'stories', 'about'];
  if (reserved.includes(parts[0].toLowerCase())) throw new Error('Нужна публичная ссылка на артиста.');
  const post = !telegram && ['p', 'reel', 'reels', 'tv'].includes(parts[0]);
  if (post && (!parts[1] || !/^[\w-]+$/.test(parts[1]))) throw new Error('Неполная ссылка на публикацию.');
  if (parts.length > 2 || (telegram && parts[1] && !/^\d+$/.test(parts[1])) || (!telegram && !post && parts.length > 1)) throw new Error('Нужна ссылка на профиль или публикацию.');
  const canonical = `https://${telegram ? 't.me' : 'www.instagram.com'}/${parts.join('/')}`;
  return {url: canonical, platform: telegram ? 'Telegram' : 'Instagram', name: post ? '' : parts[0], isPost: post || (telegram && parts.length > 1), fetchUrl: telegram ? `https://t.me/${parts[0]}` : canonical};
}

export function linkKey(raw) {
  const link = parseArtistLink(raw);
  // Profile names are case-insensitive; Instagram post shortcodes are not.
  return (link.isPost && link.platform === 'Instagram') || link.redditType === 'share' ? link.url : link.url.toLowerCase();
}
