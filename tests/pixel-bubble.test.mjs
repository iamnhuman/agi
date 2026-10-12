import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const source=await readFile(new URL('../app/pixel-bubble.ts',import.meta.url),'utf8');
const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
const {pixelBubbleFrame,PIXEL_BUBBLE_DURATION}=await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('the acquisition beam crosses the message once and disappears',()=>{
 assert.equal(pixelBubbleFrame(0).scanX,null);
 const positions=[280,600,1000,1640].map(time=>pixelBubbleFrame(time).scanX);
 assert.equal(positions[0],34);assert.equal(positions.at(-1),266);
 assert.deepEqual(positions,[...positions].sort((a,b)=>a-b));
 assert.ok(positions.every(position=>Number.isInteger(position)&&position%2===0));
 assert.equal(pixelBubbleFrame(1700).scanX,null);
});

test('packet tears are brief and have limited displacement',()=>{
 assert.equal(pixelBubbleFrame(1240).glitch,2);
 assert.equal(pixelBubbleFrame(1700).glitch,-2);
 for(const time of [0,1219,1280,1500,1679,1740,2400])assert.equal(pixelBubbleFrame(time).glitch,0);
});

test('the receiver acquires the signal, drops out, and latches the error',()=>{
 assert.deepEqual([100,700,1400,2200].map(time=>pixelBubbleFrame(time).phase),['boot','scan','fault','hold']);
 const falling=[1200,1400,1600,1800,2200].map(time=>pixelBubbleFrame(time).carrier);
 assert.deepEqual(falling,[...falling].sort((a,b)=>b-a));
 assert.equal(falling.at(-1),0);
 assert.ok(Number.isInteger(pixelBubbleFrame(2200).radarStep));
 assert.equal(pixelBubbleFrame(2200).alarm,false);
});

test('reduced motion slows the instruments without displaced text or a scanning gate',()=>{
 for(const time of [0,500,1240,1700,2200]){
  const frame=pixelBubbleFrame(time,true);
  assert.equal(frame.scanX,null);assert.equal(frame.glitch,0);
  assert.ok(Number.isInteger(frame.radarStep));assert.equal(frame.alarm,false);
  assert.ok(frame.activityStep<=pixelBubbleFrame(time).activityStep);
  assert.equal(frame.progress,1);
  assert.equal(frame.phase,pixelBubbleFrame(time).phase);
 }
 assert.equal(pixelBubbleFrame(500,true).carrier,6);
 assert.equal(pixelBubbleFrame(2200,true).carrier,0);
});

test('all instrument clocks keep changing while the error is latched',()=>{
 for(const reducedMotion of [false,true]){
  const frames=Array.from({length:14},(_,index)=>pixelBubbleFrame(1840+index*40,reducedMotion));
  for(const field of ['radarStep','statusLamp','packetColumn','crcCell','dataHead','dataHeights','screenGlyph','caseCorner']){
   assert.ok(new Set(frames.map(frame=>JSON.stringify(frame[field]))).size>1,`${field} must keep animating`);
  }
 }
});

test('instrument animation stays inside its raster cells',()=>{
 for(const reducedMotion of [false,true])for(let time=0;time<=PIXEL_BUBBLE_DURATION;time+=35){
  const frame=pixelBubbleFrame(time,reducedMotion);
  for(const [value,limit] of [[frame.radarStep,16],[frame.statusLamp,3],[frame.packetColumn,6],
   [frame.crcCell,4],[frame.dataHead,12],[frame.screenGlyph,9],[frame.caseCorner,4]]){
   assert.ok(Number.isInteger(value)&&value>=0&&value<limit);
  }
  assert.equal(frame.dataHeights.length,12);
  assert.ok(frame.dataHeights.every(height=>Number.isInteger(height)&&height>=1&&height<=8));
 }
});

test('the animation is bounded to the existing bubble lifetime',()=>{
 assert.deepEqual(pixelBubbleFrame(-100),pixelBubbleFrame(0));
 assert.deepEqual(pixelBubbleFrame(9000),pixelBubbleFrame(PIXEL_BUBBLE_DURATION));
 assert.equal(pixelBubbleFrame(PIXEL_BUBBLE_DURATION).progress,1);
});
