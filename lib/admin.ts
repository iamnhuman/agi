import {getChatGPTUser} from '@/app/chatgpt-auth';
import {database} from './catalog';
// The Site starts owner-private. Its first authenticated curator is pinned permanently.
export async function isAdmin(){
 const user=await getChatGPTUser();if(!user)return false;
 const db=database();
 await db.prepare("INSERT OR IGNORE INTO settings (key,value) VALUES ('owner',?)").bind(user.userId).run();
 const row=await db.prepare("SELECT value FROM settings WHERE key='owner'").first<{value:string}>();
 return row?.value===user.userId;
}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');return !!origin&&origin===new URL(request.url).origin;}
