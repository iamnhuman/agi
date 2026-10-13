import sharp from 'sharp';
import {readFile} from 'node:fs/promises';

// Render the original composition with the site's exact wordmark and emblems.
// Keeping the interface in SVG avoids generated lettering and texture artifacts.
const logoSource = await readFile('client/ai-conquer-logo.tsx','utf8');
const logo = logoSource.slice(logoSource.indexOf('<svg'),logoSource.lastIndexOf('</svg>') + 6)
  .replace('className="ai-conquer-logo"','x="285" y="205" width="630" height="173"')
  .replace(/\b(stopColor|textAnchor|fontFamily|fontWeight|fontStyle|paintOrder|fontSize|letterSpacing|wordSpacing|strokeWidth)\b/g,
    name => name.replace(/[A-Z]/g,letter => '-' + letter.toLowerCase()))
  .replace(/&(?!amp;)/g,'&amp;');
const asset = async path => `data:image/png;base64,${(await readFile(path)).toString('base64')}`;
const [eagle,emblem] = await Promise.all([
  asset('public/badges/region-en-eagle-cutout.png'),
  asset('public/badges/region-ru-emblem-cutout.png'),
]);

const panel = (x,y,w,h) => `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#panel)" stroke="#111819" stroke-width="6"/>
  <path d="M${x} ${y+h}V${y}h${w}" fill="none" stroke="#9aa897" stroke-width="3"/>
  <path d="M${x+w} ${y}v${h}H${x}" fill="none" stroke="#34443f" stroke-width="3"/>
  <rect x="${x+5}" y="${y+5}" width="${w-10}" height="${h-10}" fill="none" stroke="#05090a" stroke-width="2"/>
`;
const screw = (x,y) => `<g transform="translate(${x} ${y})"><circle r="5" fill="#0a1011" stroke="#607168"/><path d="M-2.5 2.5l5-5" stroke="#9aaba0"/></g>`;
const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
 <defs>
  <radialGradient id="vignette"><stop offset=".2" stop-color="#060204" stop-opacity=".1"/><stop offset="1" stop-color="#060204" stop-opacity=".9"/></radialGradient>
  <linearGradient id="panel" x2="0" y2="1"><stop stop-color="#202c2c" stop-opacity=".97"/><stop offset=".13" stop-color="#0d1719" stop-opacity=".94"/><stop offset="1" stop-color="#060d10" stop-opacity=".96"/></linearGradient>
  <linearGradient id="steel" x2="0" y2="1"><stop stop-color="#65776c"/><stop offset=".13" stop-color="#35443f"/><stop offset=".53" stop-color="#1c2b29"/><stop offset="1" stop-color="#0b1618"/></linearGradient>
  <linearGradient id="gold" x2="0" y2="1"><stop stop-color="#fff1b4"/><stop offset="1" stop-color="#dba84a"/></linearGradient>
  <linearGradient id="red" x2="0" y2="1"><stop stop-color="#e42d20"/><stop offset=".16" stop-color="#9e160d"/><stop offset="1" stop-color="#3e0706"/></linearGradient>
  <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 0h4" stroke="#000" stroke-opacity=".13"/></pattern>
  <pattern id="caution" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="14" height="14" fill="#520807"/><rect width="7" height="14" fill="#cc2118"/></pattern>
  <filter id="shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dy="3" stdDeviation="4" flood-color="#000" flood-opacity=".95"/></filter>
 </defs>

 <rect width="1200" height="630" fill="url(#vignette)"/>
 <rect x="22" y="22" width="1156" height="586" fill="url(#scan)"/>

 <!-- Angular, bevelled command-console housing. -->
 <path d="M29 12H1171L1188 29V601L1171 618H29L12 601V29Z M31 31V599H1169V31Z" fill="url(#steel)" fill-rule="evenodd" stroke="#080d0e" stroke-width="3"/>
 <path d="M15 598V30L30 15H1170" fill="none" stroke="#a5afa0" stroke-width="3"/>
 <path d="M1184 32V600L1170 614H30" fill="none" stroke="#46584e" stroke-width="3"/>
 <rect x="30" y="30" width="1140" height="570" fill="none" stroke="#020506" stroke-width="4"/>
 <path d="M39 34H1162M39 596H1162" stroke="#cd241b" stroke-width="2"/>
 <rect x="1172" y="54" width="8" height="522" fill="url(#caution)"/>
 ${screw(23,23)}${screw(1177,23)}${screw(23,607)}${screw(1177,607)}

 <!-- The first preview's title, now mounted in a recessed console. -->
 ${panel(341,49,518,111)}
 <path d="M350 56H850" stroke="#de3022" stroke-width="3"/>
 <path d="M350 60H850" stroke="#320908"/>
 <g text-anchor="middle" font-family="'IBM Plex Mono', monospace" fill="#e6c57f" letter-spacing="3">
  <text x="600" y="83" font-size="14">AI CULTURE // ARCHIVE SYSTEM</text>
  <text x="600" y="145" font-family="Impact, 'Arial Black', sans-serif" font-size="61" letter-spacing="5" fill="url(#gold)" filter="url(#shadow)">ИИЗМ</text>
 </g>
 <g fill="none" stroke="#54655b" stroke-width="2">
  <path d="M52 94H313l12 12M887 94h261l-12 12"/>
  <path d="M52 113H297M903 113h245" stroke="#273530"/>
 </g>
 <g fill="#d52a20"><rect x="55" y="83" width="26" height="4"/><rect x="86" y="83" width="26" height="4"/><rect x="1119" y="83" width="26" height="4"/></g>

 <!-- Faction emblems retain the original clean artwork and placement. -->
 ${panel(49,181,290,237)}
 ${panel(861,181,290,237)}
 <rect x="56" y="188" width="276" height="3" fill="#5c9ca2"/>
 <rect x="868" y="188" width="276" height="3" fill="#db2e20"/>
 <g fill="none" stroke="#8a9b85" stroke-width="1.5" opacity=".7">
  <path d="M63 217v-15h15M310 202h15v15M63 385v18h15M310 403h15v-18"/>
  <path d="M875 217v-15h15M1122 202h15v15M875 385v18h15M1122 403h15v-18"/>
 </g>
 <image href="${eagle}" x="57" y="223" width="274" height="169"/>
 <image href="${emblem}" x="913" y="194" width="230" height="213"/>

 <!-- Keep the original centre radar and exact game-inspired wordmark. -->
 <g fill="none" stroke="#b3251c" opacity=".5">
  <path d="M371 202v-18h38M791 184h38v18M371 392v18h38M791 410h38v-18" stroke-width="2"/>
  <path d="M358 297h24M818 297h24M600 173v16M600 404v17"/>
 </g>
 ${logo}

 ${panel(302,436,596,88)}
 <g text-anchor="middle" filter="url(#shadow)">
  <text x="600" y="473" font-family="Impact, 'Arial Black', sans-serif" font-size="35" font-style="italic" letter-spacing="1.5" fill="#ffdc89">ОПЕРАЦИЯ: ВООБРАЖЕНИЕ</text>
  <text x="600" y="505" font-family="'IBM Plex Mono', monospace" font-size="19" letter-spacing="3" fill="#e4bb97">ИИШНИКИ · ПРОЕКТЫ · МЕДИА</text>
 </g>

 <!-- Slim bottom status rail, echoing the site's card instruments. -->
 ${panel(49,548,1102,38)}
 <path d="M326 553v28M874 553v28" stroke="#4e6156"/>
 <g font-family="'IBM Plex Mono', monospace" font-size="13" letter-spacing="1.5" fill="#d8c08a">
  <circle cx="69" cy="567" r="4" fill="#f33b29"/>
  <text x="83" y="572">СИСТЕМА В СЕТИ</text>
  <text x="1129" y="572" text-anchor="end">МИР / РУНЕТ</text>
 </g>
 <g stroke="#647967" stroke-width="2" opacity=".75">
  ${Array.from({length:48},(_,i) => `<path d="M${354+i*10} 575v-${[5,9,13,7,17,11,6,15][i%8]}"/>`).join('')}
 </g>
 <rect x="354" y="578" width="480" height="1" fill="#273a30"/>
</svg>`);

await sharp('public/radar-world-red.webp').resize(1200,630,{fit:'cover'})
  .composite([{input:svg}])
  .flatten({background:'#080305'})
  .jpeg({quality:94,mozjpeg:true,chromaSubsampling:'4:4:4'})
  .toFile('public/social-preview-v3.jpg');
console.log('Saved public/social-preview-v3.jpg (1200 × 630)');
