import { SITE } from "@aihot/industry/site";
import { Form, Link, useNavigate, useSearchParams } from "react-router";
import type { AdminContentRow, AdminContentSearch } from "@aihot/contracts/admin";
import type { Route } from "./+types/content";
import { adminGet } from "../../lib/admin.server";
import { VISIBILITY_LABEL } from "../../features/admin/labels";
import { AdminPage, Badge, Button, Card, DataTable, Empty, Input, Time } from "../../features/admin/ui";


export async function loader({ request }: Route.LoaderArgs) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return { q, rows: [] as AdminContentRow[] };
  const { rows } = await adminGet<AdminContentSearch>(request, `/api/admin/content?q=${encodeURIComponent(q)}`);
  return { q, rows };
}

export const meta: Route.MetaFunction = () => [{ title: `Diagnóstico de conteúdo · ${SITE.name} Painel administrativo` }];

export default function Content({ loaderData }: Route.ComponentProps) {
  const { q, rows } = loaderData;
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  return (
    <AdminPage title="Diagnóstico de conteúdo" subtitle="Encontre conteúdos por ID, link original ou título e consulte o fluxo entre fonte e saída pública. Retirada, resumo, correções manuais e reprocessamento ficam nos detalhes.">
      <Form method="get" className="mb-5 flex max-w-2xl gap-2">
        <Input name="q" defaultValue={sp.get("q") ?? ""} placeholder="ID, URL ou palavras do título" aria-label="Buscar conteúdo" autoFocus />
        <Button type="submit" tone="primary">Buscar</Button>
      </Form>
      {q && (
        <Card pad={false} title={`“${q}e seus resultados`} right={<span>{rows.length === 50 ? "Somente os 50 mais recentes" : `${rows.length} itens`}</span>}>
          <DataTable
            rows={rows}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(`/admin/content/${r.id}`)}
            empty="Nada encontrado. URLs são normalizadas antes da comparação; títulos permitem busca por trechos em diferentes idiomas."
            columns={[
              {
                key: "t",
                label: "Título",
                render: (r) => (
                  <div className="min-w-[320px]">
                    <Link to={`/admin/content/${r.id}`} className="font-medium text-ink hover:text-accent" onClick={(e) => e.stopPropagation()}>{r.title}</Link>
                    <div className="font-mono text-[11.5px] text-ink-4">{r.id}</div>
                  </div>
                ),
              },
              { key: "src", label: "Fonte", render: (r) => <span className="whitespace-nowrap">{r.source}</span> },
              {
                key: "st",
                label: "Estado",
                render: (r) => (
                  <span className="flex flex-wrap gap-1">
                    {r.selected && <Badge tone="accent">Destaques</Badge>}
                    {r.visibility && <Badge tone={r.visibility === "public" ? "muted" : "warn"}>{VISIBILITY_LABEL[r.visibility] ?? r.visibility}</Badge>}
                    {!r.visibility && <Badge>{r.processing_state}</Badge>}
                  </span>
                ),
              },
              { key: "sc", label: "Pontuação", align: "right", render: (r) => r.score ?? "—" },
              { key: "d", label: "Descoberto", render: (r) => <Time at={r.discovered_at} /> },
            ]}
          />
        </Card>
      )}
      {!q && <Empty>Informe ID, link ou título para buscar.</Empty>}
    </AdminPage>
  );
}
