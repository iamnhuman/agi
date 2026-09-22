import http from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {createCatalogStore} from './catalog.mjs';
import {importVideo} from './video-import.mjs';
import {importArtist} from './import.mjs';
import {downloadRemoteAvatar,MAX_AVATAR_BYTES,saveAvatarBytes} from './avatar-files.mjs';
import {instagramSessionAvatar} from './instagram-session.mjs';
import {parseArtistLink} from './links.mjs';

const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon','.woff2':'font/woff2'};
function json(res,status,data) { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(data)); }
async function readBody(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw Object.assign(new Error('Нужен JSON-запрос.'), {status:415});
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 24000) throw Object.assign(new Error('Слишком большой запрос.'), {status:413});
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new Error('Некорректный JSON.'); }
}

async function readImage(req) {
  const type=(req.headers['content-type']||'').split(';')[0];
  if(!['image/jpeg','image/png','image/webp'].includes(type))throw Object.assign(new Error('Выберите изображение JPG, PNG или WebP.'),{status:415});
  const declaredSize=Number(req.headers['content-length']||0);
  if(declaredSize>MAX_AVATAR_BYTES)throw Object.assign(new Error('Файл должен быть не больше 50 МБ.'),{status:413});
  let size=0;const chunks=[];
  for await(const chunk of req){size+=chunk.length;if(size>MAX_AVATAR_BYTES)throw Object.assign(new Error('Файл должен быть не больше 50 МБ.'),{status:413});chunks.push(chunk);}
  return {type,bytes:Buffer.concat(chunks)};
}

export async function startServers({catalogFile,distDir,sitePort=3333,adminPort=3334,fetcher=fetch,dev=false}) {
  const store = createCatalogStore(catalogFile);
  await store.read(); // Never overwrite an existing or malformed catalog with the seed.
  let vite;
  if (dev) {
    const {createServer} = await import('vite');
    vite = await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
  }
  const actual = {};
  const servers = [];
  for (const [kind,port] of [['site',sitePort],['admin',adminPort]]) {
    const server = http.createServer(async (req,res) => {
      res.setHeader('X-Content-Type-Options','nosniff');
      res.setHeader('Referrer-Policy','no-referrer');
      res.setHeader('X-Frame-Options','DENY');
      res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
      try {
        const address = server.address();
        const allowedHosts = [`localhost:${address.port}`,`127.0.0.1:${address.port}`];
        if (!allowedHosts.includes(req.headers.host)) return json(res,403,{error:'Разрешён только локальный доступ.'});
        const url = new URL(req.url, `http://${req.headers.host}`);
        if (url.pathname.startsWith('/api/')) {
          if (url.pathname === '/api/catalog' && req.method === 'GET') return json(res,200,await store.read());
          if (req.method !== 'POST') return json(res,405,{error:'Метод не поддерживается.'});
          if (kind !== 'admin') return json(res,403,{error:'Изменения доступны только в админке.'});
          if (req.headers.origin !== `http://${req.headers.host}` || req.headers['sec-fetch-site'] === 'cross-site') return json(res,403,{error:'Запрос должен быть отправлен из локальной админки.'});
          if(url.pathname==='/api/avatar-upload'){
            const upload=await readImage(req);
            return json(res,200,{image:await saveAvatarBytes(upload.bytes,upload.type,distDir)});
          }
          const body = await readBody(req);
          if (url.pathname === '/api/catalog') return json(res,200,await store.mutate(body));
          if (url.pathname === '/api/video-import') return json(res,200,await importVideo(String(body?.url||''),fetcher));
          if (url.pathname === '/api/avatar-from-url') return json(res,200,{image:await downloadRemoteAvatar(String(body?.url||''),distDir,fetcher)});
          if (url.pathname === '/api/import') {
            const raw=String(body?.url || '');
            const link=parseArtistLink(raw);
            const imported=await importArtist(raw,fetcher);
            if(link.platform==='Instagram'&&!link.isPost){
              try{
                const profileAvatar=await instagramSessionAvatar(link.name);
                if(profileAvatar){
                  imported.artist.image=profileAvatar.url;
                  imported.profileAvatar=true;
                  imported.avatarWidth=profileAvatar.width;
                  imported.avatarHeight=profileAvatar.height;
                  imported.hdAvatar=profileAvatar.hd===true;
                  imported.lowResolution=!imported.hdAvatar;
                }
              }catch(error){imported.imageNotice=error.message;imported.sessionExpired=/сесси|login|logged in/i.test(error.message);}
            }
            if(imported.artist.image?.startsWith('https://')){
              try{imported.artist.image=await downloadRemoteAvatar(imported.artist.image,distDir,fetcher);imported.imageSavedLocally=true;}
              catch(error){imported.imageNotice=error.message;}
            }
            return json(res,200,imported);
          }
          return json(res,404,{error:'Неизвестный адрес.'});
        }
        if (!['GET','HEAD'].includes(req.method)) return json(res,405,{error:'Метод не поддерживается.'});
        if (url.pathname === '/' || url.pathname === '/index.html') {
          const entry = kind === 'admin' ? 'admin.html' : dev ? 'site.html' : 'index.html';
          let html = await readFile(resolve(dev ? '.' : distDir,entry),'utf8');
          if (dev) html = await vite.transformIndexHtml(kind === 'admin' ? '/admin.html' : '/site.html', html);
          const config = {siteUrl:`http://localhost:${actual.site}`,adminUrl:`http://localhost:${actual.admin}`};
          html = html.replace('</head>',`<script>window.__ATLAS_CONFIG__=${JSON.stringify(config)}</script></head>`);
          res.writeHead(200,{'Content-Type':mime['.html'],'Cache-Control':'no-store'});
          return res.end(req.method === 'HEAD' ? undefined : html);
        }
        // Local navigation is always explicit: public site and curator are separate ports.
        if (url.pathname === '/admin' || url.pathname === '/admin.html') { res.writeHead(302,{Location:`http://localhost:${actual.admin}/`}); return res.end(); }
        if (vite) return vite.middlewares(req,res,()=>json(res,404,{error:'Не найдено.'}));
        const path = resolve(distDir,'.'+decodeURIComponent(url.pathname));
        if (!path.startsWith(resolve(distDir)+sep)) return json(res,403,{error:'Нет доступа.'});
        const file = await stat(path).catch(()=>null);
        if (!file?.isFile()) return json(res,404,{error:'Не найдено.'});
        const content = await readFile(path);
        res.writeHead(200,{'Content-Type':mime[extname(path)] || 'application/octet-stream','Cache-Control':'no-cache'});
        res.end(req.method === 'HEAD' ? undefined : content);
      } catch (error) {
        if (!res.headersSent) json(res,error.status || 400,{error:error.message || 'Не удалось выполнить запрос.'});
        else res.end();
      }
    });
    try {
      await new Promise((resolve,reject) => { server.once('error',reject);server.listen(port,'127.0.0.1',resolve); });
      actual[kind] = server.address().port;
      servers.push(server);
    } catch (error) {
      await Promise.all(servers.map(s=>new Promise(r=>s.close(r))));
      await vite?.close();
      throw error;
    }
  }
  return {siteUrl:`http://localhost:${actual.site}`,adminUrl:`http://localhost:${actual.admin}`,close:async()=>{await Promise.all(servers.map(s=>new Promise(r=>{s.close(r);s.closeIdleConnections();})));await vite?.close();}};
}
