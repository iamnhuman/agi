import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';

type CursorMode='arrow'|'target'|'text';
const actionSelector='a[href],button,select,option,summary,[role="button"],[role="option"],[role="menuitem"],[data-slot="select-trigger"],[data-slot="select-item"],[data-slot="dialog-close"],label:has(input),input[type="radio"],input[type="checkbox"],input[type="range"],input[type="file"],.artist-card,.admin-row,.video-card,.canvas-deck-stage,.timeline-content';
const textSelector='textarea,input:not([type="radio"]):not([type="checkbox"]):not([type="range"]):not([type="file"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"]),[contenteditable="true"]';

function cursorMode(element:Element):CursorMode{
 if(element.closest(':disabled,[aria-disabled="true"],[data-disabled]'))return 'arrow';
 if(element.closest(textSelector))return 'text';
 return element.closest(actionSelector)?'target':'arrow';
}

export default function PixelCursor(){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const cursor=ref.current;if(!cursor)return;
  const root=document.documentElement,media=window.matchMedia('(any-hover: hover) and (any-pointer: fine)');
  let ready=false,disposed=false,inside=false,nativePopup=false,x=0,y=0,lastMode:CursorMode='arrow';
  const hide=()=>{inside=false;cursor.dataset.visible='false';root.classList.remove('pixel-cursor-active');};
  const draw=(element:Element|null)=>{
   if(!ready||!media.matches||!element||element.closest('iframe,video')||x<0||y<0||x>=root.clientWidth||y>=root.clientHeight){hide();return;}
   const mode=cursorMode(element),offset=mode==='arrow'?2:16;
   if(mode!==lastMode){cursor.dataset.mode=mode;lastMode=mode;}
   cursor.style.transform=`translate3d(${x-offset}px,${y-offset}px,0)`;
   cursor.dataset.visible='true';root.classList.add('pixel-cursor-active');inside=true;
  };
  const move=(event:PointerEvent)=>{
   if(event.pointerType!=='mouse'){hide();return;}
   nativePopup=false;
   x=event.clientX;y=event.clientY;draw(document.elementFromPoint(x,y));
  };
  const over=(event:PointerEvent)=>{if(!nativePopup)move(event);};
  const release=(event:PointerEvent)=>{if(!nativePopup)move(event);};
  const leave=(event:PointerEvent)=>{if(!event.relatedTarget)hide();};
  const press=(event:PointerEvent)=>{
   // Native popups and embedded players draw above the document. Let them own
   // the pointer until mouse events return to the page.
   const element=event.target instanceof Element?event.target:null;
   if(element?.closest('select,input[type="date"],input[type="color"]')){nativePopup=true;hide();}
   else move(event);
  };
  const refresh=()=>{if(inside)draw(document.elementFromPoint(x,y));};
  const visibility=()=>{if(document.hidden)hide();};
  const settings=()=>{if(!media.matches)hide();};
  // Read the resolved CSS URLs so the same assets work in local and Pages builds.
  // Keep the native fallback until every bitmap has actually loaded.
  const urls=(['arrow','target','text'] as const).map(mode=>{
   cursor.dataset.mode=mode;
   return getComputedStyle(cursor).backgroundImage.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
  });
  cursor.dataset.mode=lastMode;
  const images=urls.map(url=>new Promise<boolean>(resolve=>{
   if(!url){resolve(false);return;}
   const image=new Image();image.onload=()=>resolve(image.naturalWidth>0);image.onerror=()=>resolve(false);image.src=url;
  }));
  void Promise.all(images).then(loaded=>{if(!disposed){ready=loaded.every(Boolean);cursor.dataset.ready=String(ready);}});
  const options={capture:true,passive:true};
  window.addEventListener('pointermove',move,options);
  window.addEventListener('pointerover',over,options);
  window.addEventListener('pointerdown',press,options);
  window.addEventListener('pointerup',release,options);
  window.addEventListener('pointerout',leave,options);
  window.addEventListener('blur',hide);
  window.addEventListener('scroll',refresh,options);
  document.addEventListener('visibilitychange',visibility);
  media.addEventListener('change',settings);
  return()=>{
   disposed=true;hide();
   window.removeEventListener('pointermove',move,true);
   window.removeEventListener('pointerover',over,true);
   window.removeEventListener('pointerdown',press,true);
   window.removeEventListener('pointerup',release,true);
   window.removeEventListener('pointerout',leave,true);
   window.removeEventListener('blur',hide);
   window.removeEventListener('scroll',refresh,true);
   document.removeEventListener('visibilitychange',visibility);
   media.removeEventListener('change',settings);
  };
 },[]);
 return createPortal(<div ref={ref} className="pixel-cursor" data-mode="arrow" data-visible="false" data-ready="false" aria-hidden="true"/>,document.body);
}
