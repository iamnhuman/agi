import {access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';

const python=resolve('.venv-instagram/bin/python');
const helper=resolve('scripts/instagram_session.py');
const account=resolve('.local/instagram/account.json');
let queue=Promise.resolve();

async function configured(){try{await Promise.all([access(python),access(helper),access(account)]);return true;}catch{return false;}}

function runAvatar(username){
 return new Promise((resolvePromise,reject)=>{
  const child=spawn(python,[helper,'avatar',username],{cwd:resolve('.'),stdio:['ignore','pipe','pipe'],windowsHide:true});
  let stdout='',stderr='';
  const timer=setTimeout(()=>{child.kill('SIGTERM');reject(new Error('Instagram не ответил вовремя. Повторите попытку.'));},30000);
  child.stdout.on('data',chunk=>{stdout+=chunk;if(stdout.length>20000)child.kill('SIGTERM');});
  child.stderr.on('data',chunk=>{stderr+=chunk;if(stderr.length>20000)child.kill('SIGTERM');});
  child.on('error',error=>{clearTimeout(timer);reject(error);});
  child.on('close',code=>{
   clearTimeout(timer);
   if(code!==0)return reject(new Error(stderr.trim()||'Не удалось использовать Instagram-сессию.'));
   try{
    const data=JSON.parse(stdout.trim().split('\n').at(-1));
    if(data.username?.toLowerCase()!==username.toLowerCase()||!data.url?.startsWith('https://'))throw Error();
    resolvePromise(data);
   }catch{reject(new Error('Instagram вернул некорректные данные аватарки.'));}
  });
 });
}

export async function instagramSessionAvatar(username){
 if(!await configured())throw new Error('Instagram-сессия не подключена к этому запуску. Остановите сайт, запустите ./start из корня проекта и подключите сессию.');
 const task=queue.then(()=>runAvatar(username));
 queue=task.catch(()=>{}).then(()=>new Promise(resolveDelay=>setTimeout(resolveDelay,1200)));
 return task;
}
