import {createHash} from 'node:crypto';
import {OPHTHALMOLOGY as P} from '@aihot/industry/ophthalmology';
import {sql} from '../db.ts';
import {credential} from '../config.ts';
import {upsertMaterial} from '../content/materials.ts';
import {paidRequest,completeReceipt,ProviderRejectedError} from '../providers/receipts.ts';
import {assertPublicUrl} from '../lib/url.ts';
import {europePmcLookup} from './primary.ts';
export interface SearchResult {url:string;title:string;description?:string;publishedAt?:string|null;providerDate?:string}
export interface SearchProvider {key:string;scope:'web'|'science';search(query:string,now:Date):Promise<{items:SearchResult[];receiptId?:number}>}
const providers=new Map<string,SearchProvider>();
export function registerSearchProvider(provider:SearchProvider){providers.set(provider.key,provider);}
registerSearchProvider({key:'europe-pmc',scope:'science',async search(query,now){
  const start=new Date(now.getTime()-7*86400000).toISOString().slice(0,10);
  const rows=await europePmcLookup(`(${query}) AND FIRST_PDATE:[${start} TO ${now.toISOString().slice(0,10)}] SORT_DATE:y`);
  return {items:rows.filter(r=>r.source==='MED' && r.id).map(r=>({url:`https://pubmed.ncbi.nlm.nih.gov/${r.id}/`,title:r.title,
    publishedAt:r.firstPublicationDate ? `${r.firstPublicationDate}T00:00:00Z`:null}))};
}});
registerSearchProvider({key:'brave',scope:'web',async search(query,now){
  const key=credential('collectors','BRAVE_SEARCH_API_KEY');if(!key)throw new Error('BRAVE_SEARCH_API_KEY is missing');
  const result=await paidRequest({service:'brave',purpose:'ophthalmology_scout',identity:{query,date:now.toISOString().slice(0,13),country:'BR',language:'pt'},requestSummary:{query}},async()=>{
    const url=new URL('https://api.search.brave.com/res/v1/web/search');url.search=new URLSearchParams({q:query,count:'20',country:'BR',search_lang:'pt-br',freshness:'pw'}).toString();
    const response=await fetch(url,{headers:{'X-Subscription-Token':key,Accept:'application/json'},signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new ProviderRejectedError(`Brave HTTP ${response.status}`,response.status,response.status===429||response.status>=500);
    return {response:await response.json()};
  });
  const raw=result.response as {web?:{results?:Array<{url:string;title:string;description?:string;page_age?:string}>}};
  return {receiptId:result.receiptId,items:(raw.web?.results ?? []).map(r=>({url:r.url,title:r.title,description:r.description,
    publishedAt:null,providerDate:r.page_age}))};
}});
export async function runScout(options:{providers?:string[];now?:Date;force?:boolean}={}) {
  if(!options.force && (process.env.OPHTHALMOLOGY_SCOUT_ENABLED!=='true'||process.env.COLLECT_ENABLED==='false'))return {disabled:true,created:0};
  const now=options.now ?? new Date();let created=0;const failures:string[]=[];
  const chosen=options.providers ?? (process.env.OPHTHALMOLOGY_SEARCH_PROVIDERS ?? 'europe-pmc').split(',').map(s=>s.trim()).filter(Boolean);
  for(const key of chosen) {
    const provider=providers.get(key);if(!provider)throw new Error(`Unknown search provider ${key}`);
    const queries=provider.scope==='science'?['retina OR cataract OR refractive surgery OR glaucoma OR cornea']:P.queries;
    for(const query of queries)try {
      const result=await provider.search(query,now);let added=0;
      for(const item of result.items) {
        if(!item.title || !item.url)continue;
        try {await assertPublicUrl(item.url);}catch{continue;}
        const host=new URL(item.url).hostname;
        const sourceId=`scout-${createHash('sha256').update(host).digest('hex').slice(0,16)}`;
        const candidates=await sql<{id:string;enabled:boolean;config:Record<string,unknown>}[]>`SELECT id,enabled,config FROM sources WHERE kind<>'external' ORDER BY first_party DESC`;
        const known=candidates.find(s=>['url','feedUrl'].some(k=>{try{return new URL(String(s.config[k])).hostname===host;}catch{return false;}}));
        if(known && !known.enabled)continue;
        if(!known)await sql`INSERT INTO sources(id,name,kind,config,tier,first_party,participation_mode,site_fulltext,syndicate_fulltext)
          VALUES (${sourceId},${host},'external','{}','T2',false,'editorial',false,false) ON CONFLICT DO NOTHING`;
        const [source]=await sql<{enabled:boolean}[]>`SELECT enabled FROM sources WHERE id=${known?.id ?? sourceId}`;
        if(!source?.enabled)continue;
        const stored=await upsertMaterial({sourceId:known?.id ?? sourceId,url:item.url,title:item.title,publishedAt:item.publishedAt && Number.isFinite(Date.parse(item.publishedAt))?new Date(item.publishedAt):null,
          excerpt:item.description,via:'ingest',raw:{scout:{provider:key,query,discoveredAt:now.toISOString(),providerDate:item.providerDate ?? null,publishedDatePrecision:provider.scope==='science'?'date':'unknown'}}});
        if(stored.created)added++;
      }
      await sql`INSERT INTO ophthalmology_scout_runs(provider,query,result_count,created_count,receipt_id) VALUES (${key},${query},${result.items.length},${added},${result.receiptId ?? null})`;
      if(result.receiptId)await completeReceipt(sql,result.receiptId);created+=added;
    }catch{failures.push(`${key}:${query}`);}
  }
  if(failures.length)throw new Error(`Scout failed: ${failures.join('; ')}; ${created} stored`);
  return {created};
}
