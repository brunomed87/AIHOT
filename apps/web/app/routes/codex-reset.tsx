import { SITE, withSubject } from "@aihot/industry/site";
import { useEffect, useState } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import type { CodexResetEvent, CodexResetSitePage, CodexResetDay } from "@aihot/contracts/monitor";
import { loadOr404 } from "../lib/api.server";
import { pageMeta } from "../lib/seo";
import { PostCard } from "../features/monitor/PostCard";
import { ResetCalendar } from "../features/monitor/ResetCalendar";
import { bjDate, bjTime, dayWord, durationText, monthDay, stamp, typeName, windowText } from "../features/monitor/format";
import { IconChevronDown, IconChevronRight } from "../components/icons";
import { useEntrance } from "../lib/hydration";

export async function loader({ request, params }: { request: Request; params: { date?: string } }) {
  const [data, day] = await Promise.all([
    loadOr404<CodexResetSitePage>("/api/site/codex-reset", { signal: request.signal }),
    params.date ? loadOr404<CodexResetDay>(`/api/site/codex-reset/days/${encodeURIComponent(params.date)}`, { signal: request.signal }) : null,
  ]);
  return { ...data, ...(day ? { selectedDate: day.date, events: day.events } : {}), serverNow: Date.now() };
}

export function meta() {
  return pageMeta({
    title: "Monitor de reinício do Tibo",
    description: "Acompanhe anúncios públicos de Tibo sobre reinício de limites e distribuição de créditos do Codex: janela estimada no horário de Pequim, abrangência, publicação traduzida e calendário histórico.",
    path: "/codex-reset",
    image: "/og/pages/codex-reset.png",
  });
}

export function headers() {
  return { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60" };
}

const POLL_MS = 60_000;

/** Low-frequency version check while the page is in the foreground. */
function useVersionPolling(version: string) {
  const revalidator = useRevalidator();
  useEffect(() => {
    let stopped = false;
    let request: AbortController | null = null;
    const tick = async () => {
      if (document.visibilityState !== "visible" || request) return;
      request = new AbortController();
      try {
        const res = await fetch("/api/site/codex-reset/version", { cache: "no-store", signal: request.signal });
        if (!res.ok) return;
        const v = (await res.json()) as { version: string };
        if (!stopped && v.version !== version) revalidator.revalidate();
      } catch {
        // offline: try again next tick
      } finally {
        request = null;
      }
    };
    const timer = setInterval(tick, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      request?.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [version, revalidator]);
}

function scopeText(e: CodexResetEvent) {
  const who = e.presentation?.audienceZh ?? e.presentation?.scopeLabel ?? "Tibo não informou a abrangência";
  return e.presentation?.productsZh ? `${who} · ${e.presentation.productsZh}` : who;
}

/** The status card: what Tibo announced and when it should land, beside his post. */
function Hero({ d, now }: { d: CodexResetSitePage; now: number }) {
  const e = d.current;
  const entrance = useEntrance();
  const shell = "cr-wash grid items-center gap-5 rounded-sheet border border-line-strong p-4 sm:p-6 lg:grid-cols-2 lg:gap-8 lg:p-8";
  if (!e) {
    const last = d.lastLanded;
    return (
      <section className={shell} style={{ "--tone": last ? "var(--ok-ink)" : "var(--ink-4)" } as React.CSSProperties}>
        <div className="min-w-0">
          <p className={`inline-flex items-center gap-2 text-[13px] font-medium ${last ? "text-ok-ink" : "text-ink-4"}`}>
            <span className="cr-dot" aria-hidden="true" />
            Não há reinício aguardando vigência
          </p>
          <h2 className="mt-3 text-[20px] font-[650] leading-[1.25] text-ink sm:text-[24px]">
            {d.stats.lastResetDate ? `Último reinício de limite em ${monthDay(d.stats.lastResetDate)}` : "Sem registros de reinício"}
          </h2>
          <p className="mt-2 text-[13px] leading-[1.75] text-ink-4">Não prevê reinícios ainda não anunciados. Quando Tibo anunciar, a estimativa e a publicação original aparecerão aqui.</p>
          {d.outage && (
            <p className="mt-4 border-t border-line pt-4 text-[13px] leading-[1.75] text-ink-3">
              Indício:{dayWord(bjDate(d.outage.publishedAt!), d.today)} {bjTime(d.outage.publishedAt!)} Tibo confirmou uma falha no Codex
              {d.outage.recoveredAt ? `, ${bjTime(d.outage.recoveredAt)} Restabelecido` : ""}. Uma falha não significa reinício dos limites.
            </p>
          )}
        </div>
        {last?.posts[0] && (
          <div className="min-w-0">
            <PostCard
              avatar={d.authorAvatar}
              stage={`${last.posts[0].stage}Publicação original`}
              post={{ id: last.posts[0].id, publishedAt: last.posts[0].publishedAt, translation: last.posts[0].fullText ?? last.posts[0].text, original: last.posts[0].fullOriginalText ?? last.posts[0].originalText, context: last.posts[0].context, url: last.posts[0].url }}
            />
          </div>
        )}
      </section>
    );
  }
  const status = e.presentation?.status ?? "announced";
  const window = e.estimate ?? e.schedule;
  const through = window?.through ? Date.parse(window.through) : null;
  const from = window?.from ? Date.parse(window.from) : null;
  const credit = e.type === "reset_credit";
  const headline = status === "in_progress" ? (credit ? "Créditos de reinício em distribuição" : "Reinício de limites em andamento") : credit ? "Aguardando recebimento dos créditos" : "Aguardando vigência do reinício";
  let timing: string | null = null;
  if (status === "expired_unconfirmed" && through) timing = `A previsão foi ultrapassada em ${durationText(now - through)}; aguardando confirmação`;
  else if (status === "announced" && from && now < from) timing = `Tempo até a janela prevista: ${durationText(from - now)}`;
  else if (status === "announced" && through && now < through) timing = "Dentro da janela prevista";
  else if (status === "in_progress" && e.presentation?.reportedAt) timing = `Tibo ${stamp(e.presentation.reportedAt)} Indica operação em andamento`;
  const outage = d.outage && d.outage.resetEventId === e.id ? d.outage : null;
  const post = e.posts[0];
  return (
    <section
      className={`${shell} ${entrance ? "animate-fade-up" : ""}`}
      style={{ "--tone": status === "expired_unconfirmed" ? "var(--hot)" : "var(--amber-ink)" } as React.CSSProperties}
    >
      <div className="min-w-0">
        <p className={`inline-flex items-center gap-2 text-[13px] font-medium ${status === "expired_unconfirmed" ? "text-hot" : "text-amber-ink"}`}>
          <span className="cr-dot cr-dot-live" aria-hidden="true" />
          {typeName(e.type)} · anunciado por Tibo
        </p>
        <h2 className="mt-3 text-[20px] font-[650] leading-[1.25] text-ink sm:text-[24px]">{headline}</h2>
        {window?.from && (
          <p className="num mt-4 text-[24px] font-[650] leading-[1.3] tracking-[-0.01em] text-amber-ink lg:text-[clamp(24px,2.6vw,32px)]">
            Previsão {windowText(window.from, window.through, d.today).replace("–", " – ")}
          </p>
        )}
        {(timing || e.estimate?.reason) && (
          <p className="mt-2 text-[13px] leading-[1.75] text-ink-4">
            {timing}
            {timing && e.estimate?.reason ? " · " : ""}
            {e.estimate?.reason}
          </p>
        )}
        <ul className="mt-4 grid gap-2 border-t border-line pt-4 text-[13px] leading-[1.75] text-ink-3">
          <li>Abrangência:{scopeText(e)}</li>
          {outage?.publishedAt && (
            <li>
              Motivo:{dayWord(bjDate(outage.publishedAt), d.today)} {bjTime(outage.publishedAt)} Tibo confirmou uma falha no Codex {outage.recoveredAt ? `, ${bjTime(outage.recoveredAt)} Restabelecido` : ""}
            </li>
          )}
        </ul>
        <p className="mt-4 text-[13px] leading-[1.75] text-ink-3">
          {credit ? "Após receber créditos de reinício, você decide quando utilizá-los. Confira o saldo no Codex." : "O reinício anunciado prevê restaurar o limite disponível. Confira seu uso e a aplicação efetiva no Codex."}
        </p>
      </div>
      {post && (
        <div className="min-w-0">
          <PostCard
            avatar={d.authorAvatar}
            stage={`${post.stage}Publicação original`}
            post={{ id: post.id, publishedAt: post.publishedAt, translation: post.fullText ?? post.text, original: post.fullOriginalText ?? post.originalText, context: post.context, url: post.url }}
          />
        </div>
      )}
    </section>
  );
}

/** Tibo's usual hours: 16:30–21:30 Pacific, i.e. 07:30–12:30 Beijing the next morning. */
const USUAL_FROM = 7 * 60 + 30;
const USUAL_TO = 12 * 60 + 30;
const inUsual = (m: number) => m >= USUAL_FROM && m <= USUAL_TO;

const MONITOR_WORDS = { healthy: "Monitor funcionando", delayed: "Verificação atrasada", attention: "Monitor exige atenção", unknown: "Estado do monitor desconhecido" } as const;
const MONITOR_DOT = { healthy: "bg-ok-ink", delayed: "bg-amber-ink", attention: "bg-amber-ink", unknown: "bg-ink-4" } as const;

export default function CodexResetPage() {
  const d = useLoaderData<typeof loader>();
  useVersionPolling(d.version);
  const m = d.monitor;
  return (
    <div className="pb-8">
      <header className="flex flex-col gap-1 pb-4 pt-5 lg:flex-row lg:items-end lg:justify-between lg:pt-1">
        <div>
          <h1 className="text-[24px] font-semibold leading-[1.3] text-ink">Monitor de reinício do Tibo</h1>
          <p className="mt-1.5 text-[13px] text-ink-3">Reinício de limites e distribuição de créditos do Codex: vigência, abrangência e declarações de Tibo</p>
        </div>
        <p className="text-[12px] text-ink-4">Horários de Pequim · UTC+8</p>
      </header>

      <LiveMonitor d={d} />

      <details className="disclosure group mt-8 border-t border-line">
        <summary className="flex items-center justify-between gap-3 py-[18px] text-[13px] text-ink-3 transition-colors hover:text-ink">
          <span className="inline-flex items-center gap-1.5">
            <IconChevronRight size={13} className="text-ink-4 transition-transform duration-200 group-open:rotate-90" />
            Como os horários são estimados?
          </span>
          <span className="text-[12px] text-ink-4">Fontes e regras</span>
        </summary>
        <div className="grid gap-x-8 gap-y-[18px] pb-6 pt-1.5 text-[12px] leading-[1.9] text-ink-4 md:grid-cols-2">
          <p><strong className="font-semibold text-ink-3">Use o horário anunciado quando houver.</strong> Quando Tibo informa um horário, como 18h PST, próxima hora ou fim do dia, ele é convertido do Pacífico para Pequim com margem adicional de uma ou duas horas, pois confirmações podem ocorrer depois do anunciado. Quando há somente data, a estimativa usa o padrão observado de fim de tarde no Pacífico.</p>
          <p><strong className="font-semibold text-ink-3">Sem horário anunciado, use o padrão observado.</strong> O padrão histórico observado de reinício é entre 16h30 e 21h30 no Pacífico, equivalente a 07h30–12h30 do dia seguinte em Pequim.{d.confirmMinutes.length ? `Nas últimas ${d.confirmMinutes.length} confirmações, ${d.confirmMinutes.filter(inUsual).length} ocorreram nessa janela.` : ""} A estimativa é apenas referência. Confira a confirmação de Tibo e o uso exibido no Codex.</p>
          <p><strong className="font-semibold text-ink-3">Confirmado, previsto como vigente ou aguardando.</strong> Vigente exige confirmação publicada por Tibo. Após algumas horas sem confirmação, o estado indica vigência estimada com base no histórico, sem presumir confirmação. Créditos e reinícios de limites têm registros separados; distribuir créditos não significa restaurar o limite.</p>
          <p><strong className="font-semibold text-ink-3">Acompanhamento das publicações públicas de Tibo.</strong> A verificação ocorre a cada cinco minutos, ou três minutos após anúncio de falha ou reinício. Somente mensagens explícitas de reinício ou distribuição de créditos são enviadas aos grupos Feishu. Confira seu limite pessoal e créditos dentro do Codex.</p>
        </div>
      </details>

      <footer className="flex flex-col gap-2 border-t border-line py-4 text-[12px] text-ink-4 sm:flex-row sm:items-start sm:justify-between">
        {m ? (
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
              <span className={`size-1.5 rounded-full ${MONITOR_DOT[m.status]}`} />
              {MONITOR_WORDS[m.status]} · última verificação <span className="num">{stamp(m.lastVerifiedAt)}</span>
              <IconChevronDown size={13} className="text-ink-4 transition-transform group-open:rotate-180" />
            </summary>
            <dl className="num mt-2 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 pl-4 text-[12px] text-ink-4">
              <dt>Última tentativa</dt><dd>{stamp(m.lastAttemptAt)}</dd>
              <dt>Última coleta</dt><dd>{stamp(m.lastCollectedAt)}</dd>
              <dt>Última verificação completa</dt><dd>{stamp(m.lastVerifiedAt)}</dd>
              {m.pendingCount > 0 && <><dt>Publicações pendentes</dt><dd>{m.pendingCount}</dd></>}
              {m.heldWindowCount > 0 && <><dt>Janelas a verificar</dt><dd>{m.heldWindowCount}</dd></>}
            </dl>
          </details>
        ) : (
          <span>Estado do monitor indisponível</span>
        )}
        <span>{SITE.name} organizado · página não oficial da OpenAI</span>
      </footer>
    </div>
  );
}

/** Only the changing status/calendar need the foreground clock; archive statistics stay still. */
function LiveMonitor({ d }: { d: CodexResetSitePage & { serverNow: number } }) {
  const [now, setNow] = useState(d.serverNow);
  useEffect(() => {
    const update = () => { if (document.visibilityState === "visible") setNow(Date.now()); };
    update();
    const t = setInterval(update, 30_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", update);
    };
  }, [d.version]);
  return <>
    <Hero d={d} now={now} />
    <ResetCalendar key={d.selectedDate} selectedDate={d.selectedDate} version={d.version} marks={d.calendar} events={d.events} today={d.today} historyFrom={d.historyFrom} now={now} avatar={d.authorAvatar} />
  </>;
}
