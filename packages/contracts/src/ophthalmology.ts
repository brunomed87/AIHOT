export type Dimension = 'medicalEvidence' | 'publicInterest' | 'ophthalmologyRelevance' | 'editorialNovelty'
  | 'momentum' | 'patientUsefulness' | 'reelPotential' | 'carouselPotential' | 'curiosity' | 'factCheckPotential' | 'authorityPositioning';
export interface PrimarySource {
  url: string; title: string | null; institution: string | null; date: string | null; type: string;
  doi: string | null; pmid: string | null; trialId: string | null; regulatoryId: string | null;
  status: 'LOCATED' | 'CANDIDATE';
}
export interface MedicalAnalysis {
  editorialTitle: string; topicKeys: string[]; angle: string; specialties: string[]; classifications: string[];
  dimensions: Record<Dimension, number | null>;
  whyNow: string; publicInterest: string; patientUsefulness: string; hooks: string[]; medicalPoints: string[];
  evidence: {
    categories: string[]; stage: string | null; design: string | null; population: string | null;
    humans: boolean | null; prospective: boolean | null; interventional: boolean | null; randomized: boolean | null;
    sampleSize: number | null; control: string | null; endpoint: string | null; duration: string | null;
    effectSize: string | null; absoluteRisk: string | null; limitations: string[]; generalizability: string | null;
    conflicts: string | null; funding: string | null; regulatoryStatus: string | null;
    availableInBrazil: boolean | null; investigational: boolean | null; topline: boolean | null;
    conferenceOnly: boolean | null; preprint: boolean | null; peerReviewed: boolean | null;
  };
  primarySources: PrimarySource[]; primarySourceStatus: 'LOCATED' | 'NOT_LOCATED';
  claimChecks: Array<{ code: string; status: 'FLAG' | 'NEEDS_REVIEW'; explanation: string; evidenceQuote: string }>;
  sensationalism: string; confidence: number; qualityAssessment: string;
}
export interface RadarEntry {
  id: string; storyId: string | null; title: string; originalTitle: string; originalUrl: string;
  source: string; sourceId: string; publishedAt: string|null; discoveredAt?:string; publicationRevision: number;
  summary: string | null; attentionScore: number | null; heat: number; trend: string;
  trendPct: number | null; observationComplete: boolean; independentSources: number; reportCount: number;
  sourceCount: number; signalCount: number; editorialIndex: number | null; analysis: MedicalAnalysis | null;
  saturation: 'LOW' | 'MODERATE' | 'HIGH' | 'SATURATED'; saturationValue: number;
  momentum: string; trajectory: string; classification: string; delta: string | null;
  /** Public provenance, also used to invalidate saved aggregate evidence after a correction. */
  dependencies?: Array<{id:string;revision:number;inputHash:string}>;
}
export interface EditorialTopic {
  key: string; firstDetected: string; latest: string; eventCount: number; reportCount: number;
  independentSources: number; aggregateHeat: number; radarCount: number; topCount: number; reelCount: number;
  recommendedAngles: string[]; usedAngles: string[]; saturation: RadarEntry['saturation']; saturationValue: number;
}
export interface RadarResponse {
  schemaVersion: 1; slot: string; date: string; capturedAt: string; windowStart: string; windowEnd: string;
  timezone: string; memoryDays: number; baselineStatus: 'AVAILABLE' | 'MISSING' | 'NOT_APPLICABLE';
  entries: RadarEntry[]; topics: EditorialTopic[];
}
