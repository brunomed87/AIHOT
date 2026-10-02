import { SITE } from "@aihot/industry/site";
import { useState } from "react";
import { Link, useFetcher } from "react-router";
import { useEffect } from "react";
import type { Route } from "./+types/runs";
import type { AdminDeliveryIssue, AdminReceiptIssue, AdminRuns } from "@aihot/contracts/admin";
import { adminGet } from "../../lib/admin.server";
import { useAdminAction } from "../../features/admin/action";
import { ago, bj, duration, num } from "../../features/admin/format";
import { AdminPage, Badge, Button, Card, DataTable, Dot, Empty, Field, Json, ReasonDialog, Select, Stat, Time } from "../../features/admin/ui";

export async function loader({ request }: Route.LoaderArgs) {
  return adminGet<AdminRuns>(request, "/api/admin/runs");
}

export const meta: Route.MetaFunction = () => [{ title: `Execução · ${SITE.name} Painel administrativo` }];

const STATE_LABEL: Record<string, string> = { created: "Na fila", retry: "Aguardando nova tentativa", active: "Em execução" };

export default function RunsAdmin({ loaderData }: Route.ComponentProps) {
  const refresh = useFetcher<typeof loader>();
  const r = refresh.data ?? loaderData;
  const { run, pending } = useAdminAction();
  const [receipt, setReceipt] = useState<AdminReceiptIssue | null>(null);
  const [billed, setBilled] = useState("false");
  const [delivery, setDelivery] = useState<AdminDeliveryIssue | null>(null);
  const [outcome, setOutcome] = useState<"sent" | "drop" | "resend">("sent");
  // Failure group to put back into processing ("" = every failure of the last 30 days).
  const [requeue, setRequeue] = useState<string | null>(null);

  // Live view: refresh every 20 s while visible.
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && refresh.state === "idle" && refresh.load("/admin/runs"), 20_000);
    return () => clearInterval(t);
  }, [refresh]);

  const backlog = new Map<string, Record<string, { n: number; oldest: string }>>();
  for (const q of r.queues) backlog.set(q.name, { ...(backlog.get(q.name) ?? {}), [q.state]: { n: q.n, oldest: q.oldest } });
  const queued = r.queues.filter((q) => q.state !== "active").reduce((a, q) => a + q.n, 0);
  const worker = r.processes.find((p) => p.role === "worker");
  const failing = r.jobs.filter((j) => j.status === "failed");

  return (
    <AdminPage title="Execução" subtitle={<>Tarefas, filas, atrasos de fontes, recibos e envios para revisão. Atualiza a cada 20 segundos · última verificação {bj(r.checkedAt)}</>}>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat
          label="worker"
          value={<span className="inline-flex items-center gap-2 text-[18px]"><Dot tone={worker?.alive ? "ok" : "bad"} />{worker ? (worker.alive ? "Executando" : "Sinal de atividade interrompido") : "Sem sinal de atividade"}</span>}
          hint={worker ? `${worker.host} · sinal de atividade ${ago(worker.at)}` : "Worker não informou atividade"}
        />
        <Stat label="Acúmulo na fila" value={num(queued)} tone={queued > 500 ? "warn" : undefined} hint="Na fila ou aguardando nova tentativa" />
        <Stat label="Tarefas agendadas com falha" value={num(failing.length)} tone={failing.length ? "bad" : "ok"} hint="Última execução falhou" />
        <Stat label="Recibos com resultado desconhecido" value={num(r.receipts.issues.filter((x) => x.status === "unknown").length)} tone={r.receipts.issues.some((x) => x.status === "unknown") ? "bad" : "ok"} hint={`7 dias ${num(Object.values(r.receipts.counts).reduce((a, b) => a + b, 0))} solicitações pagas`} />
        <Stat label="Envios a verificar" value={num(r.deliveries.filter((d) => d.status === "unknown").length)} tone={r.deliveries.some((d) => d.status === "unknown") ? "bad" : "ok"} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Fila" pad={false}>
          <DataTable
            dense
            rows={[...backlog.entries()]}
            rowKey={([name]) => name}
            empty="Fila vazia"
            columns={[
              { key: "n", label: "Fila", render: ([name]) => <span className="font-mono text-[12.5px]">{name}</span> },
              ...(["created", "retry", "active"] as const).map((st) => ({
                key: st,
                label: STATE_LABEL[st],
                align: "right" as const,
                render: ([, v]: [string, Record<string, { n: number; oldest: string }>]) => (v[st] ? <span title={`Mais antigo ${bj(v[st]!.oldest, true)}`}>{num(v[st]!.n)}</span> : <span className="text-ink-4">0</span>),
              })),
              { key: "old", label: "Entrada mais antiga na fila", render: ([, v]) => <Time at={v.created?.oldest ?? v.retry?.oldest ?? null} /> },
            ]}
          />
        </Card>
        <Card title="Tarefas agendadas" pad={false}>
          <DataTable
            dense
            rows={r.jobs}
            rowKey={(j) => j.job}
            columns={[
              { key: "j", label: "Tarefa", render: (j) => <span className="font-mono text-[12.5px]">{j.job}</span> },
              { key: "s", label: "Última execução", render: (j) => <Badge tone={j.status === "ok" ? "ok" : j.status === "failed" ? "bad" : "muted"} title={j.error ?? undefined}>{j.status ?? "Executando"}</Badge> },
              { key: "at", label: "Horário", render: (j) => <Time at={j.started_at} /> },
              { key: "d", label: "Duração", align: "right", render: (j) => duration(j.started_at, j.finished_at) },
              { key: "f", label: "Falhas em 24 horas", align: "right", render: (j) => (j.failed_24h ? <span className="text-hot">{j.failed_24h}/{j.runs_24h}</span> : `0/${j.runs_24h}`) },
            ]}
          />
        </Card>
      </div>

      {r.failedJobs.length > 0 && (
        <Card className="mt-5" title="Tarefas de fila que falharam nas últimas 24 horas" pad={false}>
          <DataTable
            dense
            rows={r.failedJobs}
            rowKey={(j) => j.name}
            columns={[
              { key: "n", label: "Fila", render: (j) => <span className="font-mono text-[12.5px]">{j.name}</span> },
              { key: "c", label: "Falhas", align: "right", render: (j) => num(j.failed) },
              { key: "l", label: "Recentes", render: (j) => <Time at={j.last} /> },
              { key: "o", label: "Erro recente", render: (j) => <span className="line-clamp-2 font-mono text-[11.5px] text-ink-3">{j.last_output}</span> },
            ]}
          />
        </Card>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title="Recibos pagos que exigem verificação" right={<span>{Object.entries(r.receipts.counts).map(([k, v]) => `${k} ${v}`).join(" · ")}</span>} pad={false}>
          <DataTable
            dense
            rows={r.receipts.issues}
            rowKey={(x) => x.id}
            empty="Nenhum recibo pendente"
            columns={[
              { key: "id", label: "Recibo", render: (x) => <span className="num">#{x.id}</span> },
              { key: "s", label: "Estado", render: (x) => <Badge tone={x.status === "unknown" ? "bad" : "warn"}>{x.status}</Badge> },
              { key: "w", label: "Serviço", render: (x) => <span className="whitespace-nowrap">{x.service}{x.model ? ` · ${x.model}` : ""}</span> },
              { key: "p", label: "Finalidade", render: (x) => (x.subject && /^[\w-]{10,}$/.test(x.subject) && x.purpose.includes("analy") ? <Link className="text-accent" to={`/admin/content/${x.subject}`}>{x.purpose}</Link> : x.purpose) },
              { key: "e", label: "Erro", render: (x) => <span className="line-clamp-2 text-[12px] text-ink-3" title={x.error ?? ""}>{x.error}</span> },
              { key: "a", label: "", render: (x) => (x.status === "unknown" ? <Button size="sm" onClick={() => setReceipt(x)}>Verificar</Button> : null) },
            ]}
          />
        </Card>
        <Card title="Envios que exigem verificação" pad={false}>
          <DataTable
            dense
            rows={r.deliveries}
            rowKey={(d) => d.id}
            empty="Nenhum envio pendente de verificação"
            columns={[
              { key: "t", label: "Destino", render: (d) => d.target_key },
              { key: "s", label: "Estado", render: (d) => <Badge tone={d.status === "unknown" ? "bad" : "warn"}>{d.status}</Badge> },
              { key: "sub", label: "Conteúdo", render: (d) => (d.subject_kind === "selected" ? <Link className="text-accent" to={`/admin/content/${d.subject_id}`}>{d.subject_id}</Link> : `${d.subject_kind} ${d.subject_id}`) },
              { key: "at", label: "Horário", render: (d) => <Time at={d.updated_at} /> },
              { key: "a", label: "", render: (d) => <Button size="sm" onClick={() => setDelivery(d)}>Processamento</Button> },
            ]}
          />
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title="Fontes atrasadas ou com falha" right={<Link className="text-accent" to="/admin/sources?health=failing">Todas as fontes com falha</Link>} pad={false}>
          <DataTable
            dense
            rows={r.lagging}
            rowKey={(s) => s.id}
            empty="Todas as fontes coletadas no prazo"
            columns={[
              { key: "n", label: "Fonte", render: (s) => <Link className="text-ink hover:text-accent" to={`/admin/sources/${encodeURIComponent(s.id)}`}>{s.name}</Link> },
              { key: "h", label: "Saúde", render: (s) => <Badge tone={s.health === "failing" ? "bad" : s.health === "degraded" ? "warn" : "muted"}>{s.health}</Badge> },
              { key: "ok", label: "Último sucesso", render: (s) => <Time at={s.last_ok_at} /> },
              { key: "nx", label: "Próxima coleta prevista", render: (s) => <Time at={s.next_fetch_at} /> },
              { key: "e", label: "Erro", render: (s) => <span className="line-clamp-1 text-[12px] text-ink-3" title={s.last_error ?? ""}>{s.last_error}</span> },
            ]}
          />
        </Card>
        <Card
          title="Falhas de processamento em 30 dias, por erro"
          right={
            <span className="flex items-center gap-3">
              {r.retrying.count > 0 && <span>Aguardando nova tentativa {num(r.retrying.count)} itens · próxima tentativa <Time at={r.retrying.next} /></span>}
              {r.errors.length > 0 && <Button size="sm" onClick={() => setRequeue("")}>Reprocessar tudo</Button>}
            </span>
          }
          pad={false}
        >
          <DataTable
            dense
            rows={r.errors}
            rowKey={(e) => e.error}
            empty="Nenhuma falha de processamento"
            columns={[
              { key: "e", label: "Erro", render: (e) => <span className="font-mono text-[11.5px] text-ink-2">{e.error}</span> },
              { key: "n", label: "Quantidade", align: "right", render: (e) => num(e.n) },
              { key: "x", label: "Exemplo", render: (e) => <Link className="text-accent" to={`/admin/content/${e.example}`}>Ver</Link> },
              { key: "l", label: "Recentes", render: (e) => <Time at={e.last} /> },
              { key: "a", label: "", align: "right", render: (e) => <Button size="sm" onClick={() => setRequeue(e.error)}>Reprocessar</Button> },
            ]}
          />
        </Card>
      </div>

      {r.leaderboard && (
        <Card
          className="mt-5"
          title="Fontes de avaliação do ranking de modelos"
          right={<span>Última coleta {bj(r.leaderboard.at)} · sucesso {r.leaderboard.sources.filter((x) => x.ok).length}/{r.leaderboard.sources.length}</span>}
          pad={false}
        >
          <div className="max-h-[360px] overflow-y-auto">
            <DataTable
              dense
              rows={r.leaderboard.sources}
              rowKey={(x) => x.key}
              columns={[
                { key: "k", label: "Fonte", render: (x) => <span className="font-mono text-[12.5px]">{x.key}</span> },
                { key: "s", label: "Coleta anterior", render: (x) => <Badge tone={x.ok ? "ok" : "bad"}>{x.ok ? (x.changed ? "Atualizado" : "Sem alterações") : "Falhas"}</Badge> },
                { key: "ok", label: "Último sucesso", render: (x) => <Time at={x.lastOkAt} /> },
                { key: "n", label: "Número de linhas", align: "right", render: (x) => (x.rows == null ? "—" : num(x.rows)) },
                { key: "e", label: "Erro", render: (x) => <span className="line-clamp-1 text-[12px] text-ink-3" title={x.error ?? ""}>{x.error}</span> },
              ]}
            />
          </div>
        </Card>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title="Cronologia das tarefas" pad={false}>
          <div className="max-h-[420px] overflow-y-auto">
            <DataTable
              dense
              rows={r.timeline}
              rowKey={(t) => t.id}
              columns={[
                { key: "at", label: "Início", render: (t) => <span className="num whitespace-nowrap">{bj(t.started_at)}</span> },
                { key: "j", label: "Tarefa", render: (t) => <span className="font-mono text-[12px]">{t.job}</span> },
                { key: "s", label: "Resultado", render: (t) => <Badge tone={t.status === "ok" ? "ok" : t.status === "failed" ? "bad" : "muted"} title={t.error ?? undefined}>{t.status ?? "Executando"}</Badge> },
                { key: "d", label: "Duração", align: "right", render: (t) => duration(t.started_at, t.finished_at) },
              ]}
            />
          </div>
        </Card>
        <Card title="Recebimento externo" pad={false}>
          {r.ingest.length ? (
            <DataTable
              dense
              rows={r.ingest}
              rowKey={(e) => `${e.client}-${e.created_at}`}
              columns={[
                { key: "at", label: "Horário", render: (e) => <Time at={e.created_at} /> },
                { key: "c", label: "Cliente", render: (e) => e.client },
                { key: "k", label: "Tipo", render: (e) => e.kind },
                { key: "s", label: "Resultado", render: (e) => <Badge tone={e.status === "ok" ? "ok" : e.status === "error" ? "bad" : "muted"} title={e.error ?? undefined}>{e.status}</Badge> },
                { key: "x", label: "Resumo", render: (e) => <Json value={e.summary} label="Resumo" /> },
              ]}
            />
          ) : (
            <Empty>Sem recebimentos externos de monitor de capturas WeChat ou scripts de coleta</Empty>
          )}
        </Card>
      </div>

      {r.processes.length > 0 && (
        <Card className="mt-5" title="Processo">
          <ul className="grid gap-2 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
            {r.processes.map((p) => (
              <li key={p.role} className="flex items-center gap-2">
                <Dot tone={p.alive ? "ok" : "bad"} />
                <span className="font-medium">{p.role}</span>
                <span className="text-ink-3">{p.host} · pid {p.pid} · {p.release} · iniciado em {bj(p.startedAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ReasonDialog
        open={!!receipt}
        title={`Verificar recibo #${receipt?.id ?? ""}`}
        description="Solicitações de resultado desconhecido não são reenviadas automaticamente. Confira no painel do fornecedor se houve cobrança antes de liberar. A próxima execução fará uma nova chamada."
        confirmLabel="Registrar e liberar"
        busy={pending === "release"}
        onClose={() => setReceipt(null)}
        onSubmit={async (note) => (await run("POST", `/api/admin/receipts/${receipt!.id}/release`, { billed: billed === "true", note }, { label: "release", success: "Liberado" })) !== null}
      >
        <Field label="O fornecedor cobrou?">
          <Select value={billed} onChange={(e) => setBilled(e.target.value)}>
            <option value="false">Sem cobrança: solicitação não aceita</option>
            <option value="true">Cobrado: resultado não recuperado</option>
          </Select>
        </Field>
      </ReasonDialog>
      <ReasonDialog
        open={requeue !== null}
        title={requeue ? "Reprocessar este tipo de falha" : "Reprocessar todas as falhas"}
        description="As matérias voltarão às filas de texto, avaliação e publicação. Novas chamadas serão cobradas; recusas do fornecedor podem se repetir."
        confirmLabel="Reprocessar"
        busy={pending === "requeue"}
        onClose={() => setRequeue(null)}
        onSubmit={async (reason) => (await run("POST", "/api/admin/processing/requeue", { group: requeue || null, reason }, { label: "requeue", success: "Recolocado na fila" })) !== null}
      />
      <ReasonDialog
        open={!!delivery}
        title="Tratar envio"
        description="Confira primeiro o recebimento no grupo Feishu. Reenvie somente se não chegou; o ambiente de desenvolvimento não envia de verdade."
        confirmLabel="Confirmar"
        danger={outcome === "resend"}
        busy={pending === "delivery"}
        onClose={() => setDelivery(null)}
        onSubmit={async (note) => (await run("POST", `/api/admin/deliveries/${delivery!.id}/resolve`, { outcome, note }, { label: "delivery", success: "Tratado" })) !== null}
      >
        <Field label="Resultado">
          <Select value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)}>
            <option value="sent">Recebido no grupo: marcar como entregue</option>
            <option value="drop">Não enviar novamente</option>
            <option value="resend">Não recebido no grupo: reenviar</option>
          </Select>
        </Field>
      </ReasonDialog>
    </AdminPage>
  );
}
