import type { PrimarySource } from '@aihot/contracts/ophthalmology';
export interface BibliographicRecord { title: string; doi?: string; id?: string; source?: string; firstPublicationDate?: string; authorString?: string; pubTypeList?: { pubType: string[] } }
export type BibliographicLookup = (query: string) => Promise<BibliographicRecord[]>;
export const europePmcLookup: BibliographicLookup = async query => {
  const url = new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
  url.search = new URLSearchParams({ query, format: 'json', resultType: 'core', pageSize: '10' }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Europe PMC HTTP ${response.status}`);
  const data = await response.json() as { resultList?: { result?: BibliographicRecord[] } };
  return data.resultList?.result ?? [];
};
export function identifiers(text: string) {
  return {
    doi: [...new Set([...text.matchAll(/\b10\.\d{4,9}\/[A-Z0-9._;()/:+-]+/gi)].map(m => m[0].replace(/[.,;)]+$/,'')))],
    pmid: [...new Set([...text.matchAll(/(?:PMID\s*:?\s*|pubmed\.ncbi\.nlm\.nih\.gov\/)(\d{5,10})/gi)].map(m => m[1]!))],
    trial: [...new Set([...text.matchAll(/\bNCT\d{8}\b/gi)].map(m => m[0].toUpperCase()))],
  };
}
// Exact identifier matches only. A URL mentioned in an article remains a candidate until reviewed.
export async function resolvePrimarySources(text: string, lookup: BibliographicLookup = europePmcLookup): Promise<{ status: 'LOCATED' | 'NOT_LOCATED'; sources: PrimarySource[] }> {
  const ids = identifiers(text);
  const sources: PrimarySource[] = [];
  for (const doi of ids.doi) {
    const rows = await lookup(`DOI:"${doi}"`);
    const row = rows.find(r => r.doi?.toLowerCase() === doi.toLowerCase());
    if (row) sources.push({ url: `https://doi.org/${encodeURIComponent(row.doi!).replace(/%2F/gi,'/')}`, title: row.title,
      institution: null, date: row.firstPublicationDate ?? null, type: row.pubTypeList?.pubType.join(', ') ?? 'SCIENTIFIC_RECORD',
      doi: row.doi!, pmid: row.source === 'MED' ? row.id ?? null : null, trialId: null, regulatoryId: null, status: 'LOCATED' });
  }
  for (const pmid of ids.pmid) {
    if (sources.some(s => s.pmid === pmid)) continue;
    const row = (await lookup(`EXT_ID:${pmid} AND SRC:MED`)).find(r => r.id === pmid && r.source === 'MED');
    if (row) sources.push({ url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`, title: row.title, institution: null,
      date: row.firstPublicationDate ?? null, type: row.pubTypeList?.pubType.join(', ') ?? 'SCIENTIFIC_RECORD',
      doi: row.doi ?? null, pmid, trialId: null, regulatoryId: null, status: 'LOCATED' });
  }
  // Registry identifiers are evidence of a citation, not evidence of published trial results.
  for (const trialId of ids.trial) sources.push({ url: `https://clinicaltrials.gov/study/${trialId}`, title: null,
    institution: null, date: null, type: 'CLINICAL_TRIAL_REGISTRY', doi: null, pmid: null, trialId,
    regulatoryId: null, status: 'CANDIDATE' });
  for (const m of text.matchAll(/https?:\/\/[^\s<>"']+/g)) {
    const url=m[0].replace(/[.,;)]+$/,'');
    try {
      const host=new URL(url).hostname;
      if (/(?:^|\.)(?:gov\.br|fda\.gov|ema\.europa\.eu|nei\.nih\.gov|cbo\.net\.br|cbo\.com\.br|cfm\.org\.br|aao\.org)$/.test(host) && !sources.some(s => s.url===url))
        sources.push({ url, title: null, institution: host, date: null, type: 'INSTITUTIONAL_CANDIDATE', doi: null, pmid: null, trialId:null, regulatoryId:null, status:'CANDIDATE' });
    } catch { /* Not a valid URL. */ }
  }
  return { status: sources.some(s => s.status === 'LOCATED') ? 'LOCATED' : 'NOT_LOCATED', sources };
}
