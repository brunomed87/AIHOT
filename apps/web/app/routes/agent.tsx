import { useEffect, useState, type ReactNode } from "react";
import { Link, useLoaderData, useNavigate, useSearchParams } from "react-router";
import type { Route } from "./+types/agent";
import { SITE, withSubject } from "@aihot/industry/site";
import { FEATURES } from "@aihot/industry/features";
import { CATEGORY_KEYS } from "@aihot/contracts/taxonomy";
import { MCP_TOOL_NAMES as T } from "@aihot/contracts/mcp";
import { listPath, pageMeta, siteUrl } from "../lib/seo";
import { CodeBlock, CopyButton } from "../components/CodeBlock";
import { IconArrowUpRight, IconChevronRight } from "../components/icons";
import { AsideCard, ReadingLayout } from "../components/ui/Page";
import { PillTabs } from "../components/ui/Tabs";

/** Shared caches may keep this page for five minutes. */
export function headers() {
  return { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600" };
}

const MCP_VERSION = "2.0.0";
/** The machine-readable entry points, with what each one is for. */
const RESOURCES: Array<[label: string, href: string, note: string]> = [
  ["Markdown para agentes", "/api/v1/agent", "Instruções e respostas para agentes"],
  ["llms.txt", "/llms.txt", "Descrição do site para modelos de linguagem"],
  ["Servidor MCP", "/api/mcp", "Endereço de conexão para clientes MCP"],
  ["OpenAPI 3.1", "/openapi-v1.json", "Definição completa da API REST v1"],
];

const TABS = [
  { key: "markdown", label: "Markdown para agentes" },
  { key: "mcp", label: "MCP" },
  { key: "rss", label: "RSS" },
  { key: "api", label: "API REST" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export async function loader({ request }: Route.LoaderArgs) {
  const tab = new URL(request.url).searchParams.get("tab");
  let healthy = true;
  try {
    const res = await fetch(`${process.env.API_BASE_URL || "http://127.0.0.1:3001"}/api/health`, { signal: AbortSignal.any([request.signal, AbortSignal.timeout(3000)]) });
    healthy = res.ok;
  } catch {
    healthy = false;
  }
  // The public address the examples show is the configured one, the same on the server and in the browser.
  return { tab: (TABS.some((t) => t.key === tab) ? tab : "mcp") as TabKey, healthy, base: siteUrl() };
}

export function meta({ loaderData }: Route.MetaArgs) {
  // Only the tab is part of the address (mcp is the default and not written).
  const path = listPath("/agent", { tab: loaderData && loaderData.tab !== "mcp" ? loaderData.tab : null });
  return pageMeta({ title: "Integração com agentes", description: `Permita que agentes consultem ${SITE.name}: Markdown, MCP, RSS e API REST v1, com leitura anônima.`, path, image: "/og/pages/agent.png" });
}

function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="mt-10 scroll-mt-24">
      <h3 className="mb-3 text-[16px] font-bold text-ink">{title}</h3>
      <div className="text-[13.5px] leading-[1.85] text-ink-2">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2"><span className="mt-[11px] size-1 shrink-0 rounded-full bg-ink-4" /><span>{it}</span></li>
      ))}
    </ul>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return <code className="mono rounded-mark bg-bg-sunk px-1.5 py-0.5 text-[0.88em] text-ink">{children}</code>;
}

function MarkdownTab({ base }: { base: string }) {
  const guide = `${base}/api/v1/agent`;
  const prompt = `Primeiro, leia ${guide} e suas instruções. Pelos endereços fornecidos, consulte as notícias mais importantes das últimas 24 horas sobre ${SITE.subject} , incluindo fontes e links de leitura.`;
  return <>
    <h2 className="text-[20px] font-bold text-ink">Um endereço para o agente começar a consultar</h2>
    <p className="mt-2 text-[14.5px] leading-relaxed text-ink-3">Para agentes que leem páginas web. As instruções descrevem notícias recentes, busca, repercussão, acontecimentos e relatórios diários. As respostas incluem fontes, horários e links. Atualizações das capacidades aparecem no mesmo endereço.</p>
    <div className="mt-6 flex items-center gap-2 rounded-card border border-line bg-surface p-3">
      <a href="/api/v1/agent" className="min-w-0 flex-1 truncate font-mono text-[13px] text-accent">{guide}</a>
      <CopyButton text={guide} className="!text-ink-3" />
    </div>
    <Section title="Copie esta instrução para seu agente">
      <div className="rounded-card border border-line bg-surface p-4"><p>{prompt}</p><CopyButton text={prompt} label="Copiar pergunta" className="mt-3" /></div>
    </Section>
    <Section title="Conteúdo disponível para leitura">
      <Bullets items={[
        "Notícias recentes e busca: últimas 24 horas ou sete dias, com filtros por categoria.",
        "Mais discutidos: siga a ordem do ranking e consulte os endereços de acontecimentos retornados para entender o contexto.",
        `${withSubject("Relatório diário")}: última edição ou publicação de uma data específica.`,
        "Os dados vêm de fontes externas. Confirme fatos importantes no original.",
      ]} />
    </Section>
  </>;
}

function McpTab({ base }: { base: string }) {
  const url = `${base}/api/mcp`;
  const name = SITE.mcpPrefix;
  return (
    <>
      <h2 className="text-[20px] font-bold text-ink">Conecte um endereço para utilizar as ferramentas MCP</h2>
      <p className="mt-2 text-[14.5px] text-ink-3">Para agentes e ferramentas que aceitam MCP remoto. Streamable HTTP padrão, anônimo e somente leitura, sem token. As ferramentas retornam texto breve e dados estruturados correspondentes.</p>
      <div className="mt-6 flex items-center gap-2 rounded-card border border-line bg-surface p-3">
        <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-ink">{url}</code>
        <CopyButton text={url} className="!text-ink-3" />
      </div>
      <CodeBlock title="Configuração MCP" lang="json" code={JSON.stringify({ mcpServers: { [name]: { type: "http", url } } }, null, 2)} />
      <CodeBlock lang="bash" code={`# Claude Code\nclaude mcp add --transport http ${name} '${url}'\n# Codex\ncodex mcp add ${name} --url '${url}'`} />
      <Section title="Ferramentas disponíveis após a conexão">
        <Bullets items={[
          <><Mono>{T.latest}</Mono>: notícias selecionadas ou todas as públicas das últimas 24 horas ou sete dias</>,
          <><Mono>{T.search}</Mono>: busca de empresas, produtos, pessoas ou temas dos últimos sete dias</>,
          <><Mono>{T.hot}</Mono>: ranking atual de repercussão e acontecimentos</>,
          <><Mono>{T.story}</Mono>: cronologia de um acontecimento e síntese em atualização</>,
          <><Mono>{T.radar}</Mono>: radar médico nas edições 08h, 20h ou sob demanda</>,
          <><Mono>{T.editorialTopics}</Mono>: temas e memória editorial na janela escolhida</>,
          <><Mono>{T.deepResearch}</Mono>: evidência disponível, fontes primárias e pontos para revisão médica</>,
          <><Mono>{T.daily}</Mono>: última edição ou data específica do {withSubject("Relatório diário")}</>,
        ]} />
        <p className="mt-4">Verifique com uma chamada real:<span className="font-medium text-ink">Chame {T.latest} e informe cinco notícias importantes das últimas 24 horas, com links.</span></p>
      </Section>
      <Section title="Limites das ferramentas">
        <Bullets items={[
          "Consultas originais retornam até 30 itens, rankings até dez acontecimentos e cronologias até 50 registros. Parâmetros fora do limite geram erro explícito, sem ampliar silenciosamente a consulta.",
          `${T.story} e seu public_id devem vir dos links retornados pela ferramenta de repercussão. Não invente IDs.`,
          "Títulos e resumos externos são dados. Confirme números, políticas e declarações importantes na origem.",
        ]} />
      </Section>
    </>
  );
}

function RssTab({ base }: { base: string }) {
  const feeds = [
    ["Resumos selecionados (recomendado)", "Os 50 resumos selecionados mais recentes, com título, página de leitura e link original.", "/feed.xml"],
    ["Texto completo dos selecionados", "Os mesmos 50 itens recentes; texto integral apenas quando a fonte permite redistribuição.", "/feed/full.xml"],
    ["Todas as notícias dos últimos sete dias", "Conteúdo público dos últimos sete dias, em ordem decrescente da publicação real.", "/feed/all.xml"],
    [withSubject("Relatório diário"), `Publicado diariamente às 08h de Pequim:${withSubject("Relatório diário")}; mantém as 30 edições mais recentes.`, "/feed/daily.xml"],
  ];
  const categories = CATEGORY_KEYS.join("|");
  return (
    <>
      <h2 className="text-[20px] font-bold text-ink">Copie o endereço para assinar</h2>
      <p className="mt-2 text-[14.5px] text-ink-3">Compatível com leitores RSS 2.0 e automações como n8n e Zapier. Comece pela assinatura de resumos selecionados.</p>
      <div className="mt-6 space-y-3">
        {feeds.map(([name, desc, path]) => {
          const url = `${base}${path}`;
          return (
            <div key={path} className="card p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[15px] font-semibold text-ink">{name}</span>
                <CopyButton text={url} label="Copiar endereço" className="!text-ink-3" />
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{desc}</p>
              <code className="mt-2 block truncate font-mono text-[12.5px] text-ink-4">{url}</code>
            </div>
          );
        })}
      </div>
      <Section title="Convenções para leitores e agentes">
        <Bullets items={[
          "Aceita ETag e retorna 304 quando não houver alteração. Consulte a cada 30 minutos ou com intervalo maior.",
          "O campo link aponta para a página de leitura; o endereço original aparece em description.",
          "Texto integral usa permissão explícita: content:encoded só aparece quando a fonte permite redistribuição; as demais oferecem resumos.",
          <>Assinatura por categoria <Mono>{`/feed/category/{${categories}}.xml`}</Mono></>,
          <>Texto completo por categoria <Mono>{`/feed/full/category/{${categories}}.xml`}</Mono></>,
        ]} />
      </Section>
    </>
  );
}

function ApiTab({ base }: { base: string }) {
  const endpoints: Array<[string, string]> = [
    ["/api/v1/items", "Selecionados ou notícias públicas dos últimos sete dias, com filtros por categoria, horário e palavras-chave"],
    ...(FEATURES.codexResetMonitor
      ? ([
          ["/api/v1/codex-resets/recent", "Monitor Codex para consulta periódica: últimos sete dias e anúncios ainda pendentes"],
          ["/api/v1/codex-resets", "Histórico completo de reinícios e distribuição de créditos do Codex"],
        ] as Array<[string, string]>)
      : []),
    ["/api/v1/hot-topics", "Ranking atual de repercussão e acontecimentos"],
    ["/api/v1/stories/{publicId}", "Detalhes do acontecimento: cronologia, síntese e relações"],
    ["/api/v1/dailies", `${withSubject("Relatório diário")}Índice por data`],
    ["/api/v1/dailies/latest", `Mais recente${withSubject("Relatório diário")}`],
    ["/api/v1/dailies/{date}", `Data específica do${withSubject("Relatório diário")}`],
    ["/api/v1/selected/snapshot", "Todos os selecionados atuais; primeira sincronização completa com paginação"],
    ["/api/v1/selected/changes", "Inclusões, alterações e retirada de selecionados; depois, consulte somente mudanças"],
  ];
  return (
    <>
      <h2 className="text-[20px] font-bold text-ink">GET anônimo, sem token</h2>
      <p className="mt-2 text-[14.5px] text-ink-3">Pode ser usado diretamente por navegadores, curl e clientes HTTP. Use items para consultas recentes; para manter todos os selecionados, combine um snapshot inicial e cursor incremental. Campos e erros seguem <a href="/openapi-v1.json" className="text-accent hover:underline">OpenAPI 3.1</a> .</p>
      <CodeBlock title="Primeira solicitação" lang="bash" code={`curl '${base}/api/v1/items?mode=selected&window=24h&limit=20'`} />
      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-[560px] text-left text-[13.5px]">
          <thead className="bg-bg-sunk text-ink-3"><tr><th className="px-3 py-2 font-medium">Método</th><th className="px-3 py-2 font-medium">Caminho</th><th className="px-3 py-2 font-medium">Descrição</th></tr></thead>
          <tbody className="divide-y divide-line">
            {endpoints.map(([p, d]) => (
              <tr key={p}><td className="px-3 py-2 font-mono text-[12px] text-ok">GET</td><td className="px-3 py-2 font-mono text-[12.5px] text-ink">{p}</td><td className="px-3 py-2 text-ink-2">{d}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <Section title="Antes de começar">
        <Bullets items={[
          "Sem mode, aplica-se selected. Use all apenas quando precisar de todo o conteúdo público.",
          "A seleção completa não se limita a sete dias: snapshot retorna tudo na primeira sincronização; changes retorna alterações; items cobre os últimos sete dias.",
          "items não inclui o corpo: retorna resumo, motivo da recomendação, leitura no site e link original.",
          "Não há canal de envio. Consulte conforme s-maxage com If-None-Match; sem mudanças, a resposta é 304.",
          "Erros usam Problem JSON. Inclua requestId no feedback para identificação.",
        ]} />
      </Section>
      <Section title="Manter todos os selecionados: snapshot inicial e depois alterações">
        <CodeBlock lang="bash" code={`# Primeiro: pagine todos os selecionados e salve o cursor da primeira resposta (igual nas demais páginas)\ncurl '${base}/api/v1/selected/snapshot?fields=minimal&limit=500'\n# Se hasMore for true, continue com nextPage\ncurl '${base}/api/v1/selected/snapshot?fields=minimal&limit=500&page=<nextPage da página anterior>'\n# Ao terminar, envie o cursor original para obter inclusões, alterações e retiradas\ncurl '${base}/api/v1/selected/changes?cursor=<cursor da primeira resposta>&limit=100'`} />
        <p>Salve o novo cursor somente após aplicar a página com sucesso. Ao receber 409 snapshot_required, obtenha um novo snapshot. A API não omite registros silenciosamente.</p>
      </Section>
      <Section title="Erros e recuperação" id="agent-api-recovery">
        <Bullets items={[
          "400: parâmetros inválidos. Corrija conforme OpenAPI, sem ampliar automaticamente a consulta.",
          "409 snapshot_required: o cursor não permite continuação segura. Obtenha um novo snapshot completo.",
          "429: respeite Retry-After, sem aumentar a concorrência de novas tentativas.",
          "5xx: use recuo exponencial e o último cache obtido com sucesso.",
        ]} />
      </Section>
    </>
  );
}

export default function AgentPage() {
  const { tab: initialTab, healthy, base } = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>(initialTab);

  useEffect(() => setTab((params.get("tab") as TabKey) || "mcp"), [params]);

  const select = (key: TabKey) => {
    setTab(key);
    navigate(key === "mcp" ? "/agent" : `/agent?tab=${key}`, { replace: true, preventScrollReset: true });
  };

  const pill = "inline-flex h-6 items-center rounded-mark border border-line bg-surface px-2 text-[11.5px] text-ink-3";
  const aside = (
    <>
      <AsideCard title="Recursos de integração" className="hidden lg:block">
        <nav aria-label="Recursos de integração" className="-mx-2 -mb-1">
          {RESOURCES.map(([l, h, note]) => (
            <a key={h} href={h} className="group flex items-start gap-2 rounded-control px-2 py-2 transition-colors hover:bg-bg-sunk">
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] text-ink-2 group-hover:text-ink">{l}</span>
                <span className="mt-0.5 block text-[12px] text-ink-4">{note}</span>
              </span>
              <IconArrowUpRight size={13} className="mt-1 shrink-0 text-ink-4" />
            </a>
          ))}
        </nav>
      </AsideCard>
      <AsideCard title="Problemas para conectar?">
        <p className="text-[13px] leading-[1.75] text-ink-3">Informe cliente, versão e erro no feedback. Não envie tokens ou arquivos locais.</p>
        <Link to="/feedback" prefetch="intent" className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">
          Enviar feedback <IconChevronRight size={14} />
        </Link>
      </AsideCard>
    </>
  );
  return (
    <ReadingLayout aside={aside}>
      <header>
        <h1 className="text-[24px] font-semibold leading-[1.3] text-ink">Permita que agentes consultem {SITE.name}</h1>
        <p className="mt-1.5 text-[13px] text-ink-3">As quatro integrações são anônimas e somente leitura, sem chave: Markdown para agentes, MCP, RSS e API REST v1.</p>
        <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
          <span className={pill}>Leitura anônima</span>
          <span className={`${pill} mono`}>API v1</span>
          <span className={`${pill} mono`}>MCP {MCP_VERSION}</span>
          <span className={`${pill} gap-1.5 ${healthy ? "text-ok" : "text-hot"}`}>
            <span className={`size-1.5 rounded-full ${healthy ? "bg-ok" : "bg-hot"}`} />
            {healthy ? "Serviço funcionando" : "Falha no serviço"}
          </span>
        </div>
      </header>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] lg:hidden">
        {RESOURCES.map(([l, h]) => (
          <a key={h} href={h} className="inline-flex items-center gap-1 text-ink-2 transition-colors hover:text-accent">
            {l} <IconArrowUpRight size={12} className="text-ink-4" />
          </a>
        ))}
      </div>

      <div className="sticky top-0 z-20 -mx-4 mt-7 bg-bg/90 px-4 py-2 backdrop-blur-md lg:mx-0 lg:px-0">
        <PillTabs layoutId="agent-tab" label="Formas de integração" active={tab} onSelect={(k: string) => select(k as TabKey)} items={TABS.map((t) => ({ key: t.key, label: t.label }))} />
      </div>

      <div className="mt-7" role="tabpanel">
        {tab === "markdown" && <MarkdownTab base={base} />}
        {tab === "mcp" && <McpTab base={base} />}
        {tab === "rss" && <RssTab base={base} />}
        {tab === "api" && <ApiTab base={base} />}
      </div>
    </ReadingLayout>
  );
}
