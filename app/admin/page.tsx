import {requireChatGPTUser} from '../chatgpt-auth';
import {isAdmin} from '@/lib/admin';
import Admin from './panel';
export const dynamic='force-dynamic';
export default async function AdminPage(){await requireChatGPTUser('/admin');try{if(!await isAdmin())return <main className="status-page"><h1>Только для куратора</h1><p>У этого аккаунта нет прав на изменение каталога.</p><a href="/">← Вернуться в атлас</a></main>;}catch{return <main className="status-page"><h1>Хранилище недоступно</h1><p>Обновите страницу через несколько секунд.</p><a href="/">← Вернуться в атлас</a></main>;}return <Admin/>;}
