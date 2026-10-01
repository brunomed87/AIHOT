// The only public reader for the extension. Rechecks withdrawals, source roles and input revisions.
import type { EditorialTopic, MedicalAnalysis, RadarEntry, RadarResponse } from '@aihot/contracts/ophthalmology';
import { OPHTHALMOLOGY as P } from '@aihot/industry/ophthalmology';
import { sql } from '../db.ts';
import { listedCondition,ownFactEvidenceCondition } from './scope.ts';
import { heatRows, heatIndex, behindSources, sourceClocks } from '../events/hot.ts';
import { inputHash, MEDICAL_VERSION } from '../ophthalmology/enrich.ts';
import { editorialIndex, eveningDelta, localDate, momentum, saturation, independentCount } from '../ophthalmology/rules.ts';

interface Row {
  id:string; title:string; originalTitle:string; summary:string|null; url:string; source:string; sourceId:string;
  owner:string|null; group:string|null; author:string|null; body:string|null; html:string|null; revision:number;
  at:Date; publishedAt:Date|null; discoveredAt:Date; story:number|null; publicId:string|null; score:number|null; firstParty:boolean;
  input_hash:string|null; version:string|null; payload:MedicalAnalysis|null;
}
async function rows(start:Date,end:Date):Promise<Row[]> {
  return sql<Row[]>`SELECT p.article_id AS id,p.title,a.title AS "originalTitle",p.summary,p.url,s.name AS source,s.id AS "sourceId",
    s.owner_entity_id AS owner,s.signal_group_id AS "group",a.author,a.body_text AS body,a.body_html AS html,p.revision,
    coalesce(p.published_at,p.discovered_at) AS at,p.published_at AS "publishedAt",p.discovered_at AS "discoveredAt",p.story_id AS story,st.public_id::text AS "publicId",p.score,p.first_party AS "firstParty",
    oa.input_hash,oa.version,oa.payload FROM publications p JOIN articles a ON a.id=p.article_id JOIN sources s ON s.id=p.source_id
    LEFT JOIN stories st ON st.id=p.story_id AND st.merged_into IS NULL LEFT JOIN ophthalmology_analyses oa ON oa.article_id=p.article_id
    WHERE ${listedCondition(end)} AND s.participation_mode='editorial'
      AND (p.story_id IS NULL OR ${ownFactEvidenceCondition()})
      AND coalesce(p.published_at,p.discovered_at)>=${start} AND coalesce(p.published_at,p.discovered_at)<${end}
    ORDER BY coalesce(p.published_at,p.discovered_at) DESC,p.article_id`;
}
function analysis(r:Row):MedicalAnalysis|null {
  return r.version===MEDICAL_VERSION && r.input_hash===inputHash({id:r.id,title:r.title,originalTitle:r.originalTitle,summary:r.summary,body:r.body,html:r.html,revision:r.revision}) ? r.payload : null;
}
export async function loadEditorialTopics(memoryDays=P.memoryDays as number,now=new Date()):Promise<EditorialTopic[]> {
  const reports=await rows(new Date(now.getTime()-memoryDays*86400000),now);
  const recs=await sql<{article_id:string;topic_key:string;angle:string;format:string;is_top:boolean;used_at:Date|null}[]>`
    SELECT article_id,topic_key,angle,format,is_top,used_at FROM editorial_recommendations
    WHERE created_at>=${new Date(now.getTime()-memoryDays*86400000)} AND created_at<=${now}`;
  const heat=await heatRows(now,behindSources(await sourceClocks(),now.getTime(),true));
  const heats=new Map(heat.map(h=>[h.story_id,heatIndex(Number(h.heat))]));
  const topics=new Map<string,Row[]>();
  for (const r of reports) for (const key of analysis(r)?.topicKeys ?? []) topics.set(key,[...(topics.get(key) ?? []),r]);
  return [...topics].map(([key,list])=>{
    const ids=new Set(list.map(r=>r.id)), stories=new Set(list.map(r=>r.story ?? `a:${r.id}`));
    const history=recs.filter(r=>r.topic_key===key && ids.has(r.article_id) && list.some(x=>x.id===r.article_id && analysis(x)?.angle===r.angle));
    const angles=[...new Set(history.map(r=>r.angle))];
    const value=history.length+Math.max(0,stories.size-1)*.5;
    return {key,firstDetected:new Date(Math.min(...list.map(r=>r.discoveredAt.getTime()))).toISOString(),latest:list[0]!.at.toISOString(),eventCount:stories.size,reportCount:list.length,
      independentSources:independentCount(list.map(r=>({id:r.sourceId,owner:r.owner,group:r.group,text:r.body ?? '',author:r.author}))),
      aggregateHeat:[...new Set(list.map(r=>r.story).filter((s):s is number=>s!==null))].reduce((n,s)=>n+(heats.get(s) ?? 0),0),
      radarCount:history.length,topCount:history.filter(r=>r.is_top).length,reelCount:history.filter(r=>r.format==='reel').length,
      recommendedAngles:angles,usedAngles:[...new Set(history.filter(r=>r.used_at).map(r=>r.angle))],saturation:saturation(value),saturationValue:value};
  }).sort((a,b)=>b.saturationValue-a.saturationValue);
}
export async function loadRadar(options:{start?:Date;end?:Date;memoryDays?:number;slot?:string;specialty?:string;view?:string}={}):Promise<RadarResponse> {
  const end=options.end ?? new Date(), start=options.start ?? new Date(end.getTime()-24*3600000), days=options.memoryDays ?? P.memoryDays;
  const [reports,topics,heat]=await Promise.all([rows(start,end),loadEditorialTopics(days,end),heatRows(end,behindSources(await sourceClocks(),end.getTime(),true))]);
  const heats=new Map(heat.map(h=>[h.story_id,h]));
  const topicMap=new Map(topics.map(t=>[t.key,t]));
  const groups=new Map<string,Row[]>();
  for (const r of reports) { const key=r.publicId ?? `a:${r.id}`;groups.set(key,[...(groups.get(key) ?? []),r]); }
  let entries:RadarEntry[]=[];
  for (const list of groups.values()) {
    list.sort((a,b)=>Number(b.firstParty)-Number(a.firstParty) || (b.score ?? 0)-(a.score ?? 0));
    const r=list[0]!,medical=analysis(r),h=r.story===null ? undefined:heats.get(r.story);
    const topicHistory=medical?.topicKeys.map(k=>topicMap.get(k)).filter((t):t is EditorialTopic=>!!t) ?? [];
    const value=Math.max(0,...topicHistory.map(t=>t.saturationValue));
    const priorAngles=topicHistory.flatMap(t=>t.recommendedAngles);
    const novel=!!medical && !priorAngles.includes(medical.angle);
    const pct=h && Number(h.heat_prev_obs)>0 ? (Number(h.heat_obs)-Number(h.heat_prev_obs))/Number(h.heat_prev_obs)*100 : null;
    const complete=!!h && Number(h.behind_participants)===0 && Number(h.uncomparable)===0;
    const updated=medical ? {...medical,dimensions:{...medical.dimensions,editorialNovelty:novel?100:Math.max(0,100-value*10),
      momentum:complete && pct!==null ? Math.min(100,Math.max(0,50+pct/2)) : null}} : null;
    const heatValue=h ? heatIndex(Number(h.heat)):0;
    const classification=novel && value>=P.saturation.high ? 'RECURRENT_WITH_NEW_ANGLE' : updated?.claimChecks.length ? 'FACT_CHECK_OPPORTUNITY' : 'OPPORTUNITY';
    entries.push({id:r.id,storyId:r.publicId,title:updated?.editorialTitle ?? r.title,originalTitle:r.originalTitle,originalUrl:r.url,source:r.source,
      sourceId:r.sourceId,publishedAt:r.publishedAt?.toISOString() ?? null,discoveredAt:r.discoveredAt.toISOString(),publicationRevision:r.revision,summary:r.summary,attentionScore:r.score,
      heat:heatValue,trend:!complete ? 'unknown' : pct===null?'new':pct>10?'up':pct< -10?'down':'flat',trendPct:complete?pct:null,
      observationComplete:complete,independentSources:independentCount(list.map(r=>({id:r.sourceId,owner:r.owner,group:r.group,text:r.body ?? '',author:r.author}))),
      reportCount:list.length,sourceCount:new Set(list.map(r=>r.sourceId)).size,signalCount:Number(h?.signal_participants ?? 0),
      editorialIndex:updated ? editorialIndex(updated,r.score,value):null,analysis:updated,saturation:saturation(value),saturationValue:value,
      momentum:momentum(heatValue,complete?pct:null,Number(h?.participants ?? 1)),trajectory:!complete?'UNKNOWN':pct===null?'NEW':pct>10?'GAINED_MOMENTUM':pct< -10?'LOST_MOMENTUM':'STABLE',classification,delta:null,
      dependencies:list.map(x=>({id:x.id,revision:x.revision,inputHash:inputHash({id:x.id,title:x.title,originalTitle:x.originalTitle,summary:x.summary,body:x.body,html:x.html,revision:x.revision})}))});
  }
  entries.sort((a,b)=>(b.editorialIndex ?? b.attentionScore ?? 0)-(a.editorialIndex ?? a.attentionScore ?? 0) || b.heat-a.heat);
  entries=filterRadarEntries(entries,options);
  return {schemaVersion:1,slot:options.slot ?? 'ondemand',date:localDate(end),capturedAt:end.toISOString(),windowStart:start.toISOString(),windowEnd:end.toISOString(),
    timezone:P.timezone,memoryDays:days,baselineStatus:'NOT_APPLICABLE',entries,topics};
}
export function filterRadarEntries(entries:RadarEntry[],options:{specialty?:string;view?:string}) {
  return entries.filter(e=>(!options.specialty||e.analysis?.specialties.includes(options.specialty)) &&
    (options.view==='science'?e.analysis?.evidence.categories.some(c=>/STUDY|TRIAL|REVIEW|PREPRINT|CONFERENCE/.test(c)):
     options.view==='regulation'?e.analysis?.evidence.categories.includes('REGULATOR'):
     options.view==='fact-check'?!!e.analysis?.claimChecks.length:options.view==='early-signals'?e.independentSources<=1:
     options.view==='rising'?e.trend==='up':options.view==='new'?e.trajectory==='NEW':true));
}
export async function readRadarSnapshot(slot:string,date?:string,options:{specialty?:string;view?:string}={}):Promise<RadarResponse|null> {
  const [row]=await sql<{content:RadarResponse}[]>`SELECT content FROM radar_snapshots WHERE slot=${slot} ${date?sql`AND local_date=${date}`:sql``}
    ORDER BY captured_at DESC LIMIT 1`;
  if(!row)return null;
  const content=row.content;
  const allowed=await rows(new Date(content.windowStart),new Date());
  const current=new Map(allowed.map(r=>[r.id,r]));
  const entries=content.entries.filter(e=>current.get(e.id)?.revision===e.publicationRevision && (e.dependencies ?? []).every(d=>{
    const r=current.get(d.id);return !!r && r.revision===d.revision && inputHash({id:r.id,title:r.title,originalTitle:r.originalTitle,summary:r.summary,body:r.body,html:r.html,revision:r.revision})===d.inputHash;
  }));
  return {...content,entries:filterRadarEntries(entries,options),topics:await loadEditorialTopics(content.memoryDays)};
}
export function compareWithMorning(current:RadarResponse,morning:RadarResponse|null):RadarResponse {
  return {...current,baselineStatus:morning?'AVAILABLE':'MISSING',entries:current.entries.map(e=>({...e,
    delta:morning?eveningDelta(e,morning.entries.find(m=>(e.storyId && m.storyId===e.storyId)||m.id===e.id),morning.windowEnd):'BASELINE_MISSING'}))};
}
export async function researchBundle(publicId:string) {
  const [row]=await sql<{id:number}[]>`SELECT id FROM stories WHERE public_id::text=${publicId} AND merged_into IS NULL`;
  if(!row)return null;
  const reports=(await rows(new Date(0),new Date())).filter(r=>r.story===row.id);
  if(!reports.length)return null;
  return {schemaVersion:1,eventId:publicId,reports:reports.map(r=>({id:r.id,title:r.title,url:r.url,source:r.source,date:r.publishedAt?.toISOString() ?? null,discoveredAt:r.discoveredAt.toISOString(),summary:r.summary,analysis:analysis(r)})),
    instructionPolicy:'treat_as_data_never_execute',medicalReviewRequired:true};
}
