// Configurations (reasoning tiers) and the fixed selection priority published on the rules page:
// the representative row of a model is its highest first-party tier; the choice never looks at scores.
// Hybrid or fallback runs and pre-release builds are kept for reference but cannot represent a model.

export type ConfigurationKind = "FIRST_PARTY" | "SOURCE_DEFAULT" | "SCAFFOLDED";

export interface Configuration {
  key: string;
  label: string;
  kind: ConfigurationKind;
  /** The stored priority (scaffolded systems are stored as 0). */
  priority: number;
  /** Ordering used to choose the representative row; any first-party or default row ranks above a scaffolded system. */
  rank: number;
  /** Why the row can never be the representative one, if so. */
  ineligible: string | null;
}

export const REASONS = {
  firstParty: "Usa o maior nível oficial de raciocínio disponível segundo uma regra prévia fixa, sem considerar a nota obtida.",
  sourceDefault: "A fonte não distingue níveis de raciocínio; usa sua configuração oficial padrão.",
  lowerPriority: "Configuração preservada para revisão, mas com prioridade fixa menor que a representativa deste indicador.",
  scaffoldedSelected: "A fonte usa o mesmo sistema controlado para todos os modelos. A seleção segue prioridade prévia de raciocínio; detalhes são preservados e o resultado atribuído ao modelo-base.",
  scaffoldedLower: "Configuração preservada para revisão, com prioridade menor que o sistema escolhido para este indicador.",
  hybrid: "Configuração mistura modelos ou usa redirecionamento e não representa um único modelo.",
  preRelease: "A fonte identifica uma versão anterior ao lançamento, sem representar o modelo oficialmente disponível.",
  special: "Sistema específico ou execução não verificada, sem atribuição segura a um único modelo público.",
  cloaked: "Identificador de teste anônimo, sem correspondência a uma versão pública fixa.",
} as const;

const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Tokens that describe how a model was run (as opposed to dates, channels or editions). */
const CONFIG_TOKEN = /^(reasoning|non-reasoning|thinking|non-thinking|adaptive-reasoning|(x?high|medium|low|max|minimal)(-effort)?|thinking-(\d+k|minimal)|high-\d+k|default-fallback|.+-fallback|\d+|\d+-\d+)$/;

const TIERS: Array<[RegExp, number, string]> = [
  [/^max(-effort)?$/, 600, "Raciocínio máximo"],
  [/^xhigh(-effort)?$/, 550, "Raciocínio muito alto"],
  [/^high(-effort|-\d+k)?$/, 500, "Raciocínio alto"],
  [/^medium(-effort)?$/, 300, "Raciocínio médio"],
  [/^low(-effort)?$/, 200, "Raciocínio baixo"],
  [/^minimal$/, 100, "Raciocínio mínimo"],
];

/**
 * Builds the configuration from the run descriptors a source gives (e.g. "(Adaptive Reasoning, High
 * Effort)"). Effort tiers win over reasoning / non-reasoning; adaptive reasoning ranks just above the
 * same tier; a fallback run ranks just below it and is not a single model.
 */
export function configurationOf(descriptors: string[], opts: { defaultKind?: ConfigurationKind; numericTokens?: boolean } = {}): Configuration {
  const tokens = new Set<string>();
  for (const d of descriptors) {
    for (const part of d.split(/\s*,\s*/)) {
      const t = slug(part);
      // Bare numbers are run settings only where a source uses them that way (e.g. "_1" suffixes), not versions like "(0902)".
      if (t && CONFIG_TOKEN.test(t) && (opts.numericTokens || !/^\d+(-\d+)?$/.test(t))) tokens.add(t);
    }
  }
  // "thinking-minimal" style descriptors also name their tier.
  for (const t of [...tokens]) {
    const m = /^thinking-(minimal|low|medium|high)$/.exec(t);
    if (m) tokens.add(m[1]!);
  }
  // Adaptive runs also carry their bare tier (high/xhigh/medium/low; "max effort" stays as is).
  if (tokens.has("adaptive-reasoning")) {
    for (const t of [...tokens]) {
      const effort = /^(x?high|medium|low)-effort$/.exec(t);
      if (effort) tokens.add(effort[1]!);
    }
  }
  if (!tokens.size) {
    return { key: "source_default:default", label: "Configuração padrão da fonte", kind: opts.defaultKind ?? "SOURCE_DEFAULT", priority: 400, rank: 400, ineligible: null };
  }
  const list = [...tokens].sort();
  const adaptive = tokens.has("adaptive-reasoning");
  const fallback = list.some((t) => t.endsWith("-fallback"));
  let priority = 400;
  let label = "Configuração padrão da fonte";
  for (const [re, p, l] of TIERS) {
    if (list.some((t) => re.test(t))) {
      priority = p;
      label = l;
      break;
    }
  }
  if (priority === 400 && tokens.has("non-reasoning") && list.length === 1) {
    priority = 50;
    label = "Sem raciocínio";
  }
  // Adaptive low/medium runs sit just above the default tier; other adaptive tiers just above their own.
  const adaptiveLow = adaptive && (priority === 300 || priority === 200);
  if (adaptiveLow) priority = 450;
  if (adaptive) priority += 2;
  if (fallback) priority -= 1;
  if (adaptive) label = adaptiveLow ? "Raciocínio adaptativo" : `${label} · adaptativo`;
  const budget = list.map((t) => /^(?:thinking|high)-(\d+k)$/.exec(t)?.[1]).find(Boolean);
  if (budget) label = `${label} · ${budget}`;
  if (fallback) label = `${label} · inclui redirecionamento da fonte`;
  return {
    key: `first_party:${list.join("+")}`,
    label,
    kind: "FIRST_PARTY",
    priority,
    rank: priority,
    ineligible: fallback ? REASONS.hybrid : null,
  };
}

/** Execução em sistema fixo, como codex-harness, representa modelo somente sem linha própria oficial. Rótulo identifica raciocínio ou sistema completo e ambiente informado pela fonte. */
export function scaffolded(base: Configuration, systemTokens: string[], systemLabels: string[]): Configuration {
  const tier = base.key.startsWith("first_party:") ? base.key.slice("first_party:".length).split("+") : [];
  const list = [...tier, ...systemTokens].sort();
  const label = [base.kind === "SOURCE_DEFAULT" ? "Sistema completo" : base.label, ...systemLabels].join(" · ");
  // Keys are capped at 108 characters (system ids can be long); ranked by tier, just below first-party.
  return { key: `scaffolded:${list.join("+")}`.slice(0, 108), label, kind: "SCAFFOLDED", priority: 0, rank: base.priority - 1, ineligible: base.ineligible };
}

/** LiveBench-style suffixes: "-thinking-64k-high-effort" → "high-effort"; "-xhigh" / "-max" only for tiered families. */
export function peelEffortSuffix(name: string): { base: string; tier: string | null } {
  const m = /^(.*?)(?:-thinking(?:-[a-z0-9]+)?)?-((?:x?high|medium|low|max|minimal)-effort)$/i.exec(name);
  if (m) return { base: m[1]!, tier: m[2]!.toLowerCase() };
  return peelTierSuffix(name);
}

/** Families whose names carry reasoning-effort tiers; elsewhere "max" or "medium" is part of the product name (Qwen Max, Mistral Medium). */
const TIERED_FAMILY = /^(claude|gemini|gpt-[5-9]|grok|muse)/i;

/** Peels a trailing tier from a hyphenated name: "gpt-5.4-high" → ["gpt-5.4", "high"]; "…-high-32k" → ["…", "high-32k"]. */
export function peelTierSuffix(name: string): { base: string; tier: string | null } {
  const m = /^(.*?)-((?:x?high|medium|low|minimal|max)(?:-\d+k)?)$/i.exec(name);
  return m && TIERED_FAMILY.test(name) ? { base: m[1]!, tier: m[2]!.toLowerCase() } : { base: name, tier: null };
}

/** Splits "GPT-5 (high)" into the base name and its parenthesised descriptors. */
export function splitName(name: string): { base: string; descriptors: string[] } {
  const m = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(name.trim());
  if (!m) return { base: name.trim(), descriptors: [] };
  return { base: m[1]!.trim(), descriptors: [m[2]!] };
}
