import test from 'node:test';
import assert from 'node:assert/strict';
import {avatarDimensions} from '../server/avatar-files.mjs';

test('JPEG dimensions come from baseline and progressive frames after metadata',()=>{
 for(const marker of [192,194]){
  const bytes=Buffer.from([255,216,255,224,0,6,0,0,0,0,255,marker,0,11,8,4,56,4,56,1,1,17,0,255,217]);
  assert.deepEqual(avatarDimensions(bytes),{width:1080,height:1080});
 }
});

test('PNG and all common WebP formats report encoded dimensions',()=>{
 const png=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.write('IHDR',12);png.writeUInt32BE(640,16);png.writeUInt32BE(480,20);
 assert.deepEqual(avatarDimensions(png),{width:640,height:480});
 for(const kind of ['VP8X','VP8L','VP8 ']){
  const bytes=Buffer.alloc(30);bytes.write('RIFF');bytes.write('WEBP',8);bytes.write(kind,12);
  if(kind==='VP8X'){bytes.writeUIntLE(639,24,3);bytes.writeUIntLE(479,27,3);}
  else if(kind==='VP8L'){bytes[20]=47;bytes.writeUInt32LE(639|(479<<14),21);}
  else {bytes[23]=157;bytes[24]=1;bytes[25]=42;bytes.writeUInt16LE(640,26);bytes.writeUInt16LE(480,28);}
  assert.deepEqual(avatarDimensions(bytes),{width:640,height:480});
 }
});

test('truncated and unsupported images do not acquire invented dimensions',()=>{
 for(const bytes of [Buffer.alloc(0),Buffer.from([255,216,255,192,0]),Buffer.from([255,216,255,192,0,7]),Buffer.from('not an image')])assert.equal(avatarDimensions(bytes),null);
});
