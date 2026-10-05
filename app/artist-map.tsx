'use client';
import {useState,useRef,useEffect,useMemo} from 'react';
import {Plus,Minus,RotateCcw,Pencil} from 'lucide-react';
import {adminUrl,showLocalAdmin} from '@/client/config';
import type {Artist,Section} from '@/lib/types';

const kindLabels={artist:'Артисты',media:'Медиа',collective:'Проекты'} as const;
type EntryKind=keyof typeof kindLabels;
const entryKind=(artist:Artist):EntryKind=>artist.kind==='media'||artist.kind==='collective'?artist.kind:'artist';
const ratingColor=(rating?:Artist['rating'])=>rating==='AA'?'#cc9aff':rating==='AAA'?'#ffe067':rating==='AAA+'?'#94ed93':'#ff6670';

type MapBounds={left:number;right:number;top:number;bottom:number};
const overlaps=(a:MapBounds,b:MapBounds)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
function mapLayout(artists:Artist[],sections:Section[]){
 const kinds=(['artist','media','collective'] as EntryKind[]).filter(kind=>artists.some(artist=>entryKind(artist)===kind));
 const activeSections=sections.filter(section=>artists.some(artist=>artist.section===section.id));
 const clusters=kinds.flatMap((kind,kindIndex)=>activeSections.map((section,sectionIndex)=>{
  const members=artists.filter(artist=>entryKind(artist)===kind&&artist.section===section.id);
  const occupied:MapBounds[]=[{left:-110,right:110,top:-70,bottom:90}];
  const nodes=members.map((artist,index)=>{
   // Reserve the full name at its hover font size, dot and edit control.
   const labelWidth=Array.from(artist.name).length*11+4;
   for(let attempt=0;;attempt++){
    const angle=index*2.39996+(attempt%12)*(attempt%2?-.15:.15);
    const radius=120+Math.sqrt(index)*34+Math.floor(attempt/12)*24;
    const x=Math.cos(angle)*radius,y=Math.sin(angle)*radius;
    const labelAnchor:'start'|'end'=x<0?'end':'start';
    const labelX=x+(labelAnchor==='start'?17:-17);
    const bounds:MapBounds[]=[
     {left:(labelAnchor==='end'?labelX-labelWidth:labelX)-4,right:(labelAnchor==='start'?labelX+labelWidth:labelX)+4,top:y-15,bottom:y+13},
     {left:x-14,right:x+14,top:y-14,bottom:y+14},
     ...(showLocalAdmin?[{left:x-14,right:x+14,top:y-41,bottom:y-13}]:[]),
    ];
    if(bounds.some(box=>occupied.some(other=>overlaps(box,other))))continue;
    occupied.push(...bounds);
    return {artist,x,y,labelX,labelY:y+4,labelAnchor};
   }
  });
  const bounds={left:Math.min(...occupied.map(box=>box.left)),right:Math.max(...occupied.map(box=>box.right)),
   top:Math.min(...occupied.map(box=>box.top)),bottom:Math.max(...occupied.map(box=>box.bottom))};
  return {kind,section,kindIndex,sectionIndex,members,nodes,bounds};
 })).filter(group=>group.members.length);
 const columnWidths=kinds.map((_,index)=>Math.max(580,...clusters.filter(group=>group.kindIndex===index).map(group=>group.bounds.right-group.bounds.left+96)));
 const columns=columnWidths.map((_,index)=>columnWidths.slice(0,index).reduce((sum,value)=>sum+value,0));
 // Stack sections within each kind so small clusters do not inherit the artists' height.
 const columnTops=kinds.map(()=>130);
 const groups=clusters.map(group=>{
  const top=columnTops[group.kindIndex];
  columnTops[group.kindIndex]+=group.bounds.bottom-group.bounds.top+112;
  return {...group,cx:columns[group.kindIndex]+48-group.bounds.left,cy:top-group.bounds.top};
 });
 const nodes=groups.flatMap(group=>group.nodes.map(node=>({...node,x:node.x+group.cx,y:node.y+group.cy,
  labelX:node.labelX+group.cx,labelY:node.labelY+group.cy,cx:group.cx,cy:group.cy})));
 return {kinds,columns,groups,nodes,width:Math.max(760,columnWidths.reduce((sum,value)=>sum+value,0)),height:Math.max(760,...groups.map(group=>group.cy+group.bounds.bottom+80))};
}

export default function ArtistMap({artists,sections}:{artists:Artist[];sections:Section[]}){
 const [zoom,setZoom]=useState(1),[pan,setPan]=useState({x:0,y:0});
 const drag=useRef<{x:number;y:number;px:number;py:number}|null>(null),moved=useRef(false);
 const viewport=useRef<HTMLDivElement>(null),svg=useRef<SVGSVGElement>(null),view=useRef({zoom,pan});
 view.current={zoom,pan};
 const {kinds,columns,groups,nodes,width,height}=useMemo(()=>mapLayout(artists,sections),[artists,sections]);
 const centerX=width/2,centerY=height/2;
 useEffect(()=>{
  const surface=viewport.current,canvas=svg.current;if(!surface||!canvas)return;
  const onWheel=(event:WheelEvent)=>{
   event.preventDefault();
   const rect=canvas.getBoundingClientRect(),box=canvas.viewBox.baseVal;
   const fit=Math.min(rect.width/box.width,rect.height/box.height),drawnWidth=box.width*fit,drawnHeight=box.height*fit;
   const offsetX=(rect.width-drawnWidth)/2,offsetY=(rect.height-drawnHeight)/2;
   const pointX=Math.max(0,Math.min(width,(event.clientX-rect.left-offsetX)/fit));
   const pointY=Math.max(0,Math.min(height,(event.clientY-rect.top-offsetY)/fit));
   const wheelDelta=Math.abs(event.deltaY)>=Math.abs(event.deltaX)?event.deltaY:event.deltaX;
   const delta=wheelDelta*(event.deltaMode===1?16:event.deltaMode===2?rect.height:1),current=view.current;
   const nextZoom=Math.max(.5,Math.min(3,current.zoom*Math.exp(-delta*.0012))),ratio=nextZoom/current.zoom;
   setZoom(nextZoom);
   setPan({x:pointX-centerX-ratio*(pointX-centerX-current.pan.x),y:pointY-centerY-ratio*(pointY-centerY-current.pan.y)});
  };
  surface.addEventListener('wheel',onWheel,{passive:false});
  return()=>surface.removeEventListener('wheel',onWheel);
 },[width,height,centerX,centerY]);
 return <div ref={viewport} className="map-wrap"><div className="map-note"><span><i/> МИР</span><span><i/> РУНЕТ И ДРУГИЕ</span><span><i/> РЕЙТИНГ</span><p>Колесо мыши — масштаб · перетаскивайте карту</p></div><svg ref={svg} role="group" aria-label="Карта артистов, медиа и проектов по разделам" viewBox={`0 0 ${width} ${height}`} onPointerDown={event=>{if((event.target as Element).closest('[data-node]'))return;moved.current=false;drag.current={x:event.clientX,y:event.clientY,px:pan.x,py:pan.y};event.currentTarget.setPointerCapture(event.pointerId);}} onPointerMove={event=>{if(!drag.current)return;const rect=event.currentTarget.getBoundingClientRect(),scaleX=width/rect.width,scaleY=height/rect.height;moved.current=true;setPan({x:drag.current.px+(event.clientX-drag.current.x)*scaleX,y:drag.current.py+(event.clientY-drag.current.y)*scaleY});}} onPointerUp={()=>drag.current=null} onPointerCancel={()=>drag.current=null} style={{touchAction:'none'}}><defs><pattern id="dots" width="25" height="25" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#37402e"/></pattern></defs><rect width={width} height={height} fill="url(#dots)"/><g transform={`translate(${centerX+pan.x} ${centerY+pan.y}) scale(${zoom}) translate(${-centerX} ${-centerY})`}>
 {kinds.map((kind,index)=><g className="map-kind" key={kind}><text x={columns[index]+28} y="104">{kindLabels[kind]}</text>{index>0&&<line x1={columns[index]} y1="75" x2={columns[index]} y2={height-25}/>}</g>)}
 {nodes.map(({artist,x,y,cx,cy})=><line key={'line'+artist.id} x1={cx} y1={cy} x2={x} y2={y} stroke={artist.section==='world'?'#8dba5533':'#a18abe33'}/>)}
 {groups.map(group=><g key={`${group.kind}-${group.section.id}`}><circle cx={group.cx} cy={group.cy} r="31" fill="#17200f" stroke="#93b866"/><text x={group.cx} y={group.cy+5} textAnchor="middle" fill="#d5e8bc" fontSize="14">{group.section.name.slice(0,18)}</text><text className="map-group-count" x={group.cx} y={group.cy+54} textAnchor="middle">{group.members.length} {group.kind==='artist'?'АРТИСТОВ':group.kind==='media'?'МЕДИА':'ПРОЕКТОВ'}</text></g>)}
 {nodes.map(({artist,x,y,labelX,labelY,labelAnchor},index)=><g className="map-entry" key={artist.id}><a data-node="true" className="map-node" href={artist.url} target="_blank" rel="noopener noreferrer" aria-label={`Открыть источник: ${artist.name}`}><circle cx={x} cy={y} r="16" fill="transparent"/><circle cx={x} cy={y} r={index%7===0?10:7} fill="none" stroke={ratingColor(artist.rating)} strokeWidth="1.5"/><circle cx={x} cy={y} r={index%7===0?6:3.5} fill={ratingColor(artist.rating)}/><text x={labelX} y={labelY} textAnchor={labelAnchor} fill={ratingColor(artist.rating)} stroke="#101510" strokeWidth="3" strokeLinejoin="round" paintOrder="stroke" fontSize="10">{artist.name}</text></a>{showLocalAdmin&&<a data-node="true" className="map-entry-edit" href={`${adminUrl}/?edit=${encodeURIComponent(artist.id)}#catalog`} aria-label={`Редактировать ${artist.name}`}><rect x={x-12} y={y-39} width="24" height="24" rx="3"/><Pencil x={x-6} y={y-33} width={12} height={12} aria-hidden="true"/></a>}</g>)}
 </g></svg><div className="map-controls"><button aria-label="Приблизить" onClick={()=>setZoom(value=>Math.min(3,value+.25))}><Plus size={18}/></button><span>{Math.round(zoom*100)}%</span><button aria-label="Отдалить" onClick={()=>setZoom(value=>Math.max(.5,value-.25))}><Minus size={18}/></button><button aria-label="Сбросить карту" onClick={()=>{setZoom(1);setPan({x:0,y:0});}}><RotateCcw size={16}/></button></div><p className="map-caption">Тактическая карта ИИ-сцены: артисты, медиа и проекты по секторам</p></div>;
}
