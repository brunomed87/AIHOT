// Limites de seleção. Critérios em prompts/selection-score.md; aqui define-se a nota mínima.
// Duas pontuações independentes de zero a cem; soma deve atingir duas vezes o limite. Cartão mostra média.
// Limites por classe: menores para oficiais diretas, maiores para imprensa e pessoas. Ao mudar limite ou instrução,
// reexecute scripts/eval-selection.ts com amostras próprias antes de publicar, conforme docs/selection.md.

export const SELECTION = {
  /** Classe da fonte e limite médio. T1 oficial direta, T1_5 conta oficial ou criador próximo, T2 imprensa e pessoas. EXCLUDE_MP e classes ausentes não selecionam, apenas aparecem nas notícias gerais. */
  thresholds: { T1: 60, T1_5: 65, T2: 76 } as Record<string, number>,
  /** Não selecionados acima deste limite usam redação completa: título, resumo, justificativa e marcadores. Demais usam tradução resumida mais barata. */
  understandFloor: 50,
} as const;
