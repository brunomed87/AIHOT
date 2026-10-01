// Read-only source discovery: probe real URLs and inspect collectors before enabling a seed.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fetchRss} from '@aihot/backend/sources/rss';
import {fetchWebList} from '@aihot/backend/sources/web-list';
import {fetchJsonList} from '@aihot/backend/sources/json-list';
import type {SourceRow} from '@aihot/backend/sources/types';
const candidates=JSON.parse(readFileSync('industry/ophthalmology-source-candidates.json','utf8')) as {sources:SourceRow[]};
const results:unknown[]=[];
for(let i=0;i<candidates.sources.length;i+=4)await Promise.all(candidates.sources.slice(i,i+4).map(async source=>{
  try {
    const result=source.kind==='rss'?await fetchRss(source):source.kind==='json_list'?await fetchJsonList(source):await fetchWebList(source);
    const items=Array.isArray(result)?result:result.candidates;
    results.push({id:source.id,status:items.length?'verified':'empty',count:items.length,sample:items.slice(0,2).map(c=>({title:c.title,url:c.url,publishedAt:c.publishedAt})),verifiedAt:new Date().toISOString()});
  }catch(e){results.push({id:source.id,status:'failed',error:String(e).slice(0,200),verifiedAt:new Date().toISOString()});}
}));
mkdirSync('.data',{recursive:true});writeFileSync('.data/source-verification.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results));
