import { SITE } from "@aihot/industry/site";
import { Fragment, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { CATEGORY_LABELS } from "@aihot/contracts/taxonomy";
import type { AdminSelectBenchCases, AdminSelectBenchDecision } from "@aihot/contracts/admin";
import type { Route } from "./+types/selectbench-run";
import { adminGet } from "../../lib/admin.server";
import { bj, num, pct } from "../../features/admin/format";
import { AdminPage, Badge, Card, Empty, FilterChips, Select } from "../../features/admin/ui";


export async function loader({ request, params }: Route.LoaderArgs) {
  return adminGet<AdminSelectBenchCases>(request, `/api/admin/selectbench/${encodeURIComponent(params.runId)}${new URL(request.url).search}`);
}

export const meta: Route.MetaFunction = ({ loaderData }) => [{ title: `${loaderData?.run.label ?? "SelectBench"} · ${SITE.name} Painel administrativo` }];

const GOLD: Record<string, [string, "accent" | "muted" | "info"]> = { select: ["Deve ser selecionado", "accent"], reject: ["Não selecionar", "muted"], either: ["Ambíguo", "info"] };

function verdict(d: AdminSelectBenchDecision | undefined, gold: string) {
  if (!d) return <span className="text-ink-4">—</span>;
  if (d.decision === null) return <Badge tone="bad" title={d.error ?? undefined}>Falhas</Badge>;
  const right = gold === "either" || d.decision === gold;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge tone={right ? (d.decision === "select" ? "ok" : "muted") : "bad"}>{d.decision === "select" ? "Selecionado" : "Não selecionar"}</Badge>
      <span className="num text-[12px] text-ink-3">{d.score ?? "—"}</span>
    </span>
  );
}

export default function SelectBenchRun({ loaderData: d }: Route.ComponentProps) {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const [open, setOpen] = useState<string | null>(null);
  const model = sp.get("model") ?? d.run.models[0]!;
  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(sp);
    if (v) next.set(k, v);
    else next.delete(k);
    navigate(`?${next}`, { preventScrollReset: true });
  };
  return (
    <AdminPage
      title={d.run.label}
      subtitle={<>{bj(d.run.created_at, true)} · {d.run.split ?? "—"} · {num(d.run.sample_size)} itens · prompt {d.run.prompt_version ?? "Não registrado"} · <Link className="text-accent" to="/admin/selectbench">Todas as execuções</Link></>}
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {d.run.models.map((m) => {
          const s = d.run.summary[m] ?? {};
          return (
            <button key={m} onClick={() => set("model", m)} className={`rounded-panel p-4 text-left ring-1 transition-colors ${m === model ? "bg-accent-softer ring-accent/40" : "bg-surface ring-line hover:bg-bg-sunk/60"}`}>
              <div className="text-[13.5px] font-semibold text-ink">{m}</div>
              <div className="num mt-1.5 text-[22px] font-semibold tracking-tight text-ink">F1 {pct(s.f1)}</div>
              <div className="num mt-0.5 text-[12px] text-ink-3">Acurácia {pct(s.accuracy)} · precisão {pct(s.precision)} · revocação {pct(s.recall)}</div>
              <div className="num mt-0.5 text-[12px] text-ink-4">Seleções indevidas {s.fp ?? "—"} · omissões {s.fn ?? "—"} · falhas {s.errors ?? 0}</div>
            </button>
          );
        })}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <FilterChips
          param="outcome"
          options={[
            { value: "", label: "Todos" },
            { value: "fp", label: "Seleções indevidas" },
            { value: "fn", label: "Omitido" },
            { value: "tp", label: "Seleção correta" },
            { value: "tn", label: "Exclusão correta" },
            { value: "either", label: "Ambíguo" },
            { value: "error", label: "Falhas" },
          ]}
        />
        <Select className="!w-auto" aria-label="Estratos das amostras" value={sp.get("stratum") ?? ""} onChange={(e) => set("stratum", e.target.value || null)}>
          <option value="">Todos os estratos</option>
          {d.strata.map((s) => <option key={s.stratum ?? "none"} value={s.stratum ?? ""}>{s.stratum ?? "Sem estrato"}({s.n})</option>)}
        </Select>
        <label className="inline-flex items-center gap-2 text-[13px] text-ink-2">
          <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={sp.get("disagree") === "1"} onChange={(e) => set("disagree", e.target.checked ? "1" : null)} />
          Somente divergências entre modelos
        </label>
        <span className="text-[12.5px] text-ink-4">{d.rows.length === 400 ? "Exibindo até 400 itens" : `${d.rows.length} itens`} · filtro por {model}</span>
      </div>
      <Card pad={false}>
        {d.rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[12px] text-ink-3">
                  <th className="px-3 py-2 font-medium">Amostras</th>
                  <th className="px-3 py-2 font-medium">Referência humana</th>
                  {d.run.models.map((m) => <th key={m} className="px-3 py-2 font-medium">{m}</th>)}
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r) => (
                  <Fragment key={r.case_id}>
                    <tr className="cursor-pointer border-b border-line/70 hover:bg-bg-sunk/50" onClick={() => setOpen(open === r.case_id ? null : r.case_id)}>
                      <td className="max-w-[420px] px-3 py-2.5">
                        <div className="line-clamp-2 text-ink">{r.title}</div>
                        <div className="mt-0.5 text-[11.5px] text-ink-4">{r.stratum ?? "—"} · {r.case_id}</div>
                      </td>
                      <td className="px-3 py-2.5"><Badge tone={GOLD[r.gold]?.[1] ?? "muted"}>{GOLD[r.gold]?.[0] ?? r.gold}</Badge></td>
                      {d.run.models.map((m) => <td key={m} className="px-3 py-2.5">{verdict(r.by_model[m], r.gold)}</td>)}
                    </tr>
                    {open === r.case_id && (
                      <tr className="border-b border-line/70 bg-bg-sunk/40">
                        <td colSpan={2 + d.run.models.length} className="px-3 py-3">
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {d.run.models.map((m) => {
                              const x = r.by_model[m];
                              return (
                                <div key={m} className="rounded-control bg-surface p-3 ring-1 ring-line">
                                  <div className="mb-1 flex items-center justify-between text-[12px] text-ink-3"><span className="font-medium text-ink-2">{m}</span>{x?.category && <span>{CATEGORY_LABELS[x.category as keyof typeof CATEGORY_LABELS] ?? x.category}</span>}</div>
                                  <div className="text-[12.5px] leading-relaxed text-ink-2">{x?.error ?? x?.reason ?? "(sem justificativa)"}</div>
                                  <div className="mt-1 text-[11.5px] text-ink-4">Relevância {x?.relevance ?? "—"}{x?.receiptId ? ` · recibo #${x.receiptId}` : ""}</div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Nenhuma amostra corresponde aos filtros</Empty>
        )}
      </Card>
    </AdminPage>
  );
}
