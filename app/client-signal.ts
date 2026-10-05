export type ClientIpStatus={label:string;value:string};

const validIp=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-fA-F:.]{3,45}$/.test(value)&&/[.:]/.test(value);

export async function resolveClientIp(signal:AbortSignal,fetcher:typeof fetch=fetch):Promise<ClientIpStatus>{
 // A new URL for every lookup also bypasses intermediary caches on static hosting.
 const nonce=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
 const sources=[
  {url:`https://api64.ipify.org?format=json&_=${nonce}`,label:'PUBLIC IP',json:true},
  {url:`https://checkip.amazonaws.com/?_=${nonce}`,label:'PUBLIC IP',json:false},
  {url:`/api/client-ip?_=${nonce}`,label:'LINK IP',json:true},
 ];
 for(const source of sources){
  if(signal.aborted)break;
  try{
   const response=await fetcher(source.url,{signal:AbortSignal.any([signal,AbortSignal.timeout(3000)]),cache:'no-store',referrerPolicy:'no-referrer'});
   if(!response.ok)continue;
   const value=source.json?(await response.json()).ip:(await response.text()).trim();
   if(validIp(value))return {label:source.label,value};
  }catch{}
 }
 return {label:'CLIENT IP',value:'UNAVAILABLE'};
}
