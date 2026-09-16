import {env} from 'cloudflare:workers';
import seed from './seed.json';
import {defaultSections,type Artist,type Section} from './types';
export function database(){if(!env.DB)throw new Error('Хранилище пока недоступно. Попробуйте позже.');return env.DB;}
export async function readCatalog(){
 const db=database();
 const [rows,groups]=await Promise.all([db.prepare('SELECT id,payload,deleted FROM artists').all<{id:string;payload:string;deleted:number}>(),db.prepare('SELECT id,name FROM sections ORDER BY rowid').all<Section>()]);
 const all=new Map<string,Artist>(seed.map(a=>[a.id,a]));
 for(const row of rows.results){if(row.deleted)all.delete(row.id);else all.set(row.id,JSON.parse(row.payload));}
 return {artists:[...all.values()],sections:[...defaultSections,...groups.results]};
}
