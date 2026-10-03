import { z } from 'zod';
import type { MedicalAnalysis } from '@aihot/contracts/ophthalmology';
import { sql } from '../db.ts';
import { config } from '../config.ts';
import { sha256, stableJson } from '../lib/ids.ts';
import { chatJson } from '../providers/llm.ts';
import { completeReceipt } from '../providers/receipts.ts';
import { modelFor } from '../editorial/models.ts';
import { promptText, promptVersion } from '../editorial/prompts.ts';
import { resolvePrimarySources } from './primary.ts';
import { claimFlags } from './rules.ts';
import {canonicalEditorialTopics} from './topics.ts';

const string = z.string().max(2000).nullable().default(null);
const bool = z.boolean().nullable().default(null);
const list = z.array(z.string().max(1000)).default([]);
const score = z.number().min(0).max(100).nullable().default(null);
const topicKey = z.preprocess(value => typeof value==='string' ? value.normalize('NFD').replace(/[\u0300-\u036f]/g,'') : value,
  z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120));
export const MedicalSchema = z.object({
  editorialTitle: z.string().max(300), topicKeys: z.array(topicKey),
  angle: z.string().max(500), specialties: list, classifications: list,
  dimensions: z.object({ medicalEvidence:score,publicInterest:score,ophthalmologyRelevance:score,editorialNovelty:score,momentum:score,
    patientUsefulness:score,reelPotential:score,carouselPotential:score,curiosity:score,factCheckPotential:score,authorityPositioning:score }),
  whyNow: z.string().max(1500), publicInterest: z.string().max(1500), patientUsefulness: z.string().max(1500), hooks:list, medicalPoints:list,
  evidence: z.object({ categories:list,stage:string,design:string,population:string,humans:bool,prospective:bool,interventional:bool,randomized:bool,
    sampleSize:z.number().int().positive().nullable().default(null),control:string,endpoint:string,duration:string,effectSize:string,absoluteRisk:string,
    limitations:list,generalizability:string,conflicts:string,funding:string,regulatoryStatus:string,availableInBrazil:bool,investigational:bool,
    topline:bool,conferenceOnly:bool,preprint:bool,peerReviewed:bool }),
  primarySourceUrls: z.array(z.string().url()).default([]),
  claimChecks: z.array(z.object({ code:z.string().max(100),status:z.enum(['FLAG','NEEDS_REVIEW']),explanation:z.string().max(1500),evidenceQuote:z.string().max(180) })).default([]),
  sensationalism:z.enum(['EVIDENCE_ALIGNED','SIMPLIFIED','POTENTIALLY_EXAGGERATED','MISLEADING','PROMOTIONAL','INSUFFICIENT_EVIDENCE']),
  confidence:z.number().min(0).max(1),qualityAssessment:z.string().max(1500),
});
export const MEDICAL_VERSION=promptVersion('ophthalmology-evidence');
export interface EnrichmentInput { id:string; title:string; originalTitle:string; summary:string|null; body:string|null; html:string|null; revision:number }
export const inputHash = (row:EnrichmentInput) => sha256(stableJson(row));
export async function enrichMedical(row:EnrichmentInput):Promise<{ payload:MedicalAnalysis; receiptId:number }> {
  const [article]=await sql<{url:string}[]>`SELECT url FROM articles WHERE id=${row.id}`;
  const primary=await resolvePrimarySources(`${article?.url ?? ''}\n${row.body ?? ''}\n${row.html ?? ''}`);
  const res=await chatJson({ model:await modelFor('medical'), purpose:'ophthalmology_evidence',subject:`article:${row.id}`,
    promptVersion:MEDICAL_VERSION,system:promptText('ophthalmology-evidence',{responseSchema:JSON.stringify(z.toJSONSchema(MedicalSchema,{io:'output'}))}),
    user: JSON.stringify({ title:row.originalTitle, editorialTitle:row.title,summary:row.summary,body:row.body?.slice(0,25000),primaryCandidates:primary.sources }),
    schema:MedicalSchema,temperature:0,maxTokens:5000 });
  const { primarySourceUrls,...data }=res.data;
  const sources=primary.sources.filter(s => s.status==='LOCATED' || primarySourceUrls.includes(s.url));
  return { payload:{ ...data,topicKeys:canonicalEditorialTopics(data.topicKeys), dimensions:{...data.dimensions,editorialNovelty:null,momentum:null}, primarySources:sources,
    primarySourceStatus:sources.some(s => s.status==='LOCATED') ? 'LOCATED' : 'NOT_LOCATED',
    claimChecks:[...data.claimChecks,...claimFlags(row.originalTitle,row.body ?? '')] }, receiptId:res.receiptId };
}
export async function enrichPendingMedical(limit=50):Promise<{ processed:number; disabled?:boolean }> {
  if (!config.modelCallsEnabled) return { processed:0,disabled:true };
  const rows=await sql<(EnrichmentInput & { existingHash:string|null; existingVersion:string|null })[]>`
    SELECT p.article_id AS id,p.title,a.title AS "originalTitle",p.summary,a.body_text AS body,a.body_html AS html,p.revision,
      oa.input_hash AS "existingHash",oa.version AS "existingVersion"
    FROM publications p JOIN articles a ON a.id=p.article_id JOIN sources s ON s.id=p.source_id
    LEFT JOIN ophthalmology_analyses oa ON oa.article_id=p.article_id
    WHERE s.participation_mode='editorial' AND p.visibility='public'
      AND (oa.article_id IS NULL OR oa.version<>${MEDICAL_VERSION} OR oa.updated_at<p.updated_at OR oa.updated_at<a.updated_at)
    ORDER BY oa.updated_at ASC NULLS FIRST,p.timeline_at DESC LIMIT ${limit}`;
  let processed=0; const failures:string[]=[];
  for (const {existingHash,existingVersion,...row} of rows) {
    const hash=inputHash(row);
    if (hash===existingHash && existingVersion===MEDICAL_VERSION) continue;
    try {
      const result=await enrichMedical(row);
      await sql.begin(async tx => {
        const [current]=await tx<EnrichmentInput[]>`SELECT p.article_id AS id,p.title,a.title AS "originalTitle",p.summary,
          a.body_text AS body,a.body_html AS html,p.revision FROM publications p JOIN articles a ON a.id=p.article_id
          JOIN sources s ON s.id=p.source_id WHERE p.article_id=${row.id} AND p.visibility='public' AND s.participation_mode='editorial' FOR UPDATE OF p`;
        if (!current || inputHash(current)!==hash) { await completeReceipt(tx,result.receiptId); return; }
        await tx`INSERT INTO ophthalmology_analyses(article_id,input_hash,version,payload,receipt_id)
          VALUES (${row.id},${hash},${MEDICAL_VERSION},${tx.json(result.payload as never)},${result.receiptId})
          ON CONFLICT(article_id) DO UPDATE SET input_hash=EXCLUDED.input_hash,version=EXCLUDED.version,payload=EXCLUDED.payload,
          receipt_id=EXCLUDED.receipt_id,updated_at=now()`;
        await tx`DELETE FROM editorial_topic_members WHERE article_id=${row.id}`;
        for (const key of new Set(result.payload.topicKeys)) await tx`INSERT INTO editorial_topic_members(topic_key,article_id,angle,confidence)
          VALUES (${key},${row.id},${result.payload.angle},${result.payload.confidence})`;
        await completeReceipt(tx,result.receiptId); processed++;
      });
    } catch { failures.push(row.id); }
  }
  if (failures.length) throw new Error(`Medical enrichment failed for ${failures.join(',')}; ${processed} processed`);
  return {processed};
}
