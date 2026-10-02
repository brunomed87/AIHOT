import { SITE } from "@aihot/industry/site";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import type { AdminMonitorEvent, AdminMonitorEvents, AdminMonitorPost, AdminMonitorPosts } from "@aihot/contracts/admin";
import type { Route } from "./+types/monitor";
import { adminGet } from "../../lib/admin.server";
import { useAdminAction } from "../../features/admin/action";
import { bj } from "../../features/admin/format";
import { AdminPage, Badge, Button, Card, Empty, Field, FilterChips, Input, Json, Pager, ReasonDialog, Select } from "../../features/admin/ui";


export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const tab = url.searchParams.get("tab") ?? "events";
  if (tab === "posts") {
    const posts = await adminGet<AdminMonitorPosts>(request, `/api/admin/monitor/posts?filter=${url.searchParams.get("filter") ?? "relevant"}&page=${url.searchParams.get("page") ?? 1}`);
    return { tab, posts, events: null };
  }
  const events = await adminGet<AdminMonitorEvents>(request, `/api/admin/monitor/events${url.searchParams.get("withdrawn") ? "?withdrawn=1" : ""}`);
  return { tab, posts: null, events };
}

export const meta: Route.MetaFunction = () => [{ title: `Reinícios do Codex · ${SITE.name} Painel administrativo` }];

const toLocal = (iso: string | null | undefined) => (iso ? new Date(new Date(iso).getTime() + 8 * 3600_000).toISOString().slice(0, 16) : "");
const fromLocal = (v: string) => (v ? `${v}:00+08:00` : null);
const KIND: Record<string, string> = { direct_reset: "Reinício de limites", reset_credit: "Créditos de reinício" };

function EventCard({ e, all }: { e: AdminMonitorEvent; all: AdminMonitorEvent[] }) {
  const { run, pending } = useAdminAction();
  const [dialog, setDialog] = useState<null | "edit" | "review" | "withdraw" | "move">(null);
  const [form, setForm] = useState(() => formOf(e));
  const [reviewDay, setReviewDay] = useState(() => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10));
  const [move, setMove] = useState<{ postId: string; to: string } | null>(null);
  const version = new Date(e.updated_at).toISOString();
  const base = `/api/admin/monitor/events/${encodeURIComponent(e.id)}`;
  const p = e.presentation ?? {};
  return (
    <article className={`rounded-panel bg-surface p-4 ring-1 ${e.withdrawn ? "opacity-60 ring-line" : e.status === "confirmed" ? "ring-line" : "ring-accent/30"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={e.type === "reset_credit" ? "info" : "accent"}>{KIND[e.type]}</Badge>
            <Badge tone={e.status === "confirmed" ? "ok" : "warn"}>{e.status === "confirmed" ? "Confirmado" : p.inProgress ? "Em distribuição" : "Anunciado"}</Badge>
            {e.confirmation_basis === "receipt_review" && <Badge tone="info" title="Confirmado por comprovante da conta">Verificação por comprovante</Badge>}
            {e.withdrawn && <Badge tone="bad">Retirado</Badge>}
            {!p.kindExplicit && <Badge>Formato não informado</Badge>}
          </div>
          <div className="mt-2 text-[15px] font-semibold text-ink">{e.schedule?.label ?? (e.estimate ? `${SITE.name} Estimado ${e.estimate.label}` : "Horário não informado")}</div>
          <div className="mt-0.5 text-[12.5px] text-ink-3">
            {p.audienceZh ?? e.scope ?? "Público abrangido não informado"}
            {p.productsZh ? ` · ${p.productsZh}` : ""}
            {e.confirmed_at ? ` · confirmado em ${bj(e.confirmed_at, true)}` : e.occurred_on ? ` · ocorrido em ${e.occurred_on}` : ""}
          </div>
          <div className="mt-1 font-mono text-[11.5px] text-ink-4">{e.id} · atualizado {bj(e.updated_at, true)}</div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" onClick={() => { setForm(formOf(e)); setDialog("edit"); }}>Editar</Button>
          {e.status !== "confirmed" && <Button size="sm" onClick={() => setDialog("review")}>Confirmar por comprovante</Button>}
          <Button size="sm" tone="ghost" onClick={() => setDialog("withdraw")}>{e.withdrawn ? "Restabelecido" : "Retirar"}</Button>
        </div>
      </div>
      <ol className="mt-3 space-y-2 border-t border-line pt-3">
        {e.posts.map((post) => (
          <li key={post.postId} className="grid gap-1 text-[13px] sm:grid-cols-[92px_1fr_auto]">
            <div className="flex items-center gap-1.5 sm:block">
              <Badge tone={post.action === "confirm" ? "ok" : "muted"}>{post.stage}</Badge>
              <div className="num text-[11.5px] text-ink-4 sm:mt-1">{bj(post.publishedAt)}</div>
            </div>
            <div className="min-w-0">
              <div className="text-ink">{post.text}</div>
              <a className="text-[12px] text-ink-4 hover:text-accent" href={post.url} target="_blank" rel="noreferrer">{post.originalText}</a>
            </div>
            <Button size="sm" tone="ghost" onClick={() => { setMove({ postId: post.postId, to: "" }); setDialog("move"); }}>Mover</Button>
          </li>
        ))}
      </ol>

      <ReasonDialog
        open={dialog === "edit"}
        title="Editar acontecimento"
        description="Preencha no horário de Pequim. As alterações aparecem imediatamente na página de reinícios, API v1 e verificação de versão."
        confirmLabel="Salvar"
        busy={pending === "edit"}
        onClose={() => setDialog(null)}
        onSubmit={async (reason) => {
          const patch: Record<string, unknown> = {
            type: form.type,
            status: form.status,
            audienceZh: form.audienceZh || null,
            productsZh: form.productsZh || null,
            scopeLabel: form.scopeLabel || null,
            schedule: form.precision ? { precision: form.precision, from: fromLocal(form.from), through: fromLocal(form.through || form.from) } : null,
          };
          if (form.status === "confirmed") patch.confirmedAt = fromLocal(form.confirmedAt);
          return (await run("PATCH", base, { patch, reason, version }, { label: "edit", success: "Acontecimento atualizado" })) !== null;
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tipo">
            <Select value={form.type} onChange={(ev) => setForm({ ...form, type: ev.target.value as AdminMonitorEvent["type"] })}>
              <option value="direct_reset">Reinício de limites</option>
              <option value="reset_credit">Créditos de reinício</option>
            </Select>
          </Field>
          <Field label="Estado">
            <Select value={form.status} onChange={(ev) => setForm({ ...form, status: ev.target.value as AdminMonitorEvent["status"] })}>
              <option value="announced">Anunciado</option>
              <option value="confirmed">Confirmado</option>
            </Select>
          </Field>
          <Field label="Precisão do horário">
            <Select value={form.precision} onChange={(ev) => setForm({ ...form, precision: ev.target.value })}>
              <option value="">Sem horário</option>
              <option value="window">Intervalo</option>
              <option value="deadline">Prazo: antes de</option>
              <option value="approximate">Aproximado</option>
              <option value="date">Dia inteiro</option>
            </Select>
          </Field>
          {form.status === "confirmed" && (
            <Field label="Horário de confirmação">
              <Input type="datetime-local" value={form.confirmedAt} onChange={(ev) => setForm({ ...form, confirmedAt: ev.target.value })} />
            </Field>
          )}
          {form.precision && (
            <>
              <Field label="De"><Input type="datetime-local" value={form.from} onChange={(ev) => setForm({ ...form, from: ev.target.value })} /></Field>
              {(form.precision === "window" || form.precision === "date") && <Field label="Até"><Input type="datetime-local" value={form.through} onChange={(ev) => setForm({ ...form, through: ev.target.value })} /></Field>}
            </>
          )}
          <Field label="Público abrangido (português)"><Input value={form.audienceZh} onChange={(ev) => setForm({ ...form, audienceZh: ev.target.value })} /></Field>
          <Field label="Produto"><Input value={form.productsZh} onChange={(ev) => setForm({ ...form, productsZh: ev.target.value })} /></Field>
          <Field label="Marcador de abrangência (original)"><Input value={form.scopeLabel} onChange={(ev) => setForm({ ...form, scopeLabel: ev.target.value })} /></Field>
        </div>
      </ReasonDialog>
      <ReasonDialog
        open={dialog === "review"}
        title="Confirmar com base no comprovante"
        description="Sem confirmação pública de Tibo, uma captura do leitor ou sua própria conta pode comprovar o reinício ou crédito. Preencha a data de Pequim se conhecida; caso contrário, deixe vazio. Esta ação não notifica. Uma confirmação pública posterior atualiza automaticamente a origem, preservando o registro de verificação."
        confirmLabel="Confirmar"
        busy={pending === "review"}
        onClose={() => setDialog(null)}
        onSubmit={async (reason) => (await run("POST", `${base}/receipt-review`, { occurredOn: reviewDay || null, reason, version }, { label: "review", success: "Confirmado" })) !== null}
      >
        <Field label="Data de vigência em Pequim; deixe vazia se incerta"><Input type="date" value={reviewDay} onChange={(ev) => setReviewDay(ev.target.value)} /></Field>
      </ReasonDialog>
      <ReasonDialog
        open={dialog === "withdraw"}
        title={e.withdrawn ? "Restaurar acontecimento" : "Retirar acontecimento"}
        description={e.withdrawn ? "Após restaurar, reaparece na página e na API de reinícios." : "Após retirar, sai da página e da API de reinícios; use para duplicatas ou identificação incorreta."}
        danger={!e.withdrawn}
        confirmLabel={e.withdrawn ? "Restabelecido" : "Retirar"}
        busy={pending === "withdraw"}
        onClose={() => setDialog(null)}
        onSubmit={async (reason) => (await run("POST", `${base}/withdrawn`, { withdrawn: !e.withdrawn, reason, version }, { label: "withdraw", success: e.withdrawn ? "Restaurado" : "Retirado" })) !== null}
      />
      <ReasonDialog
        open={dialog === "move"}
        title="Mover publicação"
        description="Associe esta publicação a outro acontecimento ou remova a associação."
        confirmLabel="Mover"
        busy={pending === "move"}
        onClose={() => setDialog(null)}
        onSubmit={async (reason) =>
          (await run("POST", "/api/admin/monitor/relink", { postId: move!.postId, fromEventId: e.id, toEventId: move!.to || null, reason }, { label: "move", success: "Publicação movida" })) !== null
        }
      >
        <Field label="Acontecimento de destino">
          <Select value={move?.to ?? ""} onChange={(ev) => setMove({ ...move!, to: ev.target.value })}>
            <option value="">Remover: sem associação a acontecimento</option>
            {all.filter((x) => x.id !== e.id).slice(0, 60).map((x) => (
              <option key={x.id} value={x.id}>{bj(x.created_at)} · {KIND[x.type]} · {x.schedule?.label ?? x.id}</option>
            ))}
          </Select>
        </Field>
      </ReasonDialog>
    </article>
  );
}

function formOf(e: AdminMonitorEvent) {
  const p = e.presentation ?? {};
  return {
    type: e.type,
    status: e.status,
    precision: e.schedule?.precision === "exact" ? "window" : e.schedule?.precision ?? "",
    from: toLocal(e.schedule?.from),
    through: toLocal(e.schedule?.through),
    confirmedAt: toLocal(e.confirmed_at),
    audienceZh: String(p.audienceZh ?? ""),
    productsZh: String(p.productsZh ?? ""),
    scopeLabel: String(p.scopeLabel ?? ""),
  };
}

function PostRow({ post }: { post: AdminMonitorPost }) {
  const props = post.propositions ?? [];
  const { run, pending } = useAdminAction();
  const [dialog, setDialog] = useState<null | "skip" | "reviewed">(null);
  const resolve = async (action: "skip" | "reviewed", reason: string) =>
    (await run("POST", `/api/admin/monitor/posts/${post.id}/resolve`, { action, reason }, { label: action, success: action === "skip" ? "Ignorado" : "Marcado como verificado" })) !== null;
  return (
    <article className="rounded-panel bg-surface p-4 ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-3">
        <a href={post.url} target="_blank" rel="noreferrer" className="num hover:text-accent">{bj(post.published_at, true)}</a>
        {post.skipped ? <Badge>Ignorado</Badge> : post.relevant ? <Badge tone="accent">Relacionado</Badge> : post.processed_at ? <Badge>Não relacionado</Badge> : <Badge tone="warn">Aguardando identificação</Badge>}
        {post.needs_review && !post.reviewed && <Badge tone="bad">Exige revisão</Badge>}
        {post.reviewed && <Badge tone="ok">Verificado</Badge>}
        {post.failures && <Badge tone="bad" title={post.failures.error}>Falha na identificação {post.failures.count} vezes</Badge>}
        {post.links.map((l) => <Badge key={l.eventId} tone="info" title={l.eventId}>{l.stage}</Badge>)}
        <span className="ml-auto flex gap-1.5">
          {!post.processed_at && <Button size="sm" onClick={() => setDialog("skip")}>Ignorar</Button>}
          {post.needs_review && !post.reviewed && post.processed_at && <Button size="sm" onClick={() => setDialog("reviewed")}>Marcar como verificado</Button>}
        </span>
      </div>
      {post.held && post.held.length > 0 && (
        <div className="mt-2 rounded-control bg-bg-sunk px-3 py-2 text-[12.5px] text-ink-3">
          <div className="font-medium text-ink-2">Sem identificação aplicável automaticamente: citação ausente no original ou conclusão incerta</div>
          {post.held.map((h, i) => <div key={i}>{h.action} · “{h.excerpt}”</div>)}
        </div>
      )}
      <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">{post.translation ?? post.text}</p>
      {post.translation && <p className="mt-1 whitespace-pre-wrap text-[12.5px] text-ink-4">{post.text}</p>}
      {props.length > 0 && (
        <div className="mt-2 space-y-1">
          {props.map((p, i) => (
            <div key={i} className="flex flex-wrap items-center gap-1.5 text-[12px]">
              <Badge tone={p.real ? "ok" : "muted"}>{p.real ? "Real" : "Sem compromisso explícito"}</Badge>
              <Badge>{KIND[p.kind] ?? p.kind} · {p.action}</Badge>
              {p.relatesTo && <span className="font-mono text-ink-4">→ {p.relatesTo}</span>}
              <span className="text-ink-3">{p.excerptZh ?? p.excerpt}</span>
            </div>
          ))}
          <Json value={props} label="Resultado da identificação" />
        </div>
      )}
      <ReasonDialog
        open={dialog === "skip"}
        title="Ignorar esta publicação"
        description="Publicações são identificadas em ordem; uma falha persistente bloqueia as seguintes. Ignorar interrompe sua identificação e criação de acontecimento. Se houver reinício verdadeiro, trate-o manualmente na seção de acontecimentos."
        danger
        confirmLabel="Ignorar"
        busy={pending === "skip"}
        onClose={() => setDialog(null)}
        onSubmit={(reason) => resolve("skip", reason)}
      />
      <ReasonDialog
        open={dialog === "reviewed"}
        title="Marcar como verificado"
        description="O original já foi revisado: acontecimento corrigido ou confirmado, ou ação considerada desnecessária. A marcação remove a publicação da revisão e interrompe alertas."
        confirmLabel="Marcar"
        busy={pending === "reviewed"}
        onClose={() => setDialog(null)}
        onSubmit={(reason) => resolve("reviewed", reason)}
      />
    </article>
  );
}

export default function MonitorAdmin({ loaderData }: Route.ComponentProps) {
  const [sp] = useSearchParams();
  const tab = loaderData.tab;
  return (
    <AdminPage
      title="Reinícios do Codex"
      subtitle="Corrija tipo, estado, horário e público abrangido. Sem confirmação pública, use comprovante. Retire acontecimentos identificados incorretamente e mova publicações associadas ao destino errado."
      actions={<a className="text-[13px] text-accent" href="/codex-reset" target="_blank" rel="noreferrer">Abrir página pública</a>}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          <Link to="?tab=events" className={`rounded-full px-3.5 py-1.5 text-[13px] ${tab === "events" ? "bg-ink text-bg" : "bg-surface text-ink-2 ring-1 ring-line"}`}>Acontecimento</Link>
          <Link to="?tab=posts" className={`rounded-full px-3.5 py-1.5 text-[13px] ${tab === "posts" ? "bg-ink text-bg" : "bg-surface text-ink-2 ring-1 ring-line"}`}>Publicações e identificação</Link>
        </div>
        {tab === "events" ? (
          <Link to={sp.get("withdrawn") ? "?tab=events" : "?tab=events&withdrawn=1"} className="text-[12.5px] text-ink-3 hover:text-ink">{sp.get("withdrawn") ? "Ocultar retirados" : "Incluir retirados"}</Link>
        ) : (
          <FilterChips param="filter" options={[{ value: "relevant", label: "Relacionado" }, { value: "review", label: "Revisão pendente" }, { value: "pending", label: "Aguardando identificação" }, { value: "all", label: "Todos" }]} />
        )}
      </div>
      {loaderData.events && (
        <div className="space-y-3">
          {loaderData.events.events.length ? loaderData.events.events.map((e) => <EventCard key={`${e.id}-${e.updated_at}`} e={e} all={loaderData.events!.events} />) : <Card><Empty>Sem acontecimentos</Empty></Card>}
        </div>
      )}
      {loaderData.posts && (
        <>
          <div className="space-y-3">{loaderData.posts.rows.length ? loaderData.posts.rows.map((p) => <PostRow key={p.id} post={p} />) : <Card><Empty>Nenhuma publicação corresponde aos filtros</Empty></Card>}</div>
          <Pager page={loaderData.posts.page} hasMore={loaderData.posts.rows.length === 50} />
        </>
      )}
    </AdminPage>
  );
}
