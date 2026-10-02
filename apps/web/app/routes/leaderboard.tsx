import { SITE, withSubject } from "@aihot/industry/site";
import { Link, data, useLoaderData } from "react-router";
import { useState } from "react";
import type { Route } from "./+types/leaderboard";
import type { LbBoardResponse } from "@aihot/contracts/leaderboard";
import { loadOr404 } from "../lib/api.server";
import { breadcrumbLd, pageMeta, siteUrl, titled } from "../lib/seo";
import { BoardTable } from "../features/leaderboard/BoardTable";
import { Podium } from "../features/leaderboard/Podium";
import { IconInfo } from "../components/icons";
import { PillToggles } from "../components/ui/Tabs";
import { modelHref, shortStamp } from "../features/leaderboard/format";
import { useEntrance } from "../lib/hydration";

const CATEGORY_KEYS = new Set(["coding", "reasoning", "knowledge", "professional"]);

export async function loader({ params, request }: Route.LoaderArgs) {
  const key = params.key ?? "overall";
  if (params.key !== undefined && !CATEGORY_KEYS.has(params.key)) throw data({ message: "not_found" }, { status: 404 });
  return loadOr404<LbBoardResponse>(`/api/site/leaderboard/boards/${key}`, { signal: request.signal });
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: titled("Página não encontrada") }];
  const { board, entries } = loaderData;
  const path = board.key === "overall" ? "/leaderboard" : `/leaderboard/category/${board.key}`;
  return pageMeta({
    title: board.title,
    rawTitle: true,
    description: board.key === "overall" ? `Resultados de avaliações públicas de modelos, com ${SITE.name} índice de consenso, cobertura de avaliações, data de lançamento e preços de referência da API.` : board.description,
    path,
    image: "/og/pages/leaderboard.png",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: board.key === "overall" ? `${SITE.name} Ranking geral de modelos` : `${SITE.name} ${board.name}Ranking de modelos`,
        itemListOrder: "https://schema.org/ItemListOrderAscending",
        numberOfItems: entries.length,
        itemListElement: entries.map((e) => ({ "@type": "ListItem", position: e.rank, name: e.model.name, url: `${siteUrl()}${modelHref(e.model.slug)}` })),
      },
      breadcrumbLd(
        board.key === "overall"
          ? [{ name: "Ranking de modelos", path: "/leaderboard" }]
          : [{ name: "Ranking de modelos", path: "/leaderboard" }, { name: `${board.name}ranking`, path }],
      ),
    ],
  });
}

export function headers() {
  return { "Cache-Control": "public, max-age=0, s-maxage=600, stale-while-revalidate=600" };
}

export default function LeaderboardPage() {
  const { board, entries, filterEntries, pending, run } = useLoaderData<typeof loader>();
  const [filters, setFilters] = useState<string[]>([]);
  const domestic = filters.includes("domestic");
  const openWeights = filters.includes("open-weights");
  const filtered = filters.length > 0;
  const shown = filtered ? [...entries, ...(filterEntries ?? [])]
    .filter((e) => (!domestic || e.access?.domestic) && (!openWeights || !!e.access?.weightsUrl)).slice(0, 30) : entries;
  const entrance = useEntrance();
  return (
    <div key={board.key} className={entrance ? "animate-fade-up" : undefined}>
      <div className="mt-3 flex flex-col gap-1 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-[13.5px] text-ink-2">{board.description}</p>
        <p className="num text-[12px] text-ink-4">
          {board.sourceCount} avaliações <span className="mx-2">·</span>
          {board.operatorCount} instituições <span className="mx-2">·</span>
          {shortStamp(run.generatedAt)} Atualizado
        </p>
      </div>

      {!filtered && <Podium entries={entries} board={board.key} />}

      <section className="card mt-3 overflow-hidden" aria-labelledby="lb-board-title">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 lg:px-[22px]">
          <h2 id="lb-board-title" className="text-[16px] font-bold text-ink">
            {board.key === "overall" ? "Ranking geral" : `${board.name}ranking`}
            <span className="mono ml-2 text-[11px] font-normal tracking-wide text-ink-4">{filtered ? `${shown.length} modelos` : `TOP ${entries.length}`}</span>
          </h2>
          <PillToggles
            label="Filtrar modelos"
            items={[{ key: "domestic", label: "Fabricantes chineses" }, { key: "open-weights", label: "Pesos abertos" }]}
            selected={filters}
            onChange={setFilters}
          />
        </div>
        {shown.length ? <BoardTable entries={shown} board={board.key} /> : <p role="status" className="border-t border-line px-5 py-10 text-center text-[14px] text-ink-3">Nenhum modelo corresponde aos filtros atuais.</p>}
        <div className="border-t border-line px-4 py-3 text-[12px] leading-relaxed text-ink-4 lg:px-[22px]">
          {!filtered && pending.length > 0 && <p className="mb-1 text-ink-3">
            Entre os dez primeiros do ranking geral, ainda não aparecem no ranking de {board.name}:{pending.map((p, i) => <span key={p.model.slug}>
              {i > 0 && "、"}<Link to={`/leaderboard/${p.model.slug}`} className="font-medium text-ink-2 hover:text-accent">{p.model.name}</Link>(com {p.sources} avaliações de {board.name})
            </span>)}. Os rankings por categoria comparam somente modelos avaliados na mesma categoria.
          </p>}
          <p>Ordenado pela evidência compartilhada de avaliações públicas. Cada ranking ou filtro exibe até 30 modelos, mantendo posições e índices originais.</p>
          {filtered && <p>O filtro de fabricantes chineses considera o desenvolvedor do modelo e não garante disponibilidade de todas as versões na China. Pesos abertos incluem somente versões oficiais verificadas; consulte licenças e requisitos nas páginas dos pesos.</p>}
          <p>O índice de consenso não é uma taxa de acerto. Empates de índice mantêm a ordem determinada pela evidência compartilhada.</p>
        </div>
      </section>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <section className="card p-5">
          <h2 className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
            <IconInfo size={16} className="text-accent" />
            Como interpretar o ranking
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-3">{board.howToRead} Preços não alteram a ordem; avaliações ausentes não valem zero; o índice não é uma taxa de acerto.</p>
          <Link to="/leaderboard/rules" className="mt-2.5 inline-flex items-center gap-1 text-[12.5px] font-medium text-accent hover:text-accent-ink">
            Conheça o método →
          </Link>
        </section>
        <section className="card p-5">
          <h2 className="text-[14px] font-semibold text-ink">Sobre os preços</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
            Preços das APIs obtidos nos sites dos fabricantes, por milhão de tokens.{run.fx ? `Cotações em dólares convertidas pela taxa de ${run.fx.asOf} para yuan chinês.` : ""} O preço de cache considera a entrada após um acerto de cache. Gravação, armazenamento e assinaturas são cobrados separadamente.
          </p>
        </section>
      </div>
    </div>
  );
}
