import {readFile, writeFile, rename, mkdir, unlink} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {videoLink,validVideoDate} from './video-import.mjs';
import {parseArtistLink, linkKey} from './links.mjs';

export function validateCatalog(data) {
  if (!data || !Array.isArray(data.artists) || !Array.isArray(data.sections)) throw new Error('Повреждён файл каталога. Восстановите его из Git или резервной копии.');
  const ids = new Set();
  for (const s of data.sections) {
    if (!s || typeof s.id !== 'string' || typeof s.name !== 'string' || ids.has(s.id)) throw new Error('Некорректные разделы каталога.');
    ids.add(s.id);
  }
  const artists = new Set();
  for (const a of data.artists) {
    if (!a || ['id','name','url','section','platform','description','image','tags'].some(k => typeof a[k] !== 'string') || artists.has(a.id) || !ids.has(a.section)) throw new Error('Некорректная карточка в каталоге.');
    if (a.kind !== undefined && !['artist','media','collective'].includes(a.kind)) throw new Error('Неизвестный тип записи.');
    if (a.rating !== undefined && !['A','AA','AAA','AAA+','CRINGE'].includes(a.rating)) throw new Error('Неизвестный рейтинг записи.');
    parseArtistLink(a.url);
    artists.add(a.id);
  }
  if(data.videos!==undefined&&!Array.isArray(data.videos))throw Error('Некорректный список видео.');
  const videoIds=new Set();
  for(const v of data.videos||[]){if(!v||typeof v.id!=='string'||typeof v.name!=='string'||!validVideoDate(v.publishedAt)||videoIds.has(v.id))throw Error('Некорректная запись видео.');videoLink(v.url);videoIds.add(v.id);}
  return data;
}

export function createCatalogStore(file) {
  let queue = Promise.resolve();
  async function read() {
    const catalog = validateCatalog(JSON.parse(await readFile(file, 'utf8')));
    for (const artist of catalog.artists) if (artist.rating === 'CRINGE') artist.rating = 'A';
    return catalog;
  }
  function mutate(input) {
    const result = queue.then(async () => {
      const catalog = await read();
      let response;
      if (!input || typeof input !== 'object') throw new Error('Некорректный запрос.');
      if(input.action==='video-save'){
        const v=input.video;if(!v||!String(v.name||'').trim())throw Error('Укажите название видео или автора.');
        if(!validVideoDate(v.publishedAt))throw Error('Укажите корректную дату.');
        const link=videoLink(v.url);const list=catalog.videos||[];const old=list.find(x=>x.id===v.id);
        if(v.id&&!old)throw Error('Видео не найдено.');
        if(list.some(x=>x.id!==v.id&&(link.videoId?x.videoId===link.videoId:x.url===link.url)))throw Error('Видео уже есть в коллекции.');
        const image=String(v.image||'');if(image&&!image.startsWith('https://'))throw Error('Превью должно быть HTTPS-ссылкой.');
        const sourceDate=v.dateSource==='source'&&v.dateUrl===link.fetchUrl;
        const video={...old,...link,id:old?.id||randomUUID(),name:String(v.name).trim().slice(0,160),title:String(v.title||'').slice(0,250),publishedAt:v.publishedAt,dateSource:v.publishedAt?(sourceDate?'source':'manual'):'unknown',dateUrl:sourceDate?v.dateUrl:'',image:image.slice(0,4000),description:String(v.description||'').slice(0,1500),alternateUrls:old?.alternateUrls||[],sourceOrder:old?.sourceOrder??list.length};
        catalog.videos=old?list.map(x=>x.id===old.id?video:x):[...list,video];response={video};
      }else if(input.action==='video-delete'){
        if(!(catalog.videos||[]).some(v=>v.id===input.id))throw Error('Видео не найдено.');
        catalog.videos=catalog.videos.filter(v=>v.id!==input.id);response={ok:true};
      }else if (input.action === 'section') {
        throw new Error('География фиксирована: доступны только «Мир» и «Рунет».');
      } else if (input.action === 'delete') {
        if (!catalog.artists.some(a => a.id === input.id)) throw new Error('Запись уже удалена.');
        catalog.artists = catalog.artists.filter(a => a.id !== input.id);
        response = {ok: true};
      } else if (input.action === 'save') {
        const a = input.artist;
        if (!a || typeof a.url !== 'string') throw new Error('Укажите ссылку.');
        const link = parseArtistLink(a.url);
        const name = String(a.name || '').trim();
        if (!name || name.length > 120) throw new Error('Название: от 1 до 120 символов.');
        if (!catalog.sections.some(s => s.id === a.section)) throw new Error('Выберите существующий раздел.');
        if (a.id && !catalog.artists.some(x => x.id === a.id)) throw new Error('Запись не найдена.');
        const id = a.id || randomUUID();
        const original = catalog.artists.find(x => x.id === id);
        const changedLink = !original || linkKey(original.url) !== linkKey(link.url);
        if (changedLink && catalog.artists.some(x => x.id !== id && linkKey(x.url) === linkKey(link.url))) throw new Error('Эта ссылка уже есть в каталоге. Найдите карточку через поиск.');
        const image = String(a.image || '').trim();
        if (image && !/^\.\/avatars\/(instagram|upload)-[a-f0-9]{16}\.(jpg|png|webp)$/.test(image)) {
          let u;
          try { u = new URL(image); } catch { throw new Error('Некорректная ссылка на изображение.'); }
          if (u.protocol !== 'https:' || u.username || u.password || image.length > 4000) throw new Error('Для изображения нужна HTTPS-ссылка.');
        }
        const kind = a.kind ?? original?.kind ?? 'artist';
        if (!['artist','media','collective'].includes(kind)) throw new Error('Выберите тип: артист, медиа или гэнг.');
        const rating = a.rating === 'CRINGE' ? 'A' : a.rating ?? (original?.rating === 'CRINGE' ? 'A' : original?.rating) ?? 'A';
        if (!['A','AA','AAA','AAA+'].includes(rating)) throw new Error('Выберите тег A, AA, AAA или AAA+.');
        const artist = {id, kind, rating, name, url: link.url, platform: link.platform, section: a.section, image, description: String(a.description || '').slice(0,1500), tags: String(a.tags || '').slice(0,250)};
        const at = catalog.artists.findIndex(x => x.id === id);
        if (at >= 0) catalog.artists[at] = artist; else catalog.artists.unshift(artist);
        response = {artist};
      } else throw new Error('Неизвестное действие.');
      validateCatalog(catalog);
      await mkdir(dirname(file), {recursive: true});
      const temp = `${file}.${randomUUID()}.tmp`;
      try {
        await writeFile(temp, JSON.stringify(catalog, null, 2) + '\n', {flag:'wx'});
        await rename(temp, file);
      } finally { await unlink(temp).catch(() => {}); }
      return response;
    });
    queue = result.catch(() => {});
    return result;
  }
  return {read, mutate};
}
