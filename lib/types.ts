export type EntryKind='artist'|'media'|'collective';
export type ArtistRating='A'|'AA'|'AAA'|'AAA+';
export type Artist={kind?:EntryKind;rating?:ArtistRating;id:string;name:string;url:string;section:string;platform:string;description:string;image:string;tags:string};
export type Section={id:string;name:string};
export const defaultSections:Section[]=[{id:'world',name:'Мир'},{id:'runet',name:'Рунет'}];

export type Video={id:string;name:string;url:string;platform:string;videoId:string;reference:boolean;title:string;publishedAt:string;dateSource:string;dateUrl:string;image:string;description:string;alternateUrls:string[];sourceOrder:number};
