// Módulos opcionais de IA. Para outro setor, defina ambos como false ou remova conforme docs/customize.md.
// Desativação remove navegação e agenda, com páginas e interfaces retornando 404.

export const FEATURES = {
  /** Ranking público de consenso v15 em /leaderboard, com quatro consultas diárias às fontes. */
  leaderboard: true,
  /** Monitor de anúncios de reinício de limites Codex no X, em /codex-reset; exige SocialData. */
  codexResetMonitor: true,
} as const;
