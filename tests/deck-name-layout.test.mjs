import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const source=await readFile(new URL('../app/deck-name-layout.ts',import.meta.url),'utf8');
const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
const {layoutDeckName}=await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const measure=(value,size)=>Array.from(value).length*size;
const layout=(name,size=14)=>layoutDeckName(name,size,152,measure);

test('the reported handles stay whole at every deck typography size',()=>{
 for(let size=11;size<=20;size++)for(const name of ['northdeagle','luciodallas.ai']){
  const result=layout(name,size);
  assert.deepEqual(result.lines,[name]);
  assert.ok(measure(name,result.fontSize)<=152);
  assert.ok(result.fontSize<=size);
 }
});

test('short names keep their original size and punctuation stays in the handle',()=>{
 assert.deepEqual(layout('450dept'),{fontSize:14,lines:['450dept']});
 assert.deepEqual(layout('the_synthetic',18).lines,['the_synthetic']);
});

test('phrases wrap between complete words and retain the readable preferred size',()=>{
 assert.deepEqual(layout('Generative Gallery'),{fontSize:14,lines:['Generative','Gallery']});
 const result=layout('дельфин дружит с кукушкой');
 assert.equal(result.lines.join(' '),'дельфин дружит с кукушкой');
 assert.ok(result.lines.length<=2);
 assert.ok(result.lines.every(line=>measure(line,result.fontSize)<=152));
});

test('exceptionally long handles use balanced lines without orphan characters',()=>{
 const name='artificialinteligencevids';
 const result=layout(name,20);
 assert.equal(result.lines.length,2);
 assert.equal(result.lines.join(''),name);
 assert.ok(Math.abs(result.lines[0].length-result.lines[1].length)<=1);
 assert.ok(result.lines.every(line=>measure(line,result.fontSize)<=152));
 assert.ok(result.fontSize>=10);
});

test('pathological names are bounded and Unicode characters are not split',()=>{
 for(const name of ['x'.repeat(100),'🛸'.repeat(100)]){
  const result=layout(name);
  assert.equal(result.lines.length,2);
  assert.ok(result.lines[1].endsWith('…'));
  assert.ok(result.lines.every(line=>measure(line,result.fontSize)<=152));
  assert.equal(result.lines.join('').includes('\uFFFD'),false);
 }
});
