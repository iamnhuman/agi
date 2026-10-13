import {parseArtistLink} from './links.mjs';
import {decodeHtml as decode,pageMeta as meta,responseText as responseHtml} from './page-metadata.mjs';
import {importRedditArtist} from './reddit-import.mjs';
export function lowResolutionInstagramImage(url) { return /(?:^|[_-])s(?:100|150)x(?:100|150)(?:[_-]|$)/i.test(String(url)); }
// Only use HD URLs explicitly published for the requested profile.
export function instagramAvatar(html, username, fallback) {
  let best = fallback, bestWidth = 0;
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (typeof value.username === 'string' && value.username.toLowerCase() === username.toLowerCase()) {
      const candidates = [value.hd_profile_pic_url_info, ...(Array.isArray(value.hd_profile_pic_versions) ? value.hd_profile_pic_versions : []), {url:value.profile_pic_url_hd,width:320}];
      for (const candidate of candidates) {
        if (!candidate || typeof candidate.url !== 'string') continue;
        try {
          const url = new URL(candidate.url);
          const width = Number(candidate.width) || 320;
          if (url.protocol === 'https:' && /(^|\.)(cdninstagram\.com|fbcdn\.net)$/.test(url.hostname) && width > bestWidth) {best = candidate.url;bestWidth = width;}
        } catch {}
      }
    }
    for (const child of Object.values(value)) {
      if (typeof child === 'object') visit(child);
    }
  }
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {visit(JSON.parse(match[1]));} catch {}
  }
  if (!bestWidth) {
    for (const tag of html.match(/<img\b[^>]*>/gi) || []) {
      const attrs = {};
      for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g)) attrs[m[1].toLowerCase()] = decode(m[3]);
      if (attrs.alt?.toLowerCase() !== `${username.toLowerCase()}'s profile picture`) continue;
      try {
        const url = new URL(attrs.src);
        if (url.protocol === 'https:' && /(^|\.)(cdninstagram\.com|fbcdn\.net)$/.test(url.hostname)) {best = url.href;break;}
      } catch {}
    }
  }
  return best;
}
export async function importArtist(raw, fetcher = fetch) {
  const link = parseArtistLink(raw);
  if(link.platform==='Reddit')return importRedditArtist(link,fetcher);
  let name = link.name, image = '', loaded = false;
  try {
    const response = await fetcher(link.fetchUrl, {redirect:'manual', signal:AbortSignal.timeout(7000), headers:{'User-Agent':'Mozilla/5.0 (compatible; ArtAtlas/1.0)'}});
    if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
      const html=await responseHtml(response);
      const title = meta(html, 'og:title');
      const valid = title && !/^(instagram|telegram|log in|login|войти|telegram: contact)/i.test(title);
      if (valid) {
        name = title.replace(/\s*[•|–]\s*Instagram.*$/i,'').replace(/\s*\(@[^)]+\).*$/,'').slice(0,120);
        const metadataText = meta(html, 'og:description');
        if (link.platform === 'Instagram') name = link.isPost ? ((title + ' ' + metadataText).match(/@([a-zA-Z0-9._]+)/)?.[1] || '') : link.name;
        const img = meta(html, 'og:image');
        if (img.startsWith('https://')) image = img;
        if (link.platform === 'Instagram' && !link.isPost) image = instagramAvatar(html, link.name, image);
        loaded = true;
      }
    } else { await response.body?.cancel(); }
  } catch { /* Blocked metadata pages still produce a URL-derived draft. */ }
  return {profileAvatar:link.platform==='Telegram'&&Boolean(image),lowResolution:link.platform==='Instagram'&&lowResolutionInstagramImage(image),metadataLoaded:loaded,artist:{name,url:link.url,platform:link.platform,image,tags:''}, notice: loaded ? 'Доступные данные загружены. Проверьте карточку перед сохранением.' : link.isPost ? 'Это публикация. Площадка не отдала данные автора — укажите его имя вручную.' : 'Имя и площадка определены по ссылке. Обложку можно дополнить вручную.'};
}
