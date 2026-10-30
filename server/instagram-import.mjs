function authorName(value){
 return value.replace(/\s+/g,' ').trim().slice(0,160);
}

function postDescription(value){
 return value?.match(/^(?:\d[^\r\n]*?\s[-–—]\s)?([A-Za-z0-9._]{1,30})\s+on\s+([^:\r\n]+):/);
}

export function instagramDescriptionDate(meta){
 const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
 for(const description of [meta['og:description'],meta.description]){
  // Only the publication header supplies the date; captions may advertise
  // events on a different day. Keep the source's calendar date without a TZ shift.
  const parts=postDescription(description)?.[2].trim().match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/);
  if(!parts)continue;
  const month=months.indexOf(parts[1].toLowerCase())+1;
  if(!month)continue;
  const date=`${parts[3]}-${String(month).padStart(2,'0')}-${parts[2].padStart(2,'0')}`;
  const parsed=new Date(date);
  if(!isNaN(parsed)&&parsed.toISOString().slice(0,10)===date)return date;
 }
 return '';
}

export function instagramPageAuthor(meta){
 // The description starts with engagement counts, the owner's username and
 // the date. Do not use @mentions from the caption as the post's author.
 for(const description of [meta['og:description'],meta.description]){
  const username=postDescription(description)?.[1];
  if(username)return username;
 }
 for(const title of [meta['og:title'],meta['twitter:title']]){
  if(!title)continue;
  const profile=title.match(/^.*?\(@([A-Za-z0-9._]{1,30})\)\s*[•|–-]\s*Instagram\b/i)?.[1];
  if(profile)return profile;
  const author=title.match(/^([^\r\n]+?)\s+(?:on|в)\s+Instagram\s*:/i)?.[1];
  if(author)return authorName(author);
 }
 return '';
}
