// Share images (1200×630 PNG) for pages, items, reports, topics and events. Only public content
// gets a card; anything else is a real 404.
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { CATEGORY_LABELS } from "@aihot/contracts/taxonomy";
import { beijingDate } from "@aihot/contracts/time";
import { loadItemShare } from "@aihot/backend/publication/og";
import { loadReport, type ReportKind } from "@aihot/backend/publication/reports";
import { loadTopic } from "@aihot/backend/publication/topics";
import { loadStoryDetail, resolveStory } from "@aihot/backend/publication/stories";
import { SITE, withSubject } from "@aihot/industry/site";
import { FEATURES } from "@aihot/industry/features";
import { config } from "@aihot/backend/config";
import { ogEtag, renderOg, type OgCard } from "../og/render.ts";
import { posterEtag, renderPoster, type Poster } from "../og/poster.ts";

const S = SITE.subject;
const PAGES: Record<string, OgCard> = {
  site: { kicker: SITE.name, title: SITE.tagline, subtitle: SITE.description },
  all: { kicker: `Todos${withSubject("notícias")}`, title: "Notícias recentes de todas as fontes em um só lugar", subtitle: "Notícias recentes por horário, com filtros por categoria e marcadores." },
  hot: { kicker: "Mais discutidos", title: `O que está sendo discutido nas últimas 48 horas`, subtitle: "Índice de repercussão, tendência e fontes públicas participantes.", accent: "hot" },
  daily: { kicker: withSubject("Relatório diário"), title: `Todos os dias às 08h, uma edição para acompanhar${withSubject("Relatório diário")}`, subtitle: `Destaques do dia anterior sobre${S}.` },
  weekly: { kicker: withSubject("Relatório semanal"), title: "Acontecimentos da semana em uma visão", subtitle: "Temas centrais, lançamentos importantes e discussões da semana." },
  monthly: { kicker: withSubject("Relatório mensal"), title: "Mudanças do mês", subtitle: "Retrospectiva dos principais temas e acontecimentos mensais." },
  topics: { kicker: "Temas", title: "Temas acompanhados continuamente", subtitle: "Empresas, instituições, áreas temáticas e tipos de conteúdo." },
  leaderboard: { kicker: "Ranking de modelos de IA", title: "Ranking de consenso de avaliações públicas", subtitle: "Geral, programação, raciocínio, conhecimento e trabalho profissional; ausências não valem zero e preços não alteram posições." },
  "codex-reset": { kicker: "Monitor de reinícios de Tibo", title: "Quando o reinício de limites do Codex entra em vigor", subtitle: "Janela estimada em Pequim, abrangência e declarações de Tibo.", accent: "amber" },
  about: { kicker: "Sobre", title: `Sobre ${SITE.name}`, subtitle: SITE.description },
  terms: { kicker: "Regras de uso", title: `${SITE.name} Regras de uso`, subtitle: "Regras de uso do site, API, RSS e MCP." },
  privacy: { kicker: "Privacidade", title: `${SITE.name} Privacidade`, subtitle: "Tratamento de registros de acesso, dados locais do navegador e feedback." },
  changelog: { kicker: "Histórico de mudanças", title: `${SITE.name} Histórico de mudanças`, subtitle: "Histórico de funções, melhorias, avisos e descontinuações." },
  feedback: { kicker: "Feedback", title: "Informe o que podemos melhorar", subtitle: "Conteúdo, funções, integração ou pedidos de correção e retirada das fontes." },
  agent: { kicker: "Integração com agentes", title: `Permita que agentes consultem ${SITE.name}`, subtitle: "MCP, RSS e API REST v1, com leitura anônima." },
};

/**
 * Article share images carry the title and summary, so shared caches keep them for an hour at most:
 * after a withdrawal or a correction they are gone from any cache within the hour.
 */
export const ARTICLE_IMAGE_CACHE = "public, max-age=3600, s-maxage=3600, stale-while-revalidate=600";
const ARTICLE_IMAGE_ORIGIN_SECONDS = "300";

async function send(req: FastifyRequest, reply: FastifyReply, card: OgCard, maxAge: number, cacheControl = `public, max-age=${maxAge}, s-maxage=${maxAge * 7}, stale-while-revalidate=86400`) {
  const tag = `"og-${ogEtag(card)}"`;
  reply.header("ETag", tag).header("Cache-Control", cacheControl);
  if (String(req.headers["if-none-match"] ?? "").split(",").some((t) => t.trim().replace(/^W\//, "") === tag)) return reply.code(304).send();
  return reply.type("image/png").send((await renderOg(card)).png);
}

function notFound(reply: FastifyReply) {
  return reply.code(404).header("Cache-Control", "public, max-age=300").type("text/plain; charset=utf-8").send("Não encontrado");
}

const REPORT_NAMES: Record<ReportKind, string> = { daily: withSubject("Relatório diário"), weekly: withSubject("Relatório semanal"), monthly: withSubject("Relatório mensal") };

export function registerOg(app: FastifyInstance) {
  app.get("/og/site.png", (req, reply) => send(req, reply, PAGES.site!, 86400));

  app.get("/og/pages/:file", async (req, reply) => {
    const name = (req.params as { file: string }).file.replace(/\.png$/, "");
    const card = PAGES[name];
    if ((name === "leaderboard" && !FEATURES.leaderboard) || (name === "codex-reset" && !FEATURES.codexResetMonitor)) return notFound(reply);
    if (!card || !(req.params as { file: string }).file.endsWith(".png")) return notFound(reply);
    return send(req, reply, card, 86400);
  });

  app.get("/og/items/:file", async (req, reply) => {
    const file = (req.params as { file: string }).file;
    if (!file.endsWith(".png")) return notFound(reply);
    const d = await loadItemShare(file.slice(0, -4));
    if (!d) return notFound(reply);
    reply.header("X-Accel-Expires", ARTICLE_IMAGE_ORIGIN_SECONDS);
    return send(req, reply, {
      kicker: d.category ? CATEGORY_LABELS[d.category] : withSubject("notícias"),
      title: d.title,
      subtitle: d.summary,
      meta: `${d.source.name.replace(/（[^）]*）\s*$/, "")} · ${beijingDate(d.timelineAt)}`,
      badge: d.selected && d.score !== null ? { value: String(Math.round(d.score)), label: "Pontuação de seleção" } : null,
    }, 3600, ARTICLE_IMAGE_CACHE);
  });

  // Phone share poster for an article (1080×1440), generated on first request and cached by content.
  app.get("/og/posters/:file", async (req, reply) => {
    const file = (req.params as { file: string }).file;
    if (!file.endsWith(".png")) return notFound(reply);
    const d = await loadItemShare(file.slice(0, -4));
    if (!d) return notFound(reply);
    const poster: Poster = {
      url: `${config.siteUrl}/items/${d.id}`,
      kicker: d.category ? CATEGORY_LABELS[d.category] : withSubject("notícias"),
      title: d.title,
      summary: d.summary,
      source: d.source.name.replace(/（[^）]*）\s*$/, ""),
      date: beijingDate(d.timelineAt),
      score: d.selected ? d.score : null,
    };
    const tag = `"poster-${posterEtag(poster)}"`;
    reply.header("ETag", tag).header("Cache-Control", ARTICLE_IMAGE_CACHE).header("X-Accel-Expires", ARTICLE_IMAGE_ORIGIN_SECONDS);
    if (String(req.headers["if-none-match"] ?? "").split(",").some((t) => t.trim().replace(/^W\//, "") === tag)) return reply.code(304).send();
    return reply.type("image/png").send((await renderPoster(poster)).png);
  });

  app.get("/og/reports/:kind/:file", async (req, reply) => {
    const { kind, file } = req.params as { kind: string; file: string };
    if (!["daily", "weekly", "monthly"].includes(kind) || !file.endsWith(".png")) return notFound(reply);
    const r = await loadReport(kind as ReportKind, file.slice(0, -4));
    if (!r) return notFound(reply);
    return send(req, reply, {
      kicker: `${REPORT_NAMES[r.kind]} · ${r.key}`,
      title: r.lead?.title ?? r.title,
      subtitle: r.lead?.leadParagraph ?? r.overview,
      meta: `${r.stories.length} notícias principais · cerca de ${r.readingMinutes} minutos de leitura`,
    }, 86400);
  });

  app.get("/og/topics/:file", async (req, reply) => {
    const file = (req.params as { file: string }).file;
    const t = file.endsWith(".png") ? await loadTopic(file.slice(0, -4)) : null;
    if (!t) return notFound(reply);
    return send(req, reply, { kicker: "Temas", title: t.name, subtitle: t.definition }, 86400);
  });

  app.get("/og/stories/:file", async (req, reply) => {
    const file = (req.params as { file: string }).file;
    if (!file.endsWith(".png")) return notFound(reply);
    const found = await resolveStory(file.slice(0, -4));
    if (found.kind !== "found") return notFound(reply);
    const s = await loadStoryDetail(found.storyId);
    if (!s) return notFound(reply);
    reply.header("X-Accel-Expires", ARTICLE_IMAGE_ORIGIN_SECONDS);
    return send(req, reply, {
      kicker: s.whyHot.rank ? `Posição por repercussão: ${s.whyHot.rank} · acontecimento` : "Acontecimento",
      title: s.title,
      subtitle: s.latest ?? s.digest,
      meta: `${s.sourceCount} fontes · ${s.reportCount} reportagens`,
      accent: s.whyHot.rank ? "hot" : "teal",
    }, 3600, ARTICLE_IMAGE_CACHE);
  });
}
