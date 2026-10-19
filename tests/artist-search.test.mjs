import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const source=await readFile(new URL('../lib/artist-search.ts',import.meta.url),'utf8');
const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
const {matchesArtistSearch}=await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const artist={name:'goo.vision',url:'https://www.instagram.com/goo.vision/',tags:'AI art',description:'Digital landscapes'};

test('accidental words or letters after a complete handle do not hide its record',()=>{
 for(const query of ['goo.vision adfds','goo.visionadfds',' GOO.VISION  adfds  ','goo.vision\nadfds'])assert.equal(matchesArtistSearch(artist,query),true,query);
 assert.equal(matchesArtistSearch({...artist,name:'Березовый промпт'},'БЕРЕЗОВЫЙ   ПРОМПТ мусор'),true);
});

test('partial handles, tag phrases and empty searches remain supported',()=>{
 for(const query of ['goo.vis','vision','AI art','ai   ART','',' \n '])assert.equal(matchesArtistSearch(artist,query),true,query);
});

test('unknown queries and extra words after a partial handle do not broaden the results',()=>{
 for(const query of ['goo.xyz adfds','vision adfds','goo adfds','unrelated','landscapes missing'])assert.equal(matchesArtistSearch(artist,query),false,query);
 assert.equal(matchesArtistSearch({...artist,name:'AI',tags:'',description:''},'aiden missing'),false);
});

test('search retains names, tags and profile URLs while ignoring legacy descriptions',()=>{
 const adminFields=['name','url','tags'];
 assert.equal(matchesArtistSearch(artist,'instagram.com/goo.vision',adminFields),true);
 assert.equal(matchesArtistSearch(artist,'instagram.com/goo.vision'),true);
 assert.equal(matchesArtistSearch(artist,'digital landscapes',adminFields),false);
 assert.equal(matchesArtistSearch(artist,'digital landscapes'),false);
 assert.equal(matchesArtistSearch(artist,'AI art'),true);
});

test('a channel handle remains searchable when its display name is different',()=>{
 const channel={name:'Ринат Шакиров',url:'https://t.me/dailyprompts',tags:''};
 for(const query of ['Ринат','шакиров','dailyprompts','daily prompts',' DAILY  PROMPTS ','@dailyprompts','@daily prompts','t.me/dailyprompts','https://t.me/dailyprompts']){
  assert.equal(matchesArtistSearch(channel,query),true,query);
 }
 for(const query of ['daily other prompts','@anotherchannel','https://t.me/anotherchannel']){
  assert.equal(matchesArtistSearch(channel,query),false,query);
 }
 for(const query of ['dailyprompts','daily prompts','@dailyprompts']){
  assert.equal(matchesArtistSearch(channel,query,['name','tags']),false,query);
 }
 assert.equal(matchesArtistSearch({...channel,url:''},'daily prompts'),false);
});

test('the catalog name with a Latin accented letter matches Cyrillic and transliterated fragments',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../data/catalog.json',import.meta.url),'utf8'));
 const shamin=catalog.artists.find(artist=>artist.url==='https://www.instagram.com/shamincreator');
 assert.ok(shamin,'the reported artist is present in the catalog');
 for(const query of ['ша','шá','шa','шa\u0301','ША','sha','shа','sham','шамин','шаминкреатор','shaminkreator','shamincreator','@shamincreator','шамин креатор']){
  assert.equal(matchesArtistSearch(shamin,query),true,query);
 }
});

test('sha matches the same fragment in Cyrillic, Latin and mixed-script names without a profile URL',()=>{
 for(const name of ['шамин','shamin','шáмин','шaмин']){
  for(const query of ['ша','sha','шá','shа']){
   assert.equal(matchesArtistSearch({name,url:'',tags:''},query,['name']),true,`${query}: ${name}`);
  }
 }
});

test('transliteration and accents work for names, handles and tags in either script',()=>{
 const russian={name:'Берёзовый промпт',url:'https://t.me/visuals',tags:'нейроарт'};
 for(const query of ['березовый','berezovyy','promp','нейроарт','neyroart','висуалс']){
  assert.equal(matchesArtistSearch(russian,query),true,query);
 }
 const latin={name:'Beyoncé',url:'https://example.com/cafe',tags:'Crème brûlée'};
 for(const query of ['beyonce','café','creme brulee']){
  assert.equal(matchesArtistSearch(latin,query),true,query);
 }
 for(const query of ['алина','áлина','alína','aлина']){
  assert.equal(matchesArtistSearch({name:'Álina',url:'',tags:''},query),true,query);
 }
});

test('wrong, missing, extra or swapped letters do not match names or handles at any query length',()=>{
 const shamin={name:'шáминкреатор',url:'https://www.instagram.com/shamincreator',tags:''};
 for(const query of ['шомин','шминк','шаамин','шамни','shaimn','shamncreator','shamincreatro','shomincreotor','креатро']){
  assert.equal(matchesArtistSearch(shamin,query),false,query);
 }
 const channel={name:'Ринат Шакиров',url:'https://t.me/dailyprompts',tags:''};
 assert.equal(matchesArtistSearch(channel,'dailypromts'),false);
 assert.equal(matchesArtistSearch(channel,'shakriov'),false);
});

test('four-letter Cyrillic and Latin queries do not match unrelated fragments with one typo',()=>{
 const names=['derek.mercer','bagdelete','andreaciulu','nanophageresearch','Березовый промпт','exitdreamnow','spikeandred','EJANERESS'];
 const artists=names.map(name=>({name,url:`https://www.instagram.com/${name}`,tags:''}));
 for(const query of ['дере','dere','ДЕРЕ','дeрe','de re']){
  assert.deepEqual(artists.filter(artist=>matchesArtistSearch(artist,query)).map(artist=>artist.name),['derek.mercer'],query);
 }
});

test('normalization does not broaden unrelated fragments, tags, host names or excluded fields',()=>{
 const shamin={name:'шáминкреатор',url:'https://www.instagram.com/shamincreator',tags:'landscape'};
 for(const query of ['жо','жу','sh','sha']){
  assert.equal(matchesArtistSearch({name:'Other artist',url:'https://t.me/another',tags:''},query),false,query);
 }
 assert.equal(matchesArtistSearch(shamin,'жо'),false);
 assert.equal(matchesArtistSearch(shamin,'landscpae'),false);
 assert.equal(matchesArtistSearch(shamin,'instagarm'),false);
 for(const query of ['ь','ъ','\u0301','ь ъ','\u0301 \u0301'])assert.equal(matchesArtistSearch(shamin,query),false,query);
 assert.equal(matchesArtistSearch({name:'ьъь',url:'',tags:''},'unrelated'),false);
 assert.equal(matchesArtistSearch(shamin,'шамин',['tags']),false);
 assert.equal(matchesArtistSearch(shamin,'шаминкреатор extra',['tags']),false);
 const channel={name:'Ринат Шакиров',url:'https://t.me/dailyprompts',tags:''};
 assert.equal(matchesArtistSearch(channel,'dailypromts',['name','tags']),false);
 assert.equal(matchesArtistSearch({...channel,url:'not a URL'},'daily prompts'),false);
});
