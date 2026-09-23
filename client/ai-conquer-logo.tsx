export default function AiConquerLogo(){
 return <svg className="ai-conquer-logo" viewBox="0 0 600 190" role="img" aria-label="AI & CONQUER — ASI ALERT" xmlns="http://www.w3.org/2000/svg">
  <defs>
   <linearGradient id="ai-gold" x2="0" y2="1"><stop stopColor="#fffbd0"/><stop offset=".28" stopColor="#f7d64a"/><stop offset=".55" stopColor="#a96a08"/><stop offset=".76" stopColor="#fff17a"/><stop offset="1" stopColor="#97600b"/></linearGradient>
   <linearGradient id="ai-steel" x2="0" y2="1"><stop stopColor="#fff"/><stop offset=".2" stopColor="#9fa8b4"/><stop offset=".42" stopColor="#f6f7fa"/><stop offset=".62" stopColor="#58606b"/><stop offset=".82" stopColor="#e2e5e9"/><stop offset="1" stopColor="#737a83"/></linearGradient>
   <linearGradient id="ai-red" x2="0" y2="1"><stop stopColor="#ff6b55"/><stop offset=".28" stopColor="#eb2826"/><stop offset=".72" stopColor="#b80914"/><stop offset="1" stopColor="#73060d"/></linearGradient>
   <filter id="ai-shadow" x="-20%" y="-20%" width="140%" height="160%"><feGaussianBlur in="SourceAlpha" stdDeviation="3"/><feOffset dy="3"/><feComponentTransfer><feFuncA type="linear" slope=".8"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <g filter="url(#ai-shadow)" textAnchor="middle" fontFamily="Impact, 'Arial Black', sans-serif" fontWeight="900" fontStyle="italic" paintOrder="stroke fill">
   <text x="300" y="46" fontSize="39" letterSpacing="3" fill="#271b05" stroke="#130e05" strokeWidth="8">AI &amp; CONQUER</text>
   <text x="300" y="43" fontSize="39" letterSpacing="3" fill="url(#ai-gold)" stroke="#f9e69a" strokeWidth="1.5">AI &amp; CONQUER</text>
   <path d="M18 72 239 78 264 93 236 108 22 99 4 87Zm564 0L361 78 336 93 364 108 578 99 596 87Z" fill="url(#ai-steel)" stroke="#171a20" strokeWidth="7"/>
   <path d="m27 81 211 8m-205 3 195 8m337-19-211 8m205 3-195 8" fill="none" stroke="#fff" strokeOpacity=".78" strokeWidth="2"/>
   <path d="M265 101h70l-35 75z" fill="url(#ai-steel)" stroke="#171a20" strokeWidth="7"/>
   <text x="300" y="143" fontSize="75" letterSpacing="-1" fill="#1a0a0d" stroke="#111318" strokeWidth="15">ASI ALERT</text>
   <text x="300" y="139" fontSize="75" letterSpacing="-1" fill="url(#ai-red)" stroke="url(#ai-steel)" strokeWidth="8">ASI ALERT</text>
   <text x="300" y="139" fontSize="75" letterSpacing="-1" fill="url(#ai-red)" stroke="#78080d" strokeWidth="2">ASI ALERT</text>
  </g>
 </svg>;
}
