export function parseArtistLink(raw:string){
 let url:URL;try{url=new URL(raw.trim());}catch{throw new Error('Вставьте полную ссылку, начиная с https://');}
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.port)throw new Error('Некорректная ссылка.');
 const host=url.hostname.toLowerCase().replace(/^www\./,'');
 if(!['instagram.com','t.me','telegram.me'].includes(host))throw new Error('Поддерживаются ссылки Instagram и Telegram.');
 const parts=url.pathname.split('/').filter(Boolean);
 if(!parts.length)throw new Error('Нужна ссылка на профиль или публикацию.');
 const telegram=host!=='instagram.com';
 if(telegram&&['joinchat','c','+','share','addstickers','proxy'].includes(parts[0])||parts[0].startsWith('+'))throw new Error('Нужна публичная ссылка на артиста.');
 if(telegram&&parts[0]==='s')parts.shift();
 if(!parts[0]||!/^[a-zA-Z0-9_.-]+$/.test(parts[0]))throw new Error('Некорректное имя профиля.');
 const post=!telegram&&['p','reel','reels','tv'].includes(parts[0]);
 if(post&&!parts[1])throw new Error('Неполная ссылка на публикацию.');
 const canonical=`https://${telegram?'t.me':'www.instagram.com'}/${parts.join('/')}`;
 return {url:canonical,platform:telegram?'Telegram':'Instagram',name:post?'':parts[0],isPost:post||telegram&&parts.length>1,fetchUrl:telegram?`https://t.me/${parts[0]}`:canonical};
}
