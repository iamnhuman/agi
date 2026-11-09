import sharp from 'sharp';

const imageData = async (path, width) => {
  const buffer = await sharp(path).resize({width}).png().toBuffer();
  return `data:image/png;base64,${buffer.toString('base64')}`;
};
const [steel, map, landmarks, logo] = await Promise.all([
  imageData('public/textures/console-cast-steel.webp',240),
  imageData('public/radar-world-red.webp',1120),
  imageData('public/radar-landmarks.webp',1120),
  imageData('public/ai-conquer-ra2.webp',928),
]);
const screen = 'M236 60H964C1075 60 1136 105 1136 196V423C1136 515 1075 568 964 568H236C125 568 64 515 64 423V196C64 105 125 60 236 60Z';
const ticks = Array.from({length:72},(_,index) =>
  `<path d="M600 -27v${index%6===0?14:6}" transform="rotate(${index*5} 600 314)"/>`).join('');

const preview = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
 <defs>
  <linearGradient id="steel" x2=".24" y2="1">
   <stop stop-color="#c2beb3"/><stop offset=".25" stop-color="#82827f"/><stop offset=".8" stop-color="#3e3c3f"/><stop offset="1" stop-color="#77706b"/>
  </linearGradient>
  <linearGradient id="bevel" x2=".1" y2="1">
   <stop stop-color="#e8e0d3"/><stop offset=".25" stop-color="#a39d95"/><stop offset="1" stop-color="#2e2224"/>
  </linearGradient>
  <linearGradient id="rubber" x2="0" y2="1">
   <stop stop-color="#0c0b0d"/><stop offset=".24" stop-color="#272428"/><stop offset=".79" stop-color="#151216"/><stop offset="1" stop-color="#494145"/>
  </linearGradient>
  <radialGradient id="signal">
   <stop stop-color="#fff"/><stop offset=".52" stop-color="#fff" stop-opacity=".8"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="glass">
   <stop offset=".46" stop-color="#150103" stop-opacity="0"/><stop offset="1" stop-color="#090204" stop-opacity=".68"/>
  </radialGradient>
  <linearGradient id="beam" x1="0" y1="1" x2="1" y2="0">
   <stop stop-color="#c72a14" stop-opacity="0"/><stop offset=".84" stop-color="#ee5224" stop-opacity=".24"/><stop offset="1" stop-color="#ffa472" stop-opacity=".35"/>
  </linearGradient>
  <pattern id="grain" width="240" height="240" patternUnits="userSpaceOnUse">
   <image href="${steel}" width="240" height="240"/>
  </pattern>
  <pattern id="raster" width="1" height="4" patternUnits="userSpaceOnUse">
   <path d="M0 3h1" stroke="#100304" stroke-opacity=".28"/>
  </pattern>
  <clipPath id="crt"><path d="${screen}"/></clipPath>
  <mask id="landmark-signal" maskUnits="userSpaceOnUse" x="0" y="0" width="1200" height="630">
   <ellipse cx="985" cy="153" rx="302" ry="206" fill="url(#signal)"/>
   <ellipse cx="222" cy="492" rx="275" ry="165" fill="url(#signal)" opacity=".75"/>
  </mask>
  <g id="screw">
   <circle r="7" fill="#1b1617" stroke="#b3a79a"/>
   <circle r="4.6" fill="url(#bevel)"/>
   <path d="m-3 2 6-4" stroke="#252021" stroke-width="1.6"/>
  </g>
 </defs>
 <rect width="1200" height="630" fill="#120d0e"/>
 <rect x="12" y="12" width="1176" height="606" rx="24" fill="url(#steel)" stroke="url(#bevel)" stroke-width="6"/>
 <rect x="16" y="16" width="1168" height="598" rx="20" fill="url(#grain)" opacity=".28"/>
 <path d="${screen}" fill="#130205" stroke="#23191b" stroke-width="48"/>
 <path d="${screen}" fill="#130205" stroke="url(#rubber)" stroke-width="36"/>
 <path d="${screen}" fill="none" stroke="url(#grain)" stroke-width="33" opacity=".10"/>
 <g clip-path="url(#crt)">
  <image href="${map}" x="64" y="60" width="1072" height="508" preserveAspectRatio="xMidYMid slice" opacity=".71"/>
  <rect x="64" y="60" width="1072" height="508" fill="#250406" opacity=".26"/>
  <image href="${landmarks}" x="64" y="60" width="1072" height="508" preserveAspectRatio="none" mask="url(#landmark-signal)"/>
  <path d="M600 314 795 28H1195V243Z" fill="url(#beam)"/>
  <path d="M600 314 1195 243" stroke="#ffac78" stroke-width="2" opacity=".42"/>
  <g fill="none" stroke="#e65a36" opacity=".54">
   <path d="M64 314h1072M600 60v508"/>
   ${[122,222,340,415].map(radius=>`<circle cx="600" cy="314" r="${radius}"/>`).join('')}
   ${ticks}
  </g>
  <rect x="64" y="60" width="1072" height="508" fill="url(#glass)"/>
  <image href="${logo}" x="136" y="111" width="928" height="396"/>
  <rect x="64" y="60" width="1072" height="508" fill="url(#raster)"/>
 </g>
 <path d="${screen}" fill="none" stroke="#070405" stroke-width="3"/>
 <use href="#screw" x="39" y="38"/><use href="#screw" x="1161" y="38"/>
 <use href="#screw" x="39" y="592"/><use href="#screw" x="1161" y="592"/>
 <path d="M204 604h350m92 0h350" fill="none" stroke="#201718" stroke-width="5" stroke-dasharray="7 3"/>
 <circle cx="600" cy="604" r="4.5" fill="#44150c"/><circle cx="600" cy="604" r="2.6" fill="#ff9c4a"/>
</svg>`);

await sharp(preview).jpeg({quality:91,mozjpeg:true,chromaSubsampling:'4:4:4'})
  .toFile('public/social-preview-v5.jpg');
