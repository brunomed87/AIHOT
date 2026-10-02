import { SITE } from "@aihot/industry/site";
import { useRef } from "react";
import { Link } from "react-router";
import type { AdminSelectBenchRuns } from "@aihot/contracts/admin";
import type { Route } from "./+types/selectbench";
import { adminGet } from "../../lib/admin.server";
import { useAdminAction } from "../../features/admin/action";
import { bj, num, pct } from "../../features/admin/format";
import { AdminPage, Badge, Button, Card, Empty } from "../../features/admin/ui";
import { toast } from "../../features/admin/toast";


export async function loader({ request }: Route.LoaderArgs) {
  return adminGet<AdminSelectBenchRuns>(request, "/api/admin/selectbench");
}

export const meta: Route.MetaFunction = () => [{ title: `SelectBench · ${SITE.name} Painel administrativo` }];

export default function SelectBench({ loaderData }: Route.ComponentProps) {
  const { run, pending } = useAdminAction();
  const file = useRef<HTMLInputElement>(null);
  return (
    <AdminPage
      title="SelectBench"
      subtitle="Compare decisões de seleção entre modelos no mesmo conjunto rotulado por humanos. Execuções de scripts/eval-selection.ts são importadas automaticamente; você também pode enviar o arquivo do relatório."
      actions={
        <>
          <input
            ref={file}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                const report = JSON.parse(await f.text());
                await run("POST", "/api/admin/selectbench/import", { label: f.name.replace(/\.json$/, ""), report }, { label: "import", success: "Importado" });
              } catch {
                toast("O arquivo não é um relatório JSON válido", "error");
              }
            }}
          />
          <Button busy={pending === "import"} onClick={() => file.current?.click()}>Importar relatório</Button>
        </>
      }
    >
      {loaderData.runs.length ? (
        <div className="space-y-4">
          {loaderData.runs.map((r) => {
            const best = [...r.models].sort((a, b) => (r.summary[b]?.f1 ?? 0) - (r.summary[a]?.f1 ?? 0))[0];
            return (
              <Card
                key={r.id}
                title={<Link to={`/admin/selectbench/${r.id}`} className="hover:text-accent">{r.label}</Link>}
                right={<span>{bj(r.created_at, true)} · {r.split ?? "—"} · {num(r.sample_size)} itens · {r.prompt_version ?? "Versão do prompt não registrada"}</span>}
                pad={false}
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-[13px]">
                    <thead>
                      <tr className="border-b border-line text-left text-[12px] text-ink-3">
                        {["Modelo", "Acurácia", "Precisão", "Revocação", "F1", "Proporção selecionada", "Seleção do conjunto de referência", "Falhas", "Duração média", "Tokens de entrada / saída"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {r.models.map((m) => {
                        const s = r.summary[m] ?? {};
                        return (
                          <tr key={m} className="border-b border-line/70 last:border-0">
                            <td className="px-3 py-2 font-medium text-ink">{m} {m === best && r.models.length > 1 && <Badge tone="accent">Maior F1</Badge>}</td>
                            <td className="num px-3 py-2">{pct(s.accuracy)}</td>
                            <td className="num px-3 py-2">{pct(s.precision)}</td>
                            <td className="num px-3 py-2">{pct(s.recall)}</td>
                            <td className="num px-3 py-2 font-semibold text-ink">{pct(s.f1)}</td>
                            <td className="num px-3 py-2">{pct(s.selectedRate)}</td>
                            <td className="num px-3 py-2">{pct(s.goldSelectRate)}</td>
                            <td className="num px-3 py-2">{s.errors ? <span className="text-hot">{s.errors}</span> : 0}</td>
                            <td className="num px-3 py-2">{s.avgLatencyMs ? `${(s.avgLatencyMs / 1000).toFixed(1)}s` : "—"}</td>
                            <td className="num px-3 py-2 text-ink-3">{num(s.tokensIn)} / {num(s.tokensOut)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between border-t border-line px-4 py-2 text-[12.5px] text-ink-3">
                  <span>{r.cases ? `${num(r.cases)} resultados individuais` : "Somente resumo: formato antigo"}</span>
                  {r.cases > 0 && <Link className="text-accent" to={`/admin/selectbench/${r.id}`}>Consultar individualmente</Link>}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card><Empty>Ainda não há comparações. Execute scripts/eval-selection.ts para importá-las automaticamente.</Empty></Card>
      )}
    </AdminPage>
  );
}
