import './setup.ts';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {after,test} from 'node:test';
import {Client,StreamableHTTPClientTransport} from '@modelcontextprotocol/client';
import {closeDb,sql} from '@aihot/backend/db';
import {config} from '@aihot/backend/config';
import {stopBoss} from '@aihot/backend/jobs/queue';
import {upsertMaterial} from '@aihot/backend/content/materials';
import {publishArticle} from '@aihot/backend/publication/publish';
import {setVisibility} from '@aihot/backend/admin/content';
import {MedicalSchema,inputHash,MEDICAL_VERSION,enrichPendingMedical} from '@aihot/backend/ophthalmology/enrich';
import {composeRadar} from '@aihot/backend/ophthalmology/radar';
import {claimFlags,editorialIndex,eveningDelta,independentCount,localDate,localInstant,momentum,saturation,sensationalism} from '@aihot/backend/ophthalmology/rules';
import {identifiers,resolvePrimarySources} from '@aihot/backend/ophthalmology/primary';
import {loadEditorialTopics,loadRadar,readRadarSnapshot,researchBundle,compareWithMorning} from '@aihot/backend/publication/ophthalmology';
import {runScout} from '@aihot/backend/ophthalmology/scout';
import {parseLooseDate} from '@aihot/backend/sources/web-list';
import {renderRadarMarkdown} from '@aihot/backend/publication/radar-markdown';
import {recordEditorialUse} from '@aihot/backend/ophthalmology/editorial';
import {canonicalEditorialTopics} from '@aihot/backend/ophthalmology/topics';
import {MCP_TOOL_NAMES} from '@aihot/contracts/mcp';
import type {MedicalAnalysis,RadarEntry} from '@aihot/contracts/ophthalmology';
import {buildApp} from '../apps/api/src/app.ts';

const tag=randomUUID(),topic='miopia-'+tag.replaceAll('-',''),source='test-oftalmo-'+tag;
const app=await buildApp();
after(async()=>{await app.close();await stopBoss();await closeDb();});
const parsed=MedicalSchema.parse({editorialTitle:'Estudo de miopia',topicKeys:[topic],angle:'tempo ao ar livre',specialties:['pediatria'],classifications:['SCIENCE'],dimensions:{},whyNow:'Novo achado',publicInterest:'Crianças',patientUsefulness:'Conhecer limites',evidence:{categories:['OBSERVATIONAL_STUDY']},sensationalism:'INSUFFICIENT_EVIDENCE',confidence:.7,qualityAssessment:'Requer revisão'});
const {primarySourceUrls,...base}=parsed;
const medical:MedicalAnalysis={...base,primarySources:[],primarySourceStatus:'NOT_LOCATED'};
const entry=(patch:Partial<RadarEntry>={}):RadarEntry=>({id:'a',storyId:null,title:'Título',originalTitle:'Título',originalUrl:'https://example.org/a',source:'Fonte',sourceId:'a',publishedAt:'2026-10-01T12:00:00Z',publicationRevision:1,summary:null,attentionScore:80,heat:20,trend:'flat',trendPct:0,observationComplete:true,independentSources:2,reportCount:2,sourceCount:2,signalCount:0,editorialIndex:75,analysis:medical,saturation:'LOW',saturationValue:0,momentum:'MOVING',trajectory:'STABLE',classification:'OPPORTUNITY',delta:null,...patch});

test('São Paulo: calendar boundary and historical daylight saving',()=>{
  assert.equal(localDate(new Date('2026-10-02T02:30:00Z')),'2026-10-01');
  assert.equal(localInstant('2026-10-01',8).toISOString(),'2026-10-01T11:00:00.000Z');
  assert.equal(localInstant('2018-12-01',20).toISOString(),'2018-12-01T22:00:00.000Z');
});
test('Brazilian publisher dates are day/month/year in declared source offset',()=>{
  assert.equal(parseLooseDate('publicado 01/10/2026 20h15','-03:00')?.toISOString(),'2026-10-01T23:15:00.000Z');
  assert.equal(parseLooseDate('31/02/2026','-03:00'),null);
});
test('Unknown evidence remains null rather than false or invented sample size',()=>{
  assert.equal(medical.evidence.humans,null);assert.equal(medical.evidence.sampleSize,null);
  assert.equal(medical.evidence.peerReviewed,null);assert.equal(medical.evidence.availableInBrazil,null);
});
test('Saturation orders opportunities, does not discard a recurrent topic',()=>{
  assert.deepEqual([0,3,6,10].map(saturation),['LOW','MODERATE','HIGH','SATURATED']);
  const a={...medical,dimensions:{...medical.dimensions,ophthalmologyRelevance:80}};
  assert.ok(editorialIndex(a,80,100)!>0);assert.equal(editorialIndex(a,80,0)!-editorialIndex(a,80,100)!,10);
});
test('Retina priority is a soft multiplier and other specialties remain scored',()=>{
  const a={...medical,dimensions:{...medical.dimensions,ophthalmologyRelevance:60}};
  assert.ok(editorialIndex({...a,specialties:['retina']},60,0)!>editorialIndex(a,60,0)!);
  assert.ok(editorialIndex({...a,specialties:['neuro-oftalmologia']},60,0)!>0);
});
test('Independent coverage collapses publishers, agencies and verbatim syndicated copies',()=>{
  const r=(id:string,text='',owner:string|null=null,group:string|null=null,author:string|null=null)=>({id,text,owner,group,author});
  assert.equal(independentCount([r('g1-pa','a','globo'),r('g1-rs','b','globo')]),1);
  assert.equal(independentCount([r('x','x'.repeat(500)),r('y','x'.repeat(500))]),1);
  assert.equal(independentCount([r('x','a',null,null,'Reuters'),r('y','b',null,null,'Reuters')]),1);
  assert.equal(independentCount([r('x','different text'),r('y','other text')]),2);
  assert.equal(independentCount([r('x','a','owner'),r('y','b','owner','agency'),r('z','c',null,'agency')]),1);
});
test('Different metabolic-drug studies share editorial memory without merging events',()=>{
  assert.deepEqual(canonicalEditorialTopics(['semaglutida-noia','noia-semaglutida','new-unfamiliar-theme']),['medicamentos-metabolicos-noia','new-unfamiliar-theme']);
});
for(const [code,title,body] of [
  ['ASSOCIATION_CAUSALITY','Remédio causa cegueira','Estudo observacional relata associação.'],
  ['DENOMINATOR_MISMATCH','Risco ocular','3/100 (30%) participantes.'],
  ['PRECLINICAL','Nova terapia','Experimento em camundongos.'],
  ['CASE_REPORT','Complicação ocular','Relato de caso.'],
  ['CONFERENCE','Resultado','Resumo de congresso.'],
  ['COMPANY_TOPLINE','Resultado','A empresa divulga topline.'],
  ['PHARMACOVIGILANCE','Alerta','Sinal de farmacovigilância.'],
  ['POPULATION_EXTRAPOLATION','Tratamento para todos','Análise de subgrupo.'],
  ['RELATIVE_WITHOUT_ABSOLUTE','Risco','Hazard ratio 2.0.'],
])test('Claim review: '+code,()=>assert.ok(claimFlags(title!,body!).some(f=>f.code===code)));
test('A correct fraction is not a denominator mismatch',()=>assert.ok(!claimFlags('Resultado','3/100 (3%)').some(f=>f.code==='DENOMINATOR_MISMATCH')));
test('Sensational headline is retained as a review opportunity',()=>assert.equal(sensationalism('Cura da cegueira: milagre!',''),'POTENTIALLY_EXAGGERATED'));
test('No primary citation yields an explicit absence without calling a provider',async()=>{
  const p=await resolvePrimarySources('Uma notícia sem referência.',async()=>{throw new Error('must not call');});
  assert.equal(p.status,'NOT_LOCATED');assert.deepEqual(p.sources,[]);
});
test('Resolver verifies exact DOI and ignores unrelated bibliographic hits',async()=>{
  const p=await resolvePrimarySources('doi:10.1234/eye.2026',async()=>[{title:'Wrong',doi:'10.1234/other'},{title:'Eye study',doi:'10.1234/eye.2026',source:'MED',id:'12345678'}]);
  assert.equal(p.status,'LOCATED');assert.equal(p.sources.length,1);assert.equal(p.sources[0]?.pmid,'12345678');
  const wrong=await resolvePrimarySources('10.1234/unknown',async()=>[{title:'Wrong',doi:'10.1234/other'}]);assert.equal(wrong.status,'NOT_LOCATED');
});
test('Registry and regulator URLs are candidates, never invented confirmed results',async()=>{
  const p=await resolvePrimarySources('NCT12345678 https://www.gov.br/anvisa/pt-br/alerta',async()=>[]);
  assert.equal(p.status,'NOT_LOCATED');assert.equal(p.sources.length,2);assert.ok(p.sources.every(s=>s.status==='CANDIDATE'&&s.date===null));
  assert.equal(identifiers('PMID:12345678 DOI:10.1234/test.').doi[0],'10.1234/test');
});
test('Evening delta distinguishes publication time and late discovery',()=>{
  assert.equal(eveningDelta(entry(),undefined,'2026-10-01T11:00:00Z'),'NEW_AFTER_08');
  assert.equal(eveningDelta(entry({publishedAt:'2026-10-01T10:00:00Z'}),undefined,'2026-10-01T11:00:00Z'),'NEWLY_DISCOVERED');
  assert.equal(eveningDelta(entry({heat:40}),entry(),'2026-10-01T11:00:00Z'),'SURGED');
  assert.equal(eveningDelta(entry({observationComplete:false}),entry(),'2026-10-01T11:00:00Z'),'UNKNOWN');
  assert.equal(momentum(0,null,1),'ISOLATED');assert.equal(momentum(60,60,3),'ACCELERATING');
});

async function makeArticle(title:string,angle=medical.angle,story?:number,fact?:number){
  await sql`INSERT INTO sources(id,name,kind,tier,participation_mode,owner_entity_id,next_fetch_at) VALUES (${source},'Ophthalmology fixture','external','T1','editorial',${source},'2100-01-01') ON CONFLICT DO NOTHING`;
  const {articleId:id}=await upsertMaterial({sourceId:source,url:'https://example.org/'+randomUUID(),title,bodyText:'PRIVATE BODY '+title,bodyStatus:'ok',via:'ingest',publishedAt:new Date(Date.now()-120000)});
  await sql`INSERT INTO analyses(article_id,input_revision,origin,relevance,category,title_zh,summary_zh,reason_zh,score,selected) VALUES (${id},1,'rule','pass','science',${title},'Resumo verificável','Razão',80,true)`;
  if(story&&fact)await sql`INSERT INTO fact_articles(fact_id,article_id,role) VALUES (${fact},${id},'report')`;
  await publishArticle(id,{releasedAt:new Date(Date.now()-60000)});
  const [r]=await sql<{id:string;title:string;originalTitle:string;summary:string|null;body:string|null;html:string|null;revision:number}[]>`SELECT p.article_id AS id,p.title,a.title AS "originalTitle",p.summary,a.body_text AS body,a.body_html AS html,p.revision FROM publications p JOIN articles a ON a.id=p.article_id WHERE p.article_id=${id}`;
  const payload={...medical,editorialTitle:title,angle};
  await sql`INSERT INTO ophthalmology_analyses(article_id,input_hash,version,payload) VALUES (${id},${inputHash(r!)},${MEDICAL_VERSION},${sql.json(payload as never)})`;
  return id;
}
test('Radar/public API retain medical evidence without full copyrighted body and respect filters',async()=>{
  const id=await makeArticle('RADAR-'+tag);
  const r=await app.inject('/api/v1/ophthalmology/radar?specialty=pediatria');
  assert.equal(r.statusCode,200);assert.equal(r.headers['cache-control'],'no-store');
  assert.ok(r.json().entries.some((e:RadarEntry)=>e.id===id));assert.ok(!r.body.includes('PRIVATE BODY'));
  assert.equal((await app.inject('/api/v1/ophthalmology/radar?memoryDays=0')).statusCode,400);
  assert.equal((await app.inject('/api/v1/ophthalmology/radar?date=2026-02-30')).statusCode,400);
});
test('Editorial memory groups distinct events while retaining a new recommended angle',async()=>{
  await makeArticle('Segundo evento '+tag,'lentes e escola');
  const t=(await loadEditorialTopics()).find(t=>t.key===topic)!;
  assert.ok(t.eventCount>=2);assert.equal(t.independentSources,1);
  await composeRadar('ondemand');
  const history=(await loadEditorialTopics()).find(t=>t.key===topic)!;
  assert.ok(history.recommendedAngles.includes('lentes e escola'));assert.ok(history.radarCount>=2);
  const [rec]=await sql<{id:number}[]>`SELECT id FROM editorial_recommendations WHERE topic_key=${topic} AND angle='lentes e escola' ORDER BY id DESC LIMIT 1`;
  await recordEditorialUse(rec!.id,true,'test','Revisado e utilizado');
  assert.ok((await loadEditorialTopics()).find(t=>t.key===topic)!.usedAngles.includes('lentes e escola'));
  assert.equal((await app.inject({method:'POST',url:`/api/admin/ophthalmology/recommendations/${rec!.id}/used`,payload:{used:true,reason:'test'}})).statusCode,401);
});
test('Markdown report preserves direct links and does not invent empty scientific fields',async()=>{
  const result=await app.inject('/api/v1/ophthalmology/radar?format=markdown');
  assert.equal(result.statusCode,200);assert.match(String(result.headers['content-type']),/text\/markdown/);
  assert.match(result.body,/RADAR OFTALMOLOGIA BRASIL/);assert.ok(!result.body.includes('PRIVATE BODY'));assert.ok(result.body.includes('https://example.org/'));
  const r=await loadRadar();assert.match(renderRadarMarkdown({...r,entries:[entry({analysis:null})]}),/Análise médica pendente/);
});
test('A withdrawn dependent report invalidates the saved aggregate and the research bundle',async()=>{
  const publicId=randomUUID();const [s]=await sql<{id:number}[]>`INSERT INTO stories(public_id,title,first_report_at,latest_at) VALUES (${publicId},${'Evento '+tag},now(),now()) RETURNING id`;
  const [f]=await sql<{id:number}[]>`INSERT INTO facts(public_id,story_id,title) VALUES (${randomUUID()},${s!.id},${'Fato '+tag}) RETURNING id`;
  const a=await makeArticle('Fonte primária '+tag,medical.angle,s!.id,f!.id);
  const b=await makeArticle('Cobertura '+tag,medical.angle,s!.id,f!.id);
  await composeRadar('ondemand');assert.ok((await readRadarSnapshot('ondemand'))!.entries.some(e=>e.storyId===publicId&&e.reportCount===2));
  assert.equal((await researchBundle(publicId))?.reports.length,2);
  await setVisibility(b,{visibility:'withdrawn',version:0,reason:'test'},'test');
  assert.ok(!(await readRadarSnapshot('ondemand'))!.entries.some(e=>e.storyId===publicId));
  assert.deepEqual((await researchBundle(publicId))?.reports.map(r=>r.id),[a]);
});
test('Saved radar rejects a stale medical body and immediately removes a withdrawn item',async()=>{
  const id=await makeArticle('WITHDRAW-'+tag);await composeRadar('ondemand');
  assert.ok((await readRadarSnapshot('ondemand'))!.entries.some(e=>e.id===id));
  await sql`UPDATE articles SET body_text='Corrected private body' WHERE id=${id}`;
  assert.ok(!(await readRadarSnapshot('ondemand'))!.entries.some(e=>e.id===id));
  assert.equal((await loadRadar()).entries.find(e=>e.id===id)?.analysis,null);
  await setVisibility(id,{visibility:'withdrawn',version:0,reason:'test'},'test');
  assert.ok(!(await loadRadar()).entries.some(e=>e.id===id));
});
test('08/20 calendars are persisted idempotently and missing morning is explicit',async()=>{
  const date='2020-02-17',now=localInstant(date,21);
  const m=await composeRadar('08',{now});assert.equal(m.id,(await composeRadar('08',{now})).id);
  const morning=(await readRadarSnapshot('08',date))!;assert.equal(morning.windowStart,localInstant('2020-02-16',20).toISOString());
  await composeRadar('20',{now});const evening=(await readRadarSnapshot('20',date))!;
  assert.equal(evening.windowStart,localInstant(date,8).toISOString());assert.equal(evening.baselineStatus,'AVAILABLE');
  assert.equal(compareWithMorning(evening,null).baselineStatus,'MISSING');
  await assert.rejects(composeRadar('20',{now:localInstant('2020-02-18',10)}),/future/);
  await assert.rejects(composeRadar('ondemand',{hours:-1}),/positive/);
});
test('MCP adds radar and medical research while preserving original tools',async()=>{
  const address=await app.listen({host:'127.0.0.1',port:0});
  const client=new Client({name:'ophthalmology-test',version:'1'});
  try{await client.connect(new StreamableHTTPClientTransport(new URL(address+'/api/mcp')));
    const names=(await client.listTools()).tools.map(t=>t.name);for(const name of Object.values(MCP_TOOL_NAMES))assert.ok(names.includes(name),name);
    const result=await client.callTool({name:MCP_TOOL_NAMES.radar,arguments:{}});assert.ok(!result.isError);assert.ok(!JSON.stringify(result).includes('PRIVATE BODY'));
    const topics=await client.callTool({name:MCP_TOOL_NAMES.editorialTopics,arguments:{memoryDays:30}});assert.ok(!topics.isError);
  }finally{await client.close();}
});
test('Collection/scout/model-off switches prevent external provider calls',async()=>{
  const prior=config.modelCallsEnabled;config.modelCallsEnabled=false;
  try{assert.equal((await enrichPendingMedical()).disabled,true);assert.equal((await runScout()).disabled,true);}finally{config.modelCallsEnabled=prior;}
  assert.equal(await researchBundle(randomUUID()),null);
});
