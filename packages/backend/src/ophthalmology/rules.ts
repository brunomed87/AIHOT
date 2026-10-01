import { createHash } from 'node:crypto';
import type { MedicalAnalysis, RadarEntry } from '@aihot/contracts/ophthalmology';
import { OPHTHALMOLOGY as P } from '@aihot/industry/ophthalmology';

export function localDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: P.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
// Resolve the IANA offset at the requested date, rather than hard-coding UTC-3.
export function localInstant(date: string, hour: number): Date {
  const desired = Date.parse(`${date}T${String(hour).padStart(2,'0')}:00:00Z`);
  let guess = desired;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: P.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(guess));
    const val = (key: string) => parts.find(p => p.type === key)!.value;
    const shown = Date.parse(`${val('year')}-${val('month')}-${val('day')}T${val('hour')}:${val('minute')}:${val('second')}Z`);
    guess += desired - shown;
  }
  return new Date(guess);
}
export function saturation(value: number): RadarEntry['saturation'] {
  return value >= P.saturation.saturated ? 'SATURATED' : value >= P.saturation.high ? 'HIGH' : value >= P.saturation.moderate ? 'MODERATE' : 'LOW';
}
export function editorialIndex(a: MedicalAnalysis, attention: number | null, saturationValue: number): number | null {
  const values: Record<string, number | null> = { ...a.dimensions, attention };
  let score = 0, weight = 0;
  for (const [key,w] of Object.entries(P.weights)) {
    const v = values[key];
    if (v !== null && v !== undefined && Number.isFinite(v)) { score += Math.min(100,Math.max(0,v))*w; weight += w; }
  }
  if (!weight) return null;
  const priority = Math.max(1,...a.specialties.map(s => P.priorities[s] ?? 1));
  return Math.round(Math.max(0, Math.min(100, score/weight*priority - Math.min(P.saturation.maximumPenalty,saturationValue))));
}
export function momentum(heat: number, pct: number | null, participants: number): string {
  return participants <= 1 ? 'ISOLATED' : (pct ?? 0) >= 50 ? 'ACCELERATING' : heat >= 50 ? 'STRONG_REPERCUSSION' : 'MOVING';
}
export function eveningDelta(current: RadarEntry, morning: RadarEntry | undefined, morningAt: string): string {
  if (!morning) return current.publishedAt && Date.parse(current.publishedAt) >= Date.parse(morningAt) ? 'NEW_AFTER_08' : 'NEWLY_DISCOVERED';
  if (!current.observationComplete || !morning.observationComplete) return 'UNKNOWN';
  if (current.reportCount > morning.reportCount && current.analysis?.angle !== morning.analysis?.angle) return 'IMPORTANT_UPDATE';
  const pct = morning.heat > 0 ? (current.heat-morning.heat)/morning.heat : current.heat > 0 ? 1 : 0;
  return pct >= .5 ? 'SURGED' : pct > .1 ? 'GAINED_MOMENTUM' : pct < -.1 ? 'LOST_MOMENTUM' : 'STABLE';
}
export function normalizedFingerprint(text: string): string | null {
  const clean = text.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  return clean.length >= 400 ? createHash('sha256').update(clean).digest('hex') : null;
}
export function independentKey(source: { id: string; owner: string | null; group: string | null }, text: string, author: string | null): string {
  const agency = `${author ?? ''} ${text.slice(0,300)}`.match(/folhapress|ag[êe]ncia estado|ag[êe]ncia brasil|reuters|associated press/i)?.[0]?.toLowerCase();
  return source.group ? `group:${source.group}` : agency ? `agency:${agency}` : normalizedFingerprint(text) ? `text:${normalizedFingerprint(text)}` : source.owner ? `owner:${source.owner}` : `source:${source.id}`;
}
export function independentCount(reports:Array<{id:string;owner:string|null;group:string|null;text:string;author:string|null}>):number {
  const parents=reports.map((_,i)=>i), keys=new Map<string,number>();
  const root=(i:number):number=>parents[i]===i ? i : (parents[i]=root(parents[i]!));
  reports.forEach((r,i)=>{
    const agency=`${r.author ?? ''} ${r.text.slice(0,300)}`.match(/folhapress|ag[êe]ncia estado|ag[êe]ncia brasil|reuters|associated press/i)?.[0]?.toLowerCase();
    const fingerprint=normalizedFingerprint(r.text);
    for(const key of [`source:${r.id}`,r.owner?`owner:${r.owner}`:null,r.group?`group:${r.group}`:null,agency?`agency:${agency}`:null,fingerprint?`text:${fingerprint}`:null].filter((k):k is string=>!!k)) {
      const previous=keys.get(key);if(previous!==undefined)parents[root(i)]=root(previous);else keys.set(key,i);
    }
  });
  return new Set(parents.map((_,i)=>root(i))).size;
}
// Findings are review flags, never an automatic medical verdict.
export function claimFlags(title: string, body: string): MedicalAnalysis['claimChecks'] {
  const out: MedicalAnalysis['claimChecks'] = [];
  const add = (code: string, explanation: string, quote: string) => out.push({ code, status: 'NEEDS_REVIEW', explanation, evidenceQuote: quote.slice(0,300) });
  if (sensationalism(title,body)==='POTENTIALLY_EXAGGERATED') add('SENSATIONAL_HEADLINE','Conferir a promessa do título com a evidência primária antes de comunicar benefício.',title);
  if (/causa|provoca|causes|cures|cura/i.test(title) && /associa[çc][aã]o|associat|observacion|correla/i.test(body)) add('ASSOCIATION_CAUSALITY','O título sugere causalidade; verificar se o desenho permite essa conclusão.',title);
  if (/camundong|mice|mouse|animal|preclinical|pré-clínic/i.test(body)) add('PRECLINICAL','Resultado pré-clínico não estabelece benefício em humanos.',body.match(/.{0,60}(?:camundong|mice|animal|preclinical|pré-clínic).{0,100}/i)?.[0] ?? '');
  if (/relato de caso|case report/i.test(body)) add('CASE_REPORT','Um caso não determina incidência.',body.match(/.{0,30}(?:relato de caso|case report).{0,60}/i)?.[0] ?? '');
  if (/notifica[çc][aã]o|pharmacovigilance|farmacovigil[aâ]ncia/i.test(body)) add('PHARMACOVIGILANCE','Notificação não confirma causalidade.',title);
  if (/topline|top-line/i.test(body)) add('COMPANY_TOPLINE','Topline de empresa não equivale a artigo revisado por pares.',title);
  if (/abstract|resumo de congresso|apresenta[çc][aã]o.*congresso/i.test(body)) add('CONFERENCE','Identificar o estágio de congresso e verificar publicação completa.',title);
  for (const match of body.matchAll(/(\d+)\s*\/\s*(\d+)\s*(?:\([^)]*?)?\s*(\d+(?:[.,]\d+)?)\s*%/g)) {
    const n=Number(match[1]), d=Number(match[2]), pct=Number(match[3]!.replace(',','.'));
    if (d > 0 && Math.abs(n/d*100-pct) > 1) add('DENOMINATOR_MISMATCH','Percentual incompatível com a fração apresentada.',match[0]);
  }
  if (/subgrupo|subgroup/i.test(body) && /todas|todos|all patients|all women/i.test(title)) add('POPULATION_EXTRAPOLATION','O título pode extrapolar um subgrupo.',title);
  if (/risco relativo|relative risk|hazard ratio/i.test(body) && !/risco absoluto|absolute risk/i.test(body)) add('RELATIVE_WITHOUT_ABSOLUTE','Localizar denominador e risco absoluto antes de comunicar magnitude.',title);
  return out;
}
export function sensationalism(title: string, body: string): string {
  if (/milagre|cura da cegueira|fim dos [óo]culos|nunca mais.*[óo]culos|solu[çc][aã]o definitiva|miracle|cure.*blindness/i.test(title)) return 'POTENTIALLY_EXAGGERATED';
  if (/patrocinad|compre|agende agora|sponsored/i.test(body)) return 'PROMOTIONAL';
  return 'INSUFFICIENT_EVIDENCE';
}
