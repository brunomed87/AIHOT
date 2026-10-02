import { SITE, withSubject } from "@aihot/industry/site";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLoaderData, useSearchParams } from "react-router";
import { Collapse } from "../components/ui/Presence";
import type { Route } from "./+types/leaderboard-model";
import type { LbComparison, LbEvidenceItem, LbModelDetail } from "@aihot/contracts/leaderboard";
import { LEADERBOARD_BOARD_LABELS, LEADERBOARD_PUBLIC_BOARDS } from "@aihot/contracts/taxonomy";
import { loadOr404 } from "../lib/api.server";
import { breadcrumbLd, pageMeta, siteUrl, titled } from "../lib/seo";
import { BrandMark } from "../features/leaderboard/BrandMark";
import { EvidenceBadge } from "../features/leaderboard/Evidence";
import { boardHref, listPrice, pctFixed, shortStamp, tokensWan, yuan } from "../features/leaderboard/format";
import { IconArrowLeft, IconArrowRight, IconArrowUpRight, IconChevronDown, IconExternal } from "../components/icons";

export async function loader({ params, request }: Route.LoaderArgs) {
  return loadOr404<LbModelDetail>(`/api/site/leaderboard/models/${encodeURIComponent(params.slug)}`, { signal: request.signal });
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: titled("Página não encontrada") }];
  const { model } = loaderData;
  const path = `/leaderboard/${model.slug}`;
  return pageMeta({
    title: `${model.name} Posição e resultados por avaliação`,
    description: `Ver ${model.name} de ${SITE.name} índice de consenso,${loaderData.historical ? "Posição histórica" : "Posição atual"}e suas posições e resultados originais em avaliações públicas.`,
    path,
    image: "/og/pages/leaderboard.png",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Dataset",
        name: `${model.name} em ${SITE.name} Resultados no ranking de modelos`,
        description: `${model.name} e seu índice de consenso, posições por categoria e resultados originais das avaliações públicas.`,
        url: `${siteUrl()}${path}`,
        creator: { "@type": "Organization", name: SITE.name, url: siteUrl() },
        isAccessibleForFree: true,
      },
      breadcrumbLd([
        { name: "Ranking de modelos", path: "/leaderboard" },
        { name: model.name, path },
      ]),
    ],
  });
}

export function headers() {
  return { "Cache-Control": "public, max-age=0, s-maxage=600, stale-while-revalidate=600" };
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="mono text-[11px] font-semibold tracking-[0.14em] text-accent">{children}</span>;
}

function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-2 text-[20px] font-bold leading-[1.5] text-ink">{title}</h2>
      <p className="mt-1 text-[13px] text-ink-3">{sub}</p>
    </>
  );
}

function Stat({ label, children, foot }: { label: string; children: ReactNode; foot?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="text-[11px] text-ink-4">{label}</span>
      <span className="mono mt-2 text-[20px] font-semibold leading-tight text-ink">{children}</span>
      {foot && <span className="mt-1.5 text-[12px] text-ink-3">{foot}</span>}
    </div>
  );
}

function Capability({ d, from }: { d: LbModelDetail; from: string }) {
  return (
    <section className="mt-12">
      <SectionHead eyebrow="PERFIL DE CAPACIDADES" title="Capacidades distintas, comparação mais clara." sub="Cada capacidade é calculada separadamente. Sem resultados suficientes, o campo fica vazio." />
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {d.categories.map((c) => (
          <Link
            key={c.key}
            to={boardHref(c.key)}
            className={`card card-hover group flex h-full flex-col rounded-card p-4 lg:p-[22px] ${c.key === from ? "border-accent/45" : ""}`}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-[14px] font-semibold text-ink transition-colors group-hover:text-accent">{c.name}</span>
              {c.rank !== null ? (
                <span className={`mono text-[11.5px] font-semibold ${c.onBoard ? "text-accent" : "text-ink-4"}`}>{c.onBoard ? `#${c.rank}` : "Fora das 30 primeiras posições"}</span>
              ) : (
                <span className="text-[11px] text-ink-4">Evidência incompleta</span>
              )}
            </span>
            {c.score !== null ? (
              <>
                <span className="mono mt-4 text-[32px] font-medium leading-none tracking-[-0.03em] text-ink">{c.score.toFixed(1)}</span>
                <span className="mt-auto pt-4 text-[12px] text-ink-3">{c.sourceCount} avaliações de apoio</span>
              </>
            ) : (
              <>
                <span className="mono mt-4 text-[32px] font-medium leading-none text-ink-4">—</span>
                <span className="mt-auto pt-4 text-[12px] text-ink-4">Sem resultados comparáveis suficientes</span>
              </>
            )}
          </Link>
        ))}
      </div>
      <p className="mt-3 text-[12px] text-ink-4">Índices por categoria refletem o apoio à ordem dentro de suas referências. Não devem ser somados nem usados para comparar capacidades distintas em termos absolutos.</p>
    </section>
  );
}

function Stability({ d }: { d: LbModelDetail }) {
  const s = d.overall.stability;
  const rank = d.overall.rank;
  if (!s || rank === null) return null;
  return (
    <section className="mt-12">
      <SectionHead eyebrow="COMPREENDER A POSIÇÃO" title="A posição geral é estável?" sub="Retiramos avaliações ou instituições e variamos pesos e tratamento do erro para observar alterações na ordem." />
      <div className="mt-5 grid gap-5 border-b border-line pb-6 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-10">
        <div>
          <span className="text-[12px] text-ink-4">Posições após rever a elegibilidade</span>
          <span className="mt-1 block text-[30px] font-bold leading-tight text-ink">{s.from === s.to ? `nº ${s.from} posição` : `${s.from}—${s.to} posição`}</span>
          {d.overall.confidence && (
            <span className="mt-1 block">
              <EvidenceBadge confidence={d.overall.confidence} stability={null} rank={rank} />
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[13px] leading-relaxed text-ink-3">
            {s.unavailable > 0 ? `${s.unavailable} cenários com evidência insuficiente para elegibilidade.` : s.incomplete > 0 ? `${s.incomplete} comparações incompletas.` : "Elegível em todas as comparações concluídas."}
            Mantendo os candidatos originais: {s.fixedFrom}—{s.fixedTo} posições. Essa amplitude não é um intervalo de confiança nem inclui resultados nunca publicados.
          </p>
        </div>
      </div>
      {d.comparisons.length > 0 && <Comparisons d={d} />}
    </section>
  );
}

/** Net support in shared evaluations, as a signed number: positive favours this model. */
function NetValue({ net }: { net: number }) {
  const v = Math.round(net * 100) / 100;
  if (v === 0) return <span className="text-[12px] text-ink-4">Estável</span>;
  return <span className={`mono text-[12.5px] font-semibold ${v > 0 ? "text-accent" : "text-amber-ink"}`}>{v > 0 ? `+${v.toFixed(2)}` : `−${Math.abs(v).toFixed(2)}`}</span>;
}

function Comparisons({ d }: { d: LbModelDetail }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between py-4 text-left">
        <span className="text-[13.5px] font-semibold text-ink">Compare a evidência com modelos próximos</span>
        <span className={`text-[18px] leading-none text-ink-4 transition-transform duration-300 ${open ? "rotate-45" : ""}`}>
          +
        </span>
      </button>
      <Collapse open={open} duration={300}>
        <p className="text-[13px] text-ink-3">O apoio líquido considera somente avaliações compartilhadas. A ordem global precisa tratar conflitos entre outros modelos; por isso, posições não adjacentes podem divergir da comparação direta.</p>
        <ul className="-mx-3 divide-y divide-line-soft pb-3 pt-2">
          {d.comparisons.map((c) => <ComparisonRow key={c.model.slug} c={c} name={d.model.name} />)}
        </ul>
      </Collapse>
    </div>
  );
}

function ComparisonRow({ c, name }: { c: LbComparison; name: string }) {
  const [open, setOpen] = useState(false);
  const favours = c.net > 1e-9 ? "Evidência compartilhada favorece este modelo" : c.net < -1e-9 ? "Evidência compartilhada favorece o outro modelo" : "Evidência compartilhada em equilíbrio";
  return (
    <li>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-3 rounded-tile px-3 py-3 text-left transition-colors hover:bg-bg-sunk">
        <BrandMark brand={c.model.brand} size={26} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium text-ink">{c.model.name} <span className="num text-[12px] text-ink-4">#{c.rank}</span></span>
          <span className="text-[12px] text-ink-3">{c.sharedCount} avaliações compartilhadas · {favours}</span>
        </span>
        <NetValue net={c.net} />
        <span className={`text-ink-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`}><IconChevronDown size={15} /></span>
      </button>
      <Collapse open={open} duration={300}>
        <div className="px-3 pb-4">
          <p className="text-[12.5px] leading-relaxed text-ink-3">
            Os dois modelos compartilham {pctFixed(c.sharedWeight)} do peso nominal do ranking atual. A tabela mostra resultados utilizados; o tratamento do erro conhecido modifica o apoio líquido. Não se trata de contar vitórias.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] text-[12.5px]">
              <thead className="text-ink-4">
                <tr className="border-b border-line">
                  <th className="py-2 text-left font-medium">Avaliações compartilhadas</th>
                  <th className="py-2 text-right font-medium">{name}</th>
                  <th className="py-2 text-right font-medium">{c.model.name}</th>
                  <th className="py-2 text-right font-medium">Peso</th>
                </tr>
              </thead>
              <tbody>
                {c.rows.map((r) => (
                  <tr key={r.sourceKey} className="border-b border-line last:border-0">
                    <td className="py-2 pr-2"><Link to={`/leaderboard/sources/${r.sourceKey}`} className="text-ink-2 hover:text-accent">{r.sourceName}</Link></td>
                    <td className="num py-2 text-right text-ink">{r.mine}</td>
                    <td className="num py-2 text-right text-ink-2">{r.theirs}</td>
                    <td className="num py-2 text-right text-ink-4">{pctFixed(r.weight)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {c.hasPage && (
            <Link to={`/leaderboard/${c.model.slug}`} className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-accent">
              Ver {c.model.name} Evidência completa de <IconArrowRight size={13} />
            </Link>
          )}
        </div>
      </Collapse>
    </li>
  );
}

function EvidenceCard({ it }: { it: LbEvidenceItem }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="card overflow-hidden rounded-tile">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-accent-softer lg:px-5">
        <BrandMark brand={it.brand} size={28} className="max-sm:hidden" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold text-ink">{it.sourceName}</span>
          <small className="text-[11px] text-ink-4">{it.usage}</small>
        </span>
        <span className="text-right">
          <span className="mono block text-[19px] font-medium leading-tight text-ink">{it.display}</span>
          {it.displayNote && <span className="block text-[11px] text-ink-4">{it.displayNote}</span>}
        </span>
        <span className={`grid size-6 shrink-0 place-items-center text-[17px] leading-none text-ink-4 transition-transform duration-300 ${open ? "rotate-45" : ""}`}>
          +
        </span>
      </button>
      <Collapse open={open} duration={300}>
        <dl className="grid gap-3 border-t border-line-soft px-4 py-4 text-[12.5px] sm:grid-cols-2 lg:px-5">
          <div>
            <dt className="text-ink-4">Modelo na fonte original</dt>
            <dd className="mt-0.5 break-all font-mono text-[12px] text-ink-2">{it.sourceModelName ?? "—"}{it.sourceRank !== null && <span className="ml-1.5 font-sans text-ink-4">Posição original: {it.sourceRank} posição</span>}</dd>
          </div>
          <div>
            <dt className="text-ink-4">Configuração representativa</dt>
            <dd className="mt-0.5 text-ink-2">{it.configurationLabel ?? "—"}</dd>
          </div>
          {it.selectionReason && <p className="text-ink-3 sm:col-span-2">{it.selectionReason}</p>}
          <div className="sm:col-span-2">
            <dt className="text-ink-4">Registro utilizado nesta rodada</dt>
            <dd className="num mt-0.5 text-ink-2">
              Dados de origem {shortStamp(it.upstreamAt)} · verificado {shortStamp(it.verifiedAt)} · {it.measuredAt ? `Avaliado ${shortStamp(it.measuredAt)}` : "Data da avaliação não publicada"}
              {it.carriedForward && "· reutilizado o último registro verificado"}
            </dd>
          </div>
          {it.components.length > 0 && (
            <div className="sm:col-span-2">
              {it.componentsNote && <p className="text-ink-3">{it.componentsNote}</p>}
              <div className="mt-2 flex gap-2">
                {it.components.map((c) => (
                  <span key={c.label} className="rounded-control bg-bg-sunk px-3 py-1.5">
                    <span className="block text-[11px] text-ink-4">{c.label}</span>
                    <span className="num text-[14px] font-semibold text-ink">{c.display}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-4 sm:col-span-2">
            <Link to={`/leaderboard/sources/${it.sourceKey}`} className="inline-flex items-center gap-1 font-medium text-accent">Ver esta avaliação <IconArrowRight size={13} /></Link>
            {it.officialUrl && (
              <a href={it.officialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-ink-3 hover:text-accent">Fonte oficial <IconExternal size={12} /></a>
            )}
          </div>
        </dl>
      </Collapse>
    </li>
  );
}

export default function LeaderboardModelPage() {
  const d = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  // The server page is shared by every ?from= (a CDN caches it once), so the board to return
  // Destino aplicado após hidratação; HTML do servidor e primeiro desenho do cliente mostram ranking geral.
  const [fromParam, setFromParam] = useState<string | null>(null);
  useEffect(() => setFromParam(params.get("from")), [params]);
  const from = fromParam && (LEADERBOARD_PUBLIC_BOARDS as readonly string[]).includes(fromParam) ? fromParam : "overall";
  const { model, price, overall } = d;
  const withScores = d.categories.filter((c) => c.score !== null).length;
  return (
    <div className="pb-12">
      <Link to={boardHref(from)} className="mt-4 inline-flex items-center gap-1.5 py-2 text-[13px] text-ink-3 transition-colors hover:text-accent lg:mt-0">
        <IconArrowLeft size={14} /> Voltar {LEADERBOARD_BOARD_LABELS[from as keyof typeof LEADERBOARD_BOARD_LABELS]} ranking
      </Link>

      {d.historical && <p className="well mt-4 px-4 py-3 text-[13px] leading-relaxed text-ink-3">
        Este modelo está fora do ranking atual. Abaixo permanecem seus últimos resultados publicados, com posição e evidência até {new Date(d.run.generatedAt).toLocaleDateString("pt-BR", { timeZone: "Asia/Shanghai" })}.
      </p>}
      <header className="mt-5 flex flex-col gap-5 pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-4">
          <BrandMark brand={model.brand} size={52} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-[24px] font-semibold leading-[1.3] tracking-[-0.02em] text-ink">{model.name}</h1>
              {model.weightsUrl && (
                <a href={model.weightsUrl} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap text-[12.5px] text-accent hover:underline">
                  Pesos abertos ↗
                </a>
              )}
            </div>
            <p className="num mt-1 text-[12.5px] text-ink-3">
              {model.provider ?? "—"} · {model.releasedAt ? `${model.releasedAt} Lançamento` : "Data de lançamento a verificar"} · {shortStamp(d.run.generatedAt)} Atualizado
            </p>
          </div>
        </div>
        <div className="sm:text-right">
          <span className="block text-[12px] text-ink-4">Índice geral de consenso</span>
          <strong className="mono block text-[48px] font-medium leading-[1.25] tracking-[-0.055em] text-accent lg:text-[55px]">{overall.score !== null ? overall.score.toFixed(1) : "—"}</strong>
          <b className={`text-[12px] font-medium ${overall.onBoard ? "text-ink-3" : "text-ink-4"}`}>
            {overall.rank === null ? "Fora do ranking geral" : overall.onBoard ? `Posição geral: ${overall.rank} posição` : "Fora das 30 primeiras posições gerais"}
          </b>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-x-4 gap-y-6 border-y border-line py-6 lg:grid-cols-4" aria-label="Visão geral do modelo">
        <Stat label="Resultados por categoria">
          {withScores}
          <small className="ml-1 font-sans text-[11px] font-normal text-ink-4">/ 4 categorias</small>
        </Stat>
        <Stat label="com resultados">
          {d.metricCount}
          <small className="ml-1 font-sans text-[11px] font-normal text-ink-4">avaliações</small>
        </Stat>
        <Stat label="Janela de contexto">
          {tokensWan(model.contextWindowTokens)}
          <small className="ml-1 font-sans text-[11px] font-normal text-ink-4">Token</small>
        </Stat>
        <Stat
          label="Entrada / saída da API · por milhão de tokens"
          foot={
            price ? (
              <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                {price.cachedCny !== null && <span className="num">Cache {yuan(price.cachedCny)}</span>}
                {price.currency === "USD" && (
                  <span className="num text-ink-4">
                    Preço original {listPrice(price.input, "USD")} / {listPrice(price.output, "USD")}
                  </span>
                )}
                {price.note && <span>{price.note}</span>}
                {price.officialUrl && (
                  <a href={price.officialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-accent hover:text-accent-ink">
                    Preço oficial do fabricante <IconArrowUpRight size={12} />
                  </a>
                )}
              </span>
            ) : (
              "Preço oficial ainda não verificado"
            )
          }
        >
          {price ? `${yuan(price.inputCny)} / ${yuan(price.outputCny)}` : <span className="font-sans text-[15px] font-normal text-ink-4">Aguardando verificação</span>}
        </Stat>
      </section>

      <Capability d={d} from={from} />
      <Stability d={d} />

      <section className="mt-12">
        <SectionHead eyebrow="ORIGEM DA PONTUAÇÃO" title="Cada resultado tem uma origem." sub="Abaixo estão os resultados públicos agregados. Expanda para consultar a configuração e a forma de utilização." />
        {d.evidence.map((g) => (
          <div key={g.key} className="mt-6">
            <h3 className="flex items-baseline gap-2 text-[14px] font-semibold text-ink">
              {g.name}
              <span className="num text-[11.5px] font-normal text-ink-4">{g.items.length} avaliações de</span>
            </h3>
            <ul className="mt-2.5 space-y-2">
              {g.items.map((it) => (
                <EvidenceCard key={it.sourceKey} it={it} />
              ))}
            </ul>
          </div>
        ))}
        {d.excluded.length > 0 && (
          <div className="mt-6">
            <h3 className="text-[14px] font-semibold text-ink">Avaliado, mas excluído pelas regras</h3>
            <p className="mt-1 text-[12.5px] text-ink-3">Essas avaliações publicaram resultados do modelo, mas usaram execução sem representar um único modelo, como redirecionamento de solicitações bloqueadas para outros modelos. As regras excluem esses resultados.</p>
            <ul className="mt-2.5 space-y-1.5 text-[13px]">
              {d.excluded.map((x) => (
                <li key={x.key}>
                  <Link to={`/leaderboard/sources/${x.key}`} className="font-medium text-ink-2 transition-colors hover:text-accent">{x.name}</Link>
                  <span className="text-ink-3">: {x.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {d.unmeasured.length > 0 && (
          <div className="mt-6">
            <h3 className="text-[14px] font-semibold text-ink">Avaliações sem resultados publicados</h3>
            <p className="mt-1 text-[12.5px] text-ink-3">Essas avaliações não publicaram resultados deste modelo. Ausências não valem zero.</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {d.unmeasured.map((u) => (
                <Link key={u.key} to={`/leaderboard/sources/${u.key}`} className="chip">
                  {u.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="mt-10 border-t border-line pt-6">
        <h2 className="text-[15px] font-semibold text-ink">Ainda há informações desconhecidas</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">Avaliações ausentes não valem zero. A posição muda com novas evidências; pequenas diferenças entre índices não devem ser exageradas.</p>
        <Link to="/leaderboard/rules" className="mt-2.5 inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:text-accent-ink">
          Conheça o método →
        </Link>
      </section>
    </div>
  );
}
