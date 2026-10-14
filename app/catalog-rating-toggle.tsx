'use client';

import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';

export default function CatalogRatingToggle({visible,onToggle}:{visible:boolean;onToggle:()=>void}){
 const [hintOpen,setHintOpen]=useState(false);
 const trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null),closeButton=useRef<HTMLButtonElement>(null),disableButton=useRef<HTMLButtonElement>(null);
 const suppressHover=useRef(false),restoringFocus=useRef(false);
 const showHint=visible&&hintOpen;
 function dismiss(returnFocus=false,suppressReopen=false){
  suppressHover.current=suppressReopen;setHintOpen(false);
  if(returnFocus){restoringFocus.current=true;trigger.current?.focus({preventScroll:true});restoringFocus.current=false;}
 }
 useEffect(()=>{
  if(!showHint)return;
  const outside=(event:Event)=>{const target=event.target;if(target instanceof Node&&!trigger.current?.contains(target)&&!panel.current?.contains(target))dismiss();};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();dismiss(!!panel.current?.contains(document.activeElement),true);}};
  document.addEventListener('pointerdown',outside,true);
  document.addEventListener('focusin',outside);
  document.addEventListener('keydown',escape,true);
  return()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('focusin',outside);document.removeEventListener('keydown',escape,true);};
 },[showHint]);
 return <><span><button ref={trigger} type="button" className="catalog-tag-toggle" aria-label={visible?'Скрыть рейтинговые теги':'Показать рейтинговые теги'} aria-pressed={visible} aria-haspopup="dialog" aria-expanded={showHint} aria-controls={showHint?'catalog-tag-hint':undefined} onMouseEnter={()=>{if(visible&&!suppressHover.current)setHintOpen(true);}} onMouseLeave={()=>{suppressHover.current=false;}} onFocus={()=>{if(visible&&!restoringFocus.current)setHintOpen(true);}} onKeyDown={event=>{if(showHint&&(event.key==='ArrowDown'||event.key==='Tab'&&!event.shiftKey)){event.preventDefault();closeButton.current?.focus();}}} onClick={()=>{dismiss();onToggle();}}>ТЕГ</button></span>
 {showHint&&createPortal(<div ref={panel} className="catalog-tag-hint" id="catalog-tag-hint" role="dialog" aria-labelledby="catalog-tag-hint-title" aria-describedby="catalog-tag-hint-copy" onKeyDown={event=>{if(event.key==='Tab'&&(event.shiftKey&&event.target===closeButton.current||!event.shiftKey&&event.target===disableButton.current)){event.preventDefault();dismiss(true);}}}>
  <div className="catalog-tag-hint-rail"><span id="catalog-tag-hint-title">ТЕГ // КОНТРОЛЬ ОЦЕНОК</span><button ref={closeButton} type="button" className="catalog-tag-hint-close" aria-label="Закрыть подсказку о тегах" onClick={()=>dismiss(true)}><span aria-hidden="true">×</span></button></div>
  <div className="catalog-tag-hint-screen"><p id="catalog-tag-hint-copy">ты кто такой, чтобы присваивать теги ИИшникам, ты получал сертификат судьи? <strong>отлкючи эту херню</strong></p></div>
  <div className="catalog-tag-hint-footer"><span><i aria-hidden="true"/>РЕЙТИНГИ A / AA / AAA / AAA+</span><button ref={disableButton} type="button" className="catalog-tag-hint-disable" onClick={()=>{dismiss(true);onToggle();}}>Отключить теги</button></div>
 </div>,document.body)}
 </>;
}
