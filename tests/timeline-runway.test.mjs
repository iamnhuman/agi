import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const source=await readFile(new URL('../app/timeline-runway.ts',import.meta.url),'utf8');
const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
const {timelineRunwayFrame,drawTimelineRunway}=await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('radar and the perspective grid advance from time alone',()=>{
 const first=timelineRunwayFrame(1440,600,0),next=timelineRunwayFrame(1440,600,2000);
 assert.notEqual(first.gridShift,next.gridShift);
 assert.notDeepEqual(first.depths,next.depths);
 assert.notDeepEqual(first.radar,next.radar);
 assert.ok(next.radar[0].radius>first.radar[0].radius);
});

test('the same clock produces the same backdrop without cursor state',()=>{
 assert.deepEqual(timelineRunwayFrame(1440,600,3000),timelineRunwayFrame(1440,600,3000));
 assert.deepEqual(timelineRunwayFrame(390,420,0),timelineRunwayFrame(390,420,-100));
});

test('waves and grid cycles remain bounded on mobile and desktop',()=>{
 for(const width of [390,1440,2048])for(const time of [0,5000,16000,60000,86400000]){
  const frame=timelineRunwayFrame(width,600,time);
  assert.ok(frame.gridShift>=0&&frame.gridShift<94);
  assert.ok(frame.depths.every(depth=>depth>=0&&depth<1));
  assert.ok(frame.radar.every(wave=>wave.radius>=38&&wave.radius<=460&&wave.alpha>=0&&wave.alpha<=.22));
 }
});

test('radar waves fade away at the cycle boundary instead of jumping brightly',()=>{
 const duration=1000/.065;
 assert.ok(timelineRunwayFrame(1440,600,duration-1).radar[0].alpha<.001);
 assert.ok(timelineRunwayFrame(1440,600,duration+1).radar[0].alpha<.001);
});

test('each date connector starts on the timeline and ends on its own label frame',()=>{
 const width=900,height=500,railY=350;
 const ticks=[{x:450,label:'22.04.25'},{x:12,label:'18.04.25'},{x:888,label:'16.04.25'},{x:-20,label:'15.04.25'},{x:920,label:'15.04.25'}];
 const paths=[];let path=[];
 const gradient={addColorStop(){}};
 const context=new Proxy({}, {
  get(target,key){
   if(key in target)return target[key];
   if(key==='createRadialGradient'||key==='createLinearGradient')return ()=>gradient;
   if(key==='beginPath')return ()=>{path=[];};
   if(key==='moveTo'||key==='lineTo')return (x,y)=>path.push([x,y]);
   if(key==='stroke')return ()=>paths.push(path);
   return ()=>{};
  },
 });
 const canvas={width,height,getBoundingClientRect:()=>({width,height}),getContext:()=>context};
 const previousWindow=globalThis.window;globalThis.window={devicePixelRatio:1};
 try{
  drawTimelineRunway(canvas,0,railY,ticks,0);
  for(const tick of ticks){
   const center=Math.max(38,Math.min(width-38,tick.x));
   const anchor=Math.max(1,Math.min(width-1,tick.x));
   assert.ok(paths.some(points=>JSON.stringify(points)===JSON.stringify([[anchor,railY],[anchor,railY+12],[center,railY+25]])));
  }
  paths.length=0;
  drawTimelineRunway(canvas,0,height-20,ticks,0);
  for(const tick of ticks){
   const center=Math.max(38,Math.min(width-38,tick.x));
   assert.ok(paths.some(points=>points.length===3&&points[2][0]===center&&points[2][1]+19<=height-16),'Date frames must stay above the scrollbar');
  }
 }finally{
  if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
 }
});
