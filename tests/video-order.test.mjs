import test from 'node:test';
import assert from 'node:assert/strict';
import {orderVideos} from '../lib/video-order.mjs';
const ids=videos=>videos.map(video=>video.id);
const record=(id,sourceOrder,publishedAt='')=>({id,name:id,sourceOrder,publishedAt});

test('the newest addition leads after deletion creates duplicate legacy source orders',()=>{
 const original=[record('deleted',0),record('older',1,'2026-09-20'),record('previous-newest',2,'2026-09-21')];
 const remaining=original.filter(video=>video.id!=='deleted');
 const appended=record('just-added',remaining.length,'2020-01-01');
 const catalog=[...remaining,appended];
 assert.equal(appended.sourceOrder,remaining.at(-1).sourceOrder,'Reproduce the catalog storage rank collision');
 assert.deepEqual(ids(orderVideos(catalog)),['just-added','previous-newest','older']);
 assert.deepEqual(ids(orderVideos(catalog,'asc')),['older','previous-newest','just-added']);
});

test('editing an older material does not turn it into a new addition',()=>{
 const catalog=[record('oldest',0,'2020-01-01'),record('middle',1),record('newest',2)];
 const edited=catalog.map(video=>video.id==='oldest'?{...video,name:'Updated title',publishedAt:'2026-10-05'}:video);
 assert.deepEqual(ids(orderVideos(edited,'desc')),['newest','middle','oldest']);
 assert.deepEqual(ids(orderVideos(edited,'asc')),['oldest','middle','newest']);
 assert.equal(orderVideos(edited).at(-1).name,'Updated title');
});

test('search preserves the relative addition order in both directions',()=>{
 const catalog=[record('match-first',0),record('other',1),record('match-middle',2),record('another',3),record('match-last',4)];
 const filtered=catalog.filter(video=>video.name.includes('match-'));
 assert.deepEqual(ids(orderVideos(filtered,'desc')),['match-last','match-middle','match-first']);
 assert.deepEqual(ids(orderVideos(filtered,'asc')),['match-first','match-middle','match-last']);
});

test('chronology sorts publication dates and keeps ties and unknown dates stable',()=>{
 const catalog=[record('unknown-first',0),record('same-date-first',1,'2025-03-04'),record('earliest',2,'2023-12-31'),record('unknown-second',3),record('same-date-second',4,'2025-03-04'),record('latest',5,'2026-01-01')];
 assert.deepEqual(ids(orderVideos(catalog,'dates')),['earliest','same-date-first','same-date-second','latest','unknown-first','unknown-second']);
});

test('every order returns a new array without changing the catalog or its records',()=>{
 const catalog=Object.freeze([Object.freeze(record('older',0,'2025-02-01')),Object.freeze(record('newer',1,'2024-01-01'))]);
 const snapshot=structuredClone(catalog);
 for(const mode of ['desc','asc','dates']){
  const ordered=orderVideos(catalog,mode);
  assert.notEqual(ordered,catalog);
  assert.deepEqual(catalog,snapshot);
  assert.ok(ordered.every(video=>catalog.includes(video)));
 }
});

test('manual chronology preserves dates and leaves addition orders unchanged',()=>{
 const catalog=[record('first',0,'2024-01-01'),record('middle',1,'2025-01-01'),record('last',2,'2026-01-01')];
 const manual=['last','first','middle'],snapshot=structuredClone(catalog);
 assert.deepEqual(ids(orderVideos(catalog,'dates',manual)),manual);
 assert.deepEqual(ids(orderVideos(catalog,'asc',manual)),['first','middle','last']);
 assert.deepEqual(ids(orderVideos(catalog,'desc',manual)),['last','middle','first']);
 assert.deepEqual(catalog,snapshot);
});

test('new and filtered materials keep the relative manual chronology',()=>{
 const catalog=[record('a',0,'2024-01-01'),record('b',1,'2025-01-01'),record('c',2,'2026-01-01'),record('new',3,'2023-01-01'),record('unknown',4)];
 assert.deepEqual(ids(orderVideos(catalog,'dates',['c','a','b'])),['new','c','a','b','unknown']);
 assert.deepEqual(ids(orderVideos(catalog.filter(video=>['a','c'].includes(video.id)),'dates',['missing','c','a','b','c'])),['c','a']);
});
