import sharp from 'sharp';
import opentype from '@shuding/opentype.js';
import {readFile} from 'node:fs/promises';

// Author at game resolution, then double every pixel. Glyph outlines come from
// the site's own font so rendering never depends on installed system fonts.
const fontBytes = await readFile('public/fonts/PressStart2P-Regular.ttf');
const font = opentype.parse(fontBytes.buffer.slice(fontBytes.byteOffset,fontBytes.byteOffset + fontBytes.byteLength));
const text = (label,x,y,size=8,fill='#e4f1e6',anchor='start',shadow=false) => {
  const width = font.getAdvanceWidth(label,size);
  const left = Math.round(x - (anchor==='middle'?width/2:anchor==='end'?width:0));
  const path = font.getPath(label,left,y+size,size).toPathData(1);
  return `${shadow?`<path d="${path}" transform="translate(1 2)" fill="#020607"/>`:''}<path d="${path}" fill="${fill}"/>`;
};
const dataUri = buffer => `data:image/png;base64,${buffer.toString('base64')}`;
const pixelAsset = async (path,width) => dataUri(await sharp(path).resize({width,kernel:'nearest'})
  .png({palette:true,colours:32,dither:0}).toBuffer());
const [eagle,emblem,texture,map] = await Promise.all([
  pixelAsset('public/badges/region-en-eagle-cutout.png',112),
  pixelAsset('public/badges/region-ru-emblem-cutout.png',90),
  pixelAsset('public/textures/worn-steel.png',192),
  pixelAsset('public/radar-world-red.webp',600),
]);
const screw = (x,y) => `<path d="M${x-1} ${y-2}h3v1h1v3h-1v1h-3v-1h-1v-3h1Z" fill="#101b1b" stroke="#75877b"/><path d="M${x-1} ${y+1}l2-2" stroke="#b6c1a8"/>`;
const screen = (x,y,w,h) => `
 <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#glass)"/>
 <path d="M${x} ${y+h}V${y}h${w}" fill="none" stroke="#020607" stroke-width="2"/>
 <path d="M${x+w} ${y}v${h}H${x}" fill="none" stroke="#5b7267"/>
 <rect x="${x+1}" y="${y+1}" width="${w-2}" height="${h-2}" fill="url(#scan)"/>
`;
const panel = (x,y,w,h) => `
 <rect x="${x+1}" y="${y+3}" width="${w}" height="${h}" fill="#020607"/>
 <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#steel)" stroke="#020607" stroke-width="2"/>
 <path d="M${x} ${y+h}V${y}h${w}" fill="none" stroke="#b8c2af"/>
 <path d="M${x+w} ${y}v${h}H${x}" fill="none" stroke="#4e625a"/>
 <rect x="${x+2}" y="${y+2}" width="${w-4}" height="${h-4}" fill="url(#case)" stroke="#030a0d"/>
 <rect x="${x+3}" y="${y+3}" width="${w-6}" height="${h-6}" fill="url(#grain)" opacity=".09"/>
 <path d="M${x+4} ${y+4}h${Math.round((w-8)*.58)}" stroke="#d83124"/>
 <path d="M${x+4+Math.round((w-8)*.58)} ${y+4}H${x+w-4}" stroke="#60786b"/>
`;
const matrix = (x,y,seed=0) => Array.from({length:18},(_,i) =>
  `<rect x="${x+(i%6)*3}" y="${y+Math.floor(i/6)*3}" width="2" height="2" fill="${((i*7+seed)%11)<5?'#b6caa2':'#31463c'}"/>`).join('');
const spectrum = (x,y,count=12,height=10,seed=0) => Array.from({length:count},(_,i) => {
  const level = 1 + ((i*7+seed*3)%height);
  return Array.from({length:Math.ceil(level/2)},(_,row) => `<rect x="${x+i*3}" y="${y-row*2}" width="2" height="1" fill="${row>height/3?'#d9c985':'#91ad90'}"/>`).join('');
}).join('');
const reticle = (x,y) => `<g transform="translate(${x} ${y})" fill="none" stroke="#93a78e">
 <path d="M2 1H0v4M0 9v4h2M18 1h2v4M20 9v4h-2M6 0h8v14H6zM3 7h14M10 3v8"/>
 <rect x="8" y="5" width="4" height="4" stroke="#ced3a5"/>
 </g>`;
const instruments = (x,y,w,variant=0) => `
 ${screen(x,y,w,13)}
 <path d="M${x+6} ${y+7}h2l2-4 2 8 2-4h2" fill="none" stroke="#697f70"/>
 <path d="M${x+19} ${y+2}v9M${x+w-48} ${y+2}v9M${x+w-24} ${y+2}v9" stroke="#344a3f"/>
 ${variant?spectrum(x+24,y+10,14,9,3):`<path d="M${x+24} ${y+7}h4l2-4 3 8 2-6 3 4 2-6 3 4h6l2-3 2 6 2-5 3 3 2-1h5" fill="none" stroke="#a3b69a"/>`}
 ${matrix(x+w-44,y+3,variant*3)}
 ${reticle(x+w-22,y)}
 <rect x="${x+w-3}" y="${y+9}" width="2" height="2" fill="#f0442b"/>
`;
const button = (x,y,w,label) => `
 <rect x="${x}" y="${y}" width="${w}" height="16" fill="url(#button)" stroke="#030809"/>
 <path d="M${x} ${y+15}V${y}h${w}" fill="none" stroke="#c4a266"/>
 <path d="M${x+w} ${y}v16H${x}" fill="none" stroke="#381510"/>
 ${text(label,x+5,y+4,8,'#ffdf79')}
 <path d="M${x+w-12} ${y+11}l6-6m-6 0h6v6" fill="none" stroke="#ffdf79"/>
`;
const faction = (x,label,source,asset,width,height,offsetY,variant) => `
 ${panel(x,59,142,191)}
 ${screen(x+7,70,128,104)}
 <g stroke="#253e36" fill="none"><path d="M${x+7} 96h128M${x+7} 122h128M${x+7} 148h128M${x+39} 70v104M${x+71} 70v104M${x+103} 70v104"/></g>
 <image href="${asset}" x="${x+Math.round((142-width)/2)}" y="${offsetY}" width="${width}" height="${height}"/>
 <path d="M${x+12} 86V76h10M${x+120} 168h10v-10" fill="none" stroke="#c8d7bc"/>
 <rect x="${x+86}" y="73" width="45" height="14" fill="#101e1b" stroke="#637a67"/>
 ${text(source==='ALLIED'?'США':'СССР',x+108,77,8,'#ffdf79','middle')}
 ${button(x+7,181,96,source)}
 ${screen(x+7,203,128,24)}
 ${text(label,x+14,207,16,'#e4f1e6','start',true)}
 ${instruments(x+7,232,128,variant)}
`;

const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="315" viewBox="0 0 600 315" shape-rendering="crispEdges">
 <defs>
  <linearGradient id="case" x2=".7" y2="1"><stop stop-color="#2c3838"/><stop offset=".48" stop-color="#0e1b1e"/><stop offset="1" stop-color="#081113"/></linearGradient>
  <linearGradient id="steel" x2="0" y2="1"><stop stop-color="#a3afa0"/><stop offset=".12" stop-color="#45574d"/><stop offset=".45" stop-color="#20302d"/><stop offset="1" stop-color="#64776b"/></linearGradient>
  <linearGradient id="glass" x2="0" y2="1"><stop stop-color="#030809"/><stop offset=".55" stop-color="#0b1719"/><stop offset="1" stop-color="#03090b"/></linearGradient>
  <linearGradient id="button" x2="0" y2="1"><stop stop-color="#973a26"/><stop offset=".25" stop-color="#702419"/><stop offset="1" stop-color="#371511"/></linearGradient>
  <linearGradient id="title-gold" x2="0" y2="1"><stop stop-color="#fff4b6"/><stop offset=".5" stop-color="#fff4b6"/><stop offset=".5" stop-color="#e2b750"/><stop offset="1" stop-color="#e2b750"/></linearGradient>
  <linearGradient id="title-red" x2="0" y2="1"><stop stop-color="#ff6854"/><stop offset=".5" stop-color="#ff6854"/><stop offset=".5" stop-color="#d72921"/><stop offset="1" stop-color="#d72921"/></linearGradient>
  <radialGradient id="shade"><stop stop-color="#060204" stop-opacity=".15"/><stop offset="1" stop-color="#030609" stop-opacity=".9"/></radialGradient>
  <pattern id="scan" width="2" height="3" patternUnits="userSpaceOnUse"><path d="M0 0h2" stroke="#000" opacity=".25"/></pattern>
  <pattern id="grain" width="192" height="192" patternUnits="userSpaceOnUse"><image href="${texture}" width="192" height="192"/></pattern>
  <pattern id="hazard" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#4e110c"/><path d="M-4 8 4 0H8L0 8ZM4 8 12 0H16L8 8Z" fill="#d83322"/></pattern>
  <clipPath id="map-bay"><rect x="170" y="62" width="260" height="184"/></clipPath>
 </defs>
 <image href="${map}" width="600" height="315" preserveAspectRatio="xMidYMid slice"/>
 <rect width="600" height="315" fill="url(#shade)"/>

 <!-- Card housing, stepped corners and the same red/steel progress rail. -->
 <path d="M9 4H591v3h5v5h2v291h-2v5h-5v3H9v-3H4v-5H2V12h2V7h5Z M13 13v289h574V13Z" fill="url(#steel)" fill-rule="evenodd" stroke="#030809" stroke-width="2"/>
 <path d="M7 302V12h5V7H588" stroke="#a8b69c" fill="none"/>
 <path d="M592 13v289h-5v5H12" stroke="#4f6558" fill="none"/>
 <rect x="589" y="22" width="4" height="270" fill="url(#hazard)"/>
 ${screw(9,10)}${screw(590,10)}${screw(9,305)}${screw(590,305)}

 <!-- Dense command header and actual pixel lettering from the website. -->
 ${panel(18,16,564,36)}
 ${text('ИИЗМ',26,25,16,'#ffdf79','start',true)}
 <path d="M102 23v22" stroke="#52675b"/>
 ${text('AI CULTURE',112,24,8,'#e4f1e6')}
 ${text('ARCHIVE SYSTEM',112,37,6,'#93a78e')}
 ${screen(230,25,146,19)}
 ${text('СИСТЕМА В СЕТИ',238,28,6,'#d9d99d')}
 ${Array.from({length:25},(_,i)=>`<rect x="${238+i*5}" y="39" width="3" height="2" fill="${i<19?'#b5c095':'#32483e'}"/>`).join('')}
 ${[0,1,2,3].map(i=>panel(466+i*26,23,21,22)).join('')}
 ${matrix(469,30,3)}
 ${reticle(493,27)}
 <path d="M524 28v12l10-6Z" fill="none" stroke="#ffdf79"/>
 <path d="M550 29h12M550 34h12M550 39h12" stroke="#b3c19b"/>
 ${text('EN / RU',389,29,8,'#ffdf79')}

 ${faction(18,'МИР','ALLIED',eagle,112,69,94,1)}
 ${faction(440,'РУНЕТ','SOVIET',emblem,90,84,88,0)}

 <!-- A tactical display instead of the previous smooth poster wordmark. -->
 ${panel(167,59,266,191)}
 <image href="${map}" x="157" y="37" width="286" height="210" preserveAspectRatio="xMidYMid slice" clip-path="url(#map-bay)"/>
 <rect x="170" y="62" width="260" height="184" fill="#030809" opacity=".48"/>
 <g fill="none" stroke="#9b2e24" opacity=".85">
  <circle cx="300" cy="151" r="81"/><circle cx="300" cy="151" r="60"/><circle cx="300" cy="151" r="36"/>
  <path d="M174 151h252M300 66v176M184 96h16M192 88v16M400 214h16M408 206v16"/>
 </g>
 <g fill="none" stroke="#687f67"><path d="M175 80V68h12M413 68h12v12M175 226v12h12M413 238h12v-12"/></g>
 ${text('ТАКТИЧЕСКАЯ КАРТА',300,70,6,'#baaa70','middle')}
 ${text('AI &',300,94,24,'url(#title-gold)','middle',true)}
 ${text('CONQUER',300,126,32,'url(#title-gold)','middle',true)}
 ${screen(213,174,174,24)}
 ${text('ASI ALERT',300,178,16,'url(#title-red)','middle',true)}
 <path d="M185 188h19M396 188h19" stroke="#d83124" stroke-width="2"/>
 ${text('ИИШНИКИ / ПРОЕКТЫ / МЕДИА',300,211,8,'#e4f1e6','middle')}
 ${instruments(178,229,244,1)}

 <!-- Extra card-style meters, waveform, radar and matrix lights. -->
 ${panel(18,257,142,19)}
 ${screen(24,263,68,9)}
 ${spectrum(28,270,20,6,1)}
 ${text('100%',104,263,8,'#ffdf79')}
 ${panel(167,257,266,19)}
 <path d="M174 266h248" stroke="#2d4539"/>
 ${Array.from({length:49},(_,i)=>`<path d="M${178+i*5} 264v${i%5===0?8:4}" stroke="${i<36?'#abb58c':'#435a48'}"/>`).join('')}
 <rect x="354" y="262" width="3" height="11" fill="#e0bd63"/>
 ${panel(440,257,142,19)}
 ${matrix(448,263,7)}
 <path d="M474 267h6l2-4 2 8 3-7 2 5 3-3h8l2-3 2 7 3-5 3 2h8" fill="none" stroke="#a8b69c"/>
 <g fill="none" stroke="#91a687"><circle cx="548" cy="267" r="6"/><path d="M541 267h14M548 260v14M548 267l4-4"/></g>
 <rect x="565" y="265" width="4" height="4" fill="#f0442b"/>

 ${panel(18,283,564,21)}
 <rect x="25" y="291" width="4" height="4" fill="#ef3c28"/>
 ${text('ONLINE',34,290,8,'#aabf98')}
 <path d="M92 288v12M508 288v12" stroke="#52675b"/>
 ${text('ОПЕРАЦИЯ: ВООБРАЖЕНИЕ',300,289,8,'#ffdf79','middle')}
 ${text('МИР/РУНЕТ',574,291,6,'#aabf98','end')}
</svg>`);

await sharp(svg).png().toBuffer().then(buffer => sharp(buffer)
  .resize(1200,630,{kernel:'nearest'})
  .flatten({background:'#080305'})
  .jpeg({quality:96,mozjpeg:true,chromaSubsampling:'4:4:4'})
  .toFile('public/social-preview-v4.jpg'));
console.log('Saved public/social-preview-v4.jpg (1200 × 630, pixel scale ×2)');
