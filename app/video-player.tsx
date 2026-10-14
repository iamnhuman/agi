import {useState,type CSSProperties} from 'react';
import {ArrowUpRight} from 'lucide-react';
import {DialogContent,DialogTitle} from '@/components/ui/dialog';
import type {Video} from '@/lib/types';

export default function VideoPlayer({video}:{video:Video}){
 const [ratio,setRatio]=useState(16/9),[failed,setFailed]=useState(false);
 const withSource=video.platform==='Instagram';
 const player=failed?<div className="video-playback-error" role="alert"><p>Не удалось загрузить видео.</p>{!withSource&&<a href={video.url} target="_blank" rel="noopener noreferrer">Открыть источник ↗</a>}</div>:video.media?<video src={video.media} poster={video.image||undefined} controls autoPlay playsInline preload="metadata" onLoadedMetadata={event=>{const player=event.currentTarget;if(player.videoWidth&&player.videoHeight)setRatio(player.videoWidth/player.videoHeight);}} onError={()=>setFailed(true)}/>:<iframe title={video.name} src={'https://www.youtube-nocookie.com/embed/'+video.videoId+'?autoplay=1&rel=0'} referrerPolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen/>;
 return <DialogContent className={'video-player-dialog'+(withSource?' video-player-dialog--source':'')} aria-describedby={undefined} style={{'--video-player-ratio':ratio} as CSSProperties}>
  <DialogTitle className={withSource?'video-player-heading':'sr-only'}>{withSource&&<span>Instagram</span>}{video.name}</DialogTitle>
  {withSource?<div className="video-player-media">{player}</div>:player}
  {withSource&&<div className="video-player-footer"><a className="video-player-source" href={video.url} target="_blank" rel="noopener noreferrer">Открыть в Instagram<ArrowUpRight size={16} aria-hidden="true"/></a></div>}
 </DialogContent>;
}
