import {useState,type CSSProperties} from 'react';
import {DialogContent,DialogTitle} from '@/components/ui/dialog';
import type {Video} from '@/lib/types';

export default function VideoPlayer({video}:{video:Video}){
 const [ratio,setRatio]=useState(16/9),[failed,setFailed]=useState(false);
 return <DialogContent className="video-player-dialog" aria-describedby={undefined} style={{'--video-player-ratio':ratio} as CSSProperties}>
  <DialogTitle className="sr-only">{video.name}</DialogTitle>
  {failed?<div className="video-playback-error" role="alert"><p>Не удалось загрузить видео.</p><a href={video.url} target="_blank" rel="noopener noreferrer">Открыть источник ↗</a></div>:video.media?<video src={video.media} poster={video.image||undefined} controls autoPlay playsInline preload="metadata" onLoadedMetadata={event=>{const player=event.currentTarget;if(player.videoWidth&&player.videoHeight)setRatio(player.videoWidth/player.videoHeight);}} onError={()=>setFailed(true)}/>:<iframe title={video.name} src={'https://www.youtube-nocookie.com/embed/'+video.videoId+'?autoplay=1&rel=0'} referrerPolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen/>}
 </DialogContent>;
}
