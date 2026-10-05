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

test('partial handles, full metadata phrases and empty searches remain supported',()=>{
 for(const query of ['goo.vis','vision','AI art','Digital landscapes','digital   landscapes','',' \n '])assert.equal(matchesArtistSearch(artist,query),true,query);
});

test('unknown queries and extra words after a partial handle do not broaden the results',()=>{
 for(const query of ['goo.xyz adfds','vision adfds','goo adfds','unrelated','landscapes missing'])assert.equal(matchesArtistSearch(artist,query),false,query);
 assert.equal(matchesArtistSearch({...artist,name:'AI',tags:'',description:''},'aiden missing'),false);
});

test('the curator retains URL search and each surface retains its own searchable fields',()=>{
 const adminFields=['name','url','tags'];
 assert.equal(matchesArtistSearch(artist,'instagram.com/goo.vision',adminFields),true);
 assert.equal(matchesArtistSearch(artist,'digital landscapes',adminFields),false);
 assert.equal(matchesArtistSearch(artist,'digital landscapes'),true);
});
