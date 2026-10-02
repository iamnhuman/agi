// Fictional terminal output for the Toyota transmission. Every operation is a
// local visual simulation; these strings are never executed as shell commands.
type SignalFrame={node:string;route:string;port:number;sector:string;shard:string;session:string;nonce:string;hash:string;latency:string;bytes:number;packets:number;cipher:string;asn:number;ttl:number;window:number;rule:number;channel:string;stamp:string};
type SignalBlock=(frame:SignalFrame)=>string[];

const nodes=['ghost-13','proxy-07','icebox-02','root-node','relay-09','null-44','mirror-18','vault-06'];
const routes=['edge/a3','relay/e7','mirror/b2','null/f4','vault/c1','transit/09'];
const channels=['blackbox','phantom','icewire','ghostline','darkfiber','mirrorlink'];
const ciphers=['TLS_AES_256_GCM_SHA384','TLS_CHACHA20_POLY1305','AES-256-GCM','X25519+KYBER768'];
const pick=<T,>(items:readonly T[])=>items[Math.floor(Math.random()*items.length)];
const hex=(length:number)=>Array.from({length},()=>Math.floor(Math.random()*16).toString(16)).join('');
const number=(min:number,max:number)=>min+Math.floor(Math.random()*(max-min+1));
let previousBlock=-1;
let sessionNumber=0;

function frame():SignalFrame{
 return {
  node:pick(nodes),route:pick(routes),port:pick([22,80,443,445,8080,8443,9200]),
  sector:String(number(1,12)).padStart(2,'0'),shard:String(number(1,9)).padStart(2,'0'),
  session:(++sessionNumber).toString(16).padStart(4,'0'),nonce:hex(12),hash:hex(16),
  latency:(number(18,248)/10).toFixed(1),bytes:number(1400,96000),
  packets:number(18,4096),cipher:pick(ciphers),asn:number(10000,65000),
  ttl:number(38,128),window:number(2048,65535),rule:number(10,99),
  channel:pick(channels),stamp:new Date().toISOString().slice(11,19),
 };
}

const blocks:SignalBlock[]=[
 f=>[
  `$ ghostctl recon ${f.node} --profile=silent`,
  `> SYN ${f.node}:${f.port} ttl=${f.ttl} win=${f.window}`,
  `> banner parsed / service mask: ${f.channel}`,
  `> route ${f.route} locked (${f.latency}ms)`,
 ],
 f=>[
  `$ ghostctl trace ${f.route} --hops=7`,
  `> hop 03 -> edge-${f.sector} / ASN ${f.asn}`,
  `> hop 04 -> ${f.node} / jitter ${f.latency}ms`,
  `> path verified; local sandbox only`,
 ],
 f=>[
  `$ ghostctl tls inspect ${f.node}:${f.port}`,
  `> client_hello / sni=${f.node}.invalid`,
  `> key exchange ${f.cipher}`,
  `> certificate pin ${f.hash.slice(0,12)}… matched`,
 ],
 f=>[
  `$ ghostctl waf map --sector=${f.sector}`,
  `> rule ${f.rule} / challenge: fingerprint`,
  `> ${f.packets} requests shadowed in relay`,
  `> policy unchanged // dry-run`,
 ],
 f=>[
  `$ ghostctl tunnel open --via=${f.route}`,
  `> nonce=${f.nonce} / cipher=${f.cipher}`,
  `> channel ${f.channel} sealed at ${f.stamp}Z`,
  `> remote write disabled [SIM]`,
 ],
 f=>[
  `$ ghostctl audit /session/${f.session}`,
  `> ring buffer recovered: ${f.bytes} bytes`,
  `> integrity sha256:${f.hash.slice(0,12)}…`,
  `> audit replay accepted / no host changes`,
 ],
 f=>[
  `$ ghostctl probe --tcp=${f.port} ${f.node}`,
  `> SYN_ACK window=${f.window} ttl=${f.ttl}`,
  `> service fingerprint ${f.hash.slice(0,8)}`,
  `> decoy endpoint confirmed [SIM]`,
 ],
 f=>[
  `$ ghostctl packet capture --shard=${f.shard}`,
  `> ${f.packets} frames / ${f.bytes} bytes buffered`,
  `> stream ${f.channel} entropy=7.${f.rule}`,
  `> pcap sealed in volatile memory`,
 ],
 f=>[
  `$ ghostctl jwt inspect --node=${f.node}`,
  `> header.alg=HS256 / kid=${f.hash.slice(0,6)}`,
  `> claim.exp drift +${f.rule}s / nonce=${f.nonce.slice(0,6)}`,
  `> signature rejected / decoy token`,
 ],
 f=>[
  `$ ghostctl dns query ${f.node}.invalid`,
  `> resolver relay-${f.sector} replied NXDOMAIN`,
  `> negative cache ttl=${f.ttl}s`,
  `> synthetic zone ${f.route} retained`,
 ],
 f=>[
  `$ ghostctl memory scan --region=0x${f.hash.slice(0,6)}`,
  `> ${f.bytes} bytes sampled / entropy 7.${f.rule}`,
  `> signature ${f.hash.slice(6,14)} pending`,
  `> buffer cleared from local simulation`,
 ],
 f=>[
  `$ ghostctl auth replay --session=${f.session}`,
  `> challenge nonce ${f.nonce}`,
  `> ${f.packets} candidate frames discarded`,
  `> replay window closed / access denied`,
 ],
 f=>[
  `$ ghostctl route pivot ${f.node} --dry-run`,
  `> uplink ${f.route} / egress=DENY`,
  `> shadow path opened for ${f.latency}ms`,
  `> pivot graph rendered; no packets sent`,
 ],
 f=>[
  `$ ghostctl edge census --zone=${f.sector}`,
  `> virtual hosts found: ${number(3,19)}`,
  `> ${f.node} tcp/${f.port} / jitter=${f.latency}ms`,
  `> census signed ${f.hash.slice(0,10)}`,
 ],
 f=>[
  `$ ghostctl keyring verify ${f.channel}`, 
  `> ephemeral key id ${f.hash.slice(0,8)}`,
  `> cipher suite ${f.cipher}`,
  `> zero secrets exposed / simulation`,
 ],
 f=>[
  `$ ghostctl anomaly hunt ${f.node}`, 
  `> baseline deviation +${f.rule}% at ${f.stamp}Z`,
  `> signal ${f.hash.slice(0,12)} correlated`,
  `> false positive isolated in shard ${f.shard}`,
 ],
 f=>[
  `$ ghostctl header diff --edge=${f.sector}`, 
  `> x-cache=MISS / via=${f.route}`,
  `> server clock drift ${f.latency}ms`,
  `> response checksum ${f.hash.slice(0,8)}`, 
 ],
 f=>[
  `$ ghostctl websocket tap ${f.node}:${f.port}`, 
  `> upgrade=101 / protocol=ghost.v2`,
  `> ${f.packets} synthetic frames observed`,
  `> socket closed / trace persisted locally`,
 ],
 f=>[
  `$ ghostctl origin mask --session=${f.session}`,
  `> overlay ${f.route} / hop-key=${f.nonce.slice(0,8)}`,
  `> upstream identity redacted [SIM]`,
  `> no external tunnel established`,
 ],
 f=>[
  `$ ghostctl access matrix ${f.node}`, 
  `> role=observer / scope=read-only`,
  `> acl rule ${f.rule}: sandbox boundary intact`,
  `> escalation path simulated; denied`,
 ],
 f=>[
  `$ ghostctl integrity scan --shard=${f.shard}`, 
  `> merkle root ${f.hash}`,
  `> ${f.packets} leaf nodes compared`,
  `> drift=0 / archive verified`,
 ],
 f=>[
  `$ ghostctl telemetry pulse --id=${f.session}`, 
  `> signal ${f.channel}/${f.sector} ${f.latency}ms`,
  `> io=${f.bytes}B / frames=${f.packets}`,
  `> watchdog acknowledged at ${f.stamp}Z`,
 ],
 f=>[
  `$ ghostctl sandbox breach --vector=SIM`,
  `> stack frame 0x${f.hash.slice(0,8)} mapped`,
  `> payload checksum ${f.hash.slice(8,16)}`,
  `> exploit denied by sandbox policy`,
 ],
 f=>[
  `$ ghostctl session rotate --node=${f.node}`, 
  `> prior token ${f.hash.slice(0,8)} expired`,
  `> new nonce ${f.nonce} / ttl=${f.ttl}s`,
  `> rotation complete / traces local`,
 ],
];

export function createSignalScript(clientIp?:string,telemetry?:string):string[]{
 const f=frame();
 let index=number(0,blocks.length-1);
 if(index===previousBlock)index=(index+1+number(0,blocks.length-2))%blocks.length;
 previousBlock=index;
 const prefix=clientIp&&sessionNumber%5===0?[`> CLIENT_IP=${clientIp} / SESSION=${f.session}`]:
  sessionNumber%3===0?[`> session ${f.session} / node=${f.node}`]:[];
 return [...prefix,...blocks[index](f),...(telemetry?[telemetry]:[])];
}
