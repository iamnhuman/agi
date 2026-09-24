'use client';
import {useState,useRef,useEffect} from 'react';
import {Plus,Minus,RotateCcw} from 'lucide-react';
import type {Artist,Section} from '@/lib/types';

const kindLabels={artist:'Артисты',media:'Медиа',collective:'Проекты'} as const;
type EntryKind=keyof typeof kindLabels;
const entryKind=(artist:Artist):EntryKind=>artist.kind==='media'||artist.kind==='collective'?artist.kind:'artist';

export default function ArtistMap({artists,sections}:{artists:Artist[];sections:Section[]}){
 const [zoom,setZoom]=useState(1),[pan,setPan]=useState({x:0,y:0});
 const drag=useRef<{x:number;y:number;px:number;py:number}|null>(null),moved=useRef(false);
 const viewport=useRef<HTMLDivElement>(null),svg=useRef<SVGSVGElement>(null),view=useRef({zoom,pan});
 view.current={zoom,pan};
 const kinds=(['artist','media','collective'] as EntryKind[]).filter(kind=>artists.some(artist=>entryKind(artist)===kind));
 const activeSections=sections.filter(section=>artists.some(artist=>artist.section===section.id));
 const columnWidth=600,rowHeight=620,width=Math.max(1200,kinds.length*columnWidth),height=Math.max(620,activeSections.length*rowHeight);
 const groups=kinds.flatMap((kind,kindIndex)=>activeSections.map((section,sectionIndex)=>({kind,section,kindIndex,sectionIndex,cx:kindIndex*columnWidth+columnWidth/2,cy:sectionIndex*rowHeight+rowHeight/2,members:artists.filter(artist=>entryKind(artist)===kind&&artist.section===section.id)}))).filter(group=>group.members.length);
 const nodes=groups.flatMap(group=>group.members.map((artist,index)=>{const angle=index*2.39996,radius=48+Math.sqrt(index)*25;return {artist,x:group.cx+Math.cos(angle)*radius,y:group.cy+Math.sin(angle)*radius,cx:group.cx,cy:group.cy};}));
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
 return <div ref={viewport} className="map-wrap"><div className="map-note"><span><i/> МИР</span><span><i/> РУНЕТ И ДРУГИЕ</span><p>Колесо мыши — масштаб · перетаскивайте карту</p></div><svg ref={svg} role="group" aria-label="Карта артистов, медиа и проектов по разделам" viewBox={`0 0 ${width} ${height}`} onPointerDown={event=>{if((event.target as Element).closest('[data-node]'))return;moved.current=false;drag.current={x:event.clientX,y:event.clientY,px:pan.x,py:pan.y};event.currentTarget.setPointerCapture(event.pointerId);}} onPointerMove={event=>{if(!drag.current)return;const rect=event.currentTarget.getBoundingClientRect(),scaleX=width/rect.width,scaleY=height/rect.height;moved.current=true;setPan({x:drag.current.px+(event.clientX-drag.current.x)*scaleX,y:drag.current.py+(event.clientY-drag.current.y)*scaleY});}} onPointerUp={()=>drag.current=null} onPointerCancel={()=>drag.current=null} style={{touchAction:'none'}}><defs><pattern id="dots" width="25" height="25" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#37402e"/></pattern></defs><rect width={width} height={height} fill="url(#dots)"/><g transform={`translate(${centerX+pan.x} ${centerY+pan.y}) scale(${zoom}) translate(${-centerX} ${-centerY})`}>
 {kinds.map((kind,index)=><g className="map-kind" key={kind}><text x={index*columnWidth+28} y="104">{kindLabels[kind]}</text>{index>0&&<line x1={index*columnWidth} y1="75" x2={index*columnWidth} y2={height-25}/>}</g>)}
 {nodes.map(({artist,x,y,cx,cy})=><line key={'line'+artist.id} x1={cx} y1={cy} x2={x} y2={y} stroke={artist.section==='world'?'#8dba5533':'#a18abe33'}/>)}
 {groups.map(group=><g key={`${group.kind}-${group.section.id}`}><circle cx={group.cx} cy={group.cy} r="31" fill="#17200f" stroke="#93b866"/><text x={group.cx} y={group.cy+5} textAnchor="middle" fill="#d5e8bc" fontSize="14">{group.section.name.slice(0,18)}</text><text className="map-group-count" x={group.cx} y={group.cy+54} textAnchor="middle">{group.members.length} {group.kind==='artist'?'АРТИСТОВ':group.kind==='media'?'МЕДИА':'ПРОЕКТОВ'}</text></g>)}
 {nodes.map(({artist,x,y},index)=><a data-node="true" className="map-node" key={artist.id} href={artist.url} target="_blank" rel="noopener noreferrer" aria-label={`Открыть источник: ${artist.name}`}><circle cx={x} cy={y} r="16" fill="transparent"/><circle cx={x} cy={y} r={index%7===0?7:4} fill={artist.section==='world'?'#c9e999':'#bca4d5'}/><text x={x+11} y={y+4} fill="#cbd3bf" fontSize="11">{artist.name}</text></a>)}
 </g></svg><div className="map-controls"><button aria-label="Приблизить" onClick={()=>setZoom(value=>Math.min(3,value+.25))}><Plus size={18}/></button><span>{Math.round(zoom*100)}%</span><button aria-label="Отдалить" onClick={()=>setZoom(value=>Math.max(.5,value-.25))}><Minus size={18}/></button><button aria-label="Сбросить карту" onClick={()=>{setZoom(1);setPan({x:0,y:0});}}><RotateCcw size={16}/></button></div><p className="map-caption">Тактическая карта ИИ-сцены: артисты, медиа и проекты по секторам</p></div>;
}
