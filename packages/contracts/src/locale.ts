/** Idioma produzido; nomes *_zh dos contratos antigos permanecem compatíveis. */
export const CONTENT_LANGUAGE = 'pt';

/** Reconhecimento conservador; textos incertos passam pela tradução. */
export function looksPortuguese(text: string): boolean {
  if (/\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}/u.test(text)) return false;
  const words = text.toLocaleLowerCase('pt-BR').match(/\p{L}+/gu) ?? [];
  const markers = new Set(['é','são','não','para','uma','das','dos','pela','pelo','com','mais','hoje','ontem','amanhã','lança','lançamento','pesquisa','estudo','saúde','modelo','pacientes','notícias','publicou']);
  return words.filter(word => markers.has(word)).length >= 2;
}

const LABELS: Record<string,string> = {
  LOW:'Baixa', MODERATE:'Moderada', HIGH:'Alta', SATURATED:'Saturado',
  NEW_AFTER_08:'Novo após as 08h', NEW:'Novo', RISING:'Em crescimento', FALLING:'Em queda', STABLE:'Estável',
  INSUFFICIENT:'Dados insuficientes', NEW_EVENT:'Novo acontecimento', KNOWN_EVENT:'Acontecimento conhecido',
  FIRST_SEEN:'Primeira detecção', ACCELERATING:'Acelerando', DECELERATING:'Desacelerando',
  SURGED:'Avanço acentuado', GAINED_MOMENTUM:'Ganhou impulso', LOST_MOMENTUM:'Perdeu impulso',
  ISOLATED:'Isolado', STRONG_REPERCUSSION:'Repercussão forte', MOVING:'Em movimento', UNKNOWN:'Desconhecido',
  NEWLY_DISCOVERED:'Descoberto recentemente', IMPORTANT_UPDATE:'Atualização importante', BASELINE_MISSING:'Edição das 08h indisponível',
  RECURRENT_WITH_NEW_ANGLE:'Recorrente com novo ângulo', FACT_CHECK_OPPORTUNITY:'Oportunidade de checagem', OPPORTUNITY:'Oportunidade editorial',
  EVIDENCE_ALIGNED:'Alinhada à evidência', SIMPLIFIED:'Simplificada', POTENTIALLY_EXAGGERATED:'Potencialmente exagerada',
  MISLEADING:'Enganosa', PROMOTIONAL:'Promocional', INSUFFICIENT_EVIDENCE:'Evidência insuficiente',
  SCIENTIFIC_RECORD:'Registro científico', CLINICAL_TRIAL_REGISTRY:'Registro de ensaio clínico', INSTITUTIONAL_CANDIDATE:'Referência institucional candidata',
  'Journal Article':'Artigo científico', 'Clinical Trial':'Ensaio clínico', 'Randomized Controlled Trial':'Ensaio clínico randomizado',
  Review:'Revisão', 'Systematic Review':'Revisão sistemática', 'Meta-Analysis':'Metanálise', 'Case Reports':'Relatos de caso',
  LOCATED:'Localizada', NOT_LOCATED:'Não localizada', CANDIDATE:'Candidata',
};
export const localizedLabel = (value: string) => LABELS[value] ?? value;
