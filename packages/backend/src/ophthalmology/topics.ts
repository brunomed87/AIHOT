// Editorial identities are independent of the core event/occurrence grouping.
// Known aliases stabilize recurring themes; unfamiliar themes remain allowed.
export const EDITORIAL_ALIASES:Record<string,string>={
  'semaglutida-noia':'medicamentos-metabolicos-noia','noia-semaglutida':'medicamentos-metabolicos-noia',
  'glp-1-noia':'medicamentos-metabolicos-noia','semaglutida-naion':'medicamentos-metabolicos-noia',
  'miopia-criancas':'miopia-infantil','miopia-pediatrica':'miopia-infantil',
  'intoxicacao-metanol':'metanol-perda-visual','cegueira-metanol':'metanol-perda-visual',
  'retinopatia-diabetica':'diabetes-retina','diabetes-retinopatia':'diabetes-retina',
};
export function canonicalEditorialTopics(keys:string[]):string[]{return [...new Set(keys.map(k=>EDITORIAL_ALIASES[k] ?? k))];}
