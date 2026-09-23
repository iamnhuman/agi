/** Accept only public Instagram/Telegram profiles or posts, never arbitrary fetch URLs. */
export function parseArtistLink(raw) {
  const input=String(raw).trim();
  const username=input.replace(/^@/,'');
  const hostOnly=/^(?:www\.)?(?:instagram\.com|t\.me|telegram\.me)(?=\/|[?#]|$)/i.test(input);
  const completed=/^[a-zA-Z0-9._]+$/.test(username)?`https://www.instagram.com/${username}`:hostOnly?`https://${input}`:input;
  let url;
  try { url = new URL(completed); } catch { throw new Error('Вставьте ник Instagram или полную ссылку.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) throw new Error('Некорректная ссылка.');
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (!['instagram.com', 't.me', 'telegram.me'].includes(host)) throw new Error('Поддерживаются ссылки Instagram и Telegram.');
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
  return link.isPost && link.platform === 'Instagram' ? link.url : link.url.toLowerCase();
}
