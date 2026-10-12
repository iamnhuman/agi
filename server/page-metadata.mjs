export function decodeHtml(s) { return s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Math.min(Number(n),0x10ffff))); }

export function htmlAttributes(tag) {
  const attrs={};
  for(const match of tag.matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g))attrs[match[1].toLowerCase()]=decodeHtml(match[3]);
  return attrs;
}

export function pageMeta(html,key) {
  for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){
    const attrs=htmlAttributes(tag);
    if(attrs.property===key||attrs.name===key)return attrs.content||'';
  }
  return '';
}

export async function responseText(response,limit=4000000) {
  const reader=response.body?.getReader();let text='',bytes=0;const decoder=new TextDecoder();
  if(!reader)return text;
  try{while(bytes<limit){const {done,value}=await reader.read();if(done)break;const chunk=value.subarray(0,limit-bytes);bytes+=chunk.byteLength;text+=decoder.decode(chunk,{stream:true});}text+=decoder.decode();}finally{await reader.cancel();}
  return text;
}
