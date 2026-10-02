// Reader-facing leaderboard vocabulary: evaluation sources, board copy, score formats and brand marks.
// Scoring weights and eligibility never come from here; they come from the computation run.
import type { LeaderboardBoardKey } from "@aihot/contracts/taxonomy";
import type { LbBrand, LbScoreFormat, LbSourceStatus } from "@aihot/contracts/leaderboard";
import registryData from "./source-registry.json" with { type: "json" };
import { SITE } from "@aihot/industry/site";

export interface RegistrySource {
  key: string;
  status: LbSourceStatus;
  name: string;
  fullName?: string;
  operator: string;
  area?: string;
  description: string;
  logo: string | null;
  officialUrl: string | null;
  what: string;
  usage: string;
  limits: string;
  license: string;
  attribution?: string;
  components?: { note: string; label: string };
  /** Reference sources that keep every system row instead of one representative per model. */
  allRows?: boolean;
}

export interface RegistryGroup {
  key: string;
  name: string;
  blurb: string;
  sources: RegistrySource[];
}

export const SOURCE_GROUPS = registryData.groups as RegistryGroup[];

const byKey = new Map<string, { source: RegistrySource; group: RegistryGroup }>();
for (const group of SOURCE_GROUPS) for (const source of group.sources) byKey.set(source.key, { source, group });

export function registrySource(key: string) {
  return byKey.get(key) ?? null;
}

/** Signal units carry a metric suffix for multi-metric sources ("artificial-analysis:intelligence"). */
export function sourceKeyOfUnit(unit: string): string {
  return unit.split(":")[0]!;
}

export interface BoardCopy {
  key: LeaderboardBoardKey;
  name: string;
  title: string;
  description: string;
  howToRead: string;
}

const GENERAL_READING = "Reúne avaliações públicas; cada modelo tem cobertura diferente.";

export const BOARD_COPY: Record<LeaderboardBoardKey, BoardCopy> = {
  overall: {
    key: "overall",
    name: "síntese",
    title: `${SITE.name} Ranking de modelos de linguagem`,
    description: "Avaliações reais de diferentes capacidades para comparar o desempenho geral.",
    howToRead: GENERAL_READING,
  },
  coding: {
    key: "coding",
    name: "Programação",
    title: `Ranking de modelos de programação · ${SITE.name}`,
    description: "Da escrita de código à alteração de repositórios: capacidade de produzir software.",
    howToRead: GENERAL_READING,
  },
  reasoning: {
    key: "reasoning",
    name: "Raciocínio",
    title: `Ranking de modelos de raciocínio · ${SITE.name}`,
    description: "Matemática, lógica e regras desconhecidas para avaliar problemas novos.",
    howToRead: GENERAL_READING,
  },
  knowledge: {
    key: "knowledge",
    name: "Conhecimento",
    title: `Ranking de modelos de conhecimento · ${SITE.name}`,
    description: "Perguntas factuais e conhecimento científico de pós-graduação para avaliar domínio e precisão.",
    howToRead: "O ranking de conhecimento utiliza duas avaliações do Epoch, da mesma instituição.",
  },
  professional: {
    key: "professional",
    name: "Trabalho profissional",
    title: `Ranking de modelos de trabalho profissional · ${SITE.name}`,
    description: "Análise financeira, consultoria jurídica e operações bancárias para avaliar tarefas profissionais.",
    howToRead: "A cobertura atual inclui análise financeira, consultoria e operações bancárias; não representa todas as tarefas com documentos, planilhas ou apresentações.",
  },
};

export const BOARD_LIMIT = 30;

// How each source publishes its numbers: already in percent, a 0–1 fraction, or a plain score.
const PERCENT_SOURCES = new Set(["livebench-general", "livebench-coding", "livebench-reasoning", "livebench-writing", "mercor-apex-agents", "vals-finance-agent", "tau-banking"]);
const PLAIN_SOURCES = new Set(["artificial-analysis", "artificial-analysis-multilingual", "arena-text", "arena-webdev", "arena-vision", "arena-creative-writing", "eq-creative", "eq-longform", "eq-emotional-v4"]);

export function scoreFormat(sourceKey: string, sample?: number | null): LbScoreFormat {
  if (PERCENT_SOURCES.has(sourceKey)) return "percent";
  if (PLAIN_SOURCES.has(sourceKey)) return "number";
  return sample != null && Math.abs(sample) <= 1 ? "fraction" : "number";
}

const grouping = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export function formatScore(value: number | null | undefined, format: LbScoreFormat): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (format === "fraction") return `${(value * 100).toFixed(1)}%`;
  if (format === "percent") return `${value.toFixed(1)}%`;
  return grouping.format(value);
}

// Model-family marks win over company marks: a Qwen mark identifies Qwen, not Alibaba.
const FAMILY_MARKS: Array<[RegExp, string]> = [
  [/^claude/, "anthropic.svg"],
  [/^(gemini|gemma)/, "google.svg"],
  [/^(qwen|qwq)/, "qianwen.svg"],
  [/^kimi/, "moonshot.svg"],
  [/^grok/, "xai.svg"],
  [/^deepseek/, "deepseek.svg"],
  [/^(hy-|hunyuan)/, "tencent.svg"],
  [/^(seed|doubao)/, "bytedance.svg"],
  [/^(glm|chatglm)/, "z-ai.svg"],
];

const PROVIDER_MARKS: Record<string, string> = {
  openai: "openai.svg",
  meta: "meta.svg",
  minimax: "minimax.svg",
  mistral: "mistral.svg",
  nvidia: "nvidia.svg",
  "z-ai": "z-ai.svg",
};

export function modelBrand(slug: string, providerSlug: string | null, provider: string | null, name: string): LbBrand {
  const family = FAMILY_MARKS.find(([re]) => re.test(slug))?.[1];
  const file = family ?? (providerSlug ? PROVIDER_MARKS[providerSlug] : undefined);
  const label = (provider && provider !== "Outros" ? provider : name).replace(/[^\p{L}\p{N}]/gu, "");
  return { src: file ? `/model-providers/${file}` : null, monogram: label.slice(0, 1).toUpperCase() || "?", raster: false };
}

// eqbench.svg and livebench.png carry raster artwork; they get a plate in dark mode.
const RASTER_SOURCE_MARKS = new Set(["eqbench.svg", "livebench.png", "sierra.png", "agents-last-exam.svg", "llm2014.svg"]);

export function sourceBrand(source: RegistrySource): LbBrand {
  return {
    src: source.logo ? `/leaderboard-sources/${source.logo}` : null,
    monogram: source.operator.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 1).toUpperCase() || "?",
    raster: source.logo ? RASTER_SOURCE_MARKS.has(source.logo) : false,
  };
}
