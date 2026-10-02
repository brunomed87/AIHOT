// Public method statement for the leaderboard (method v15, docs/leaderboard.md).
// The copy states how rankings are actually computed; it changes only together with the method.
import { SITE, withSubject } from "@aihot/industry/site";
import { Link, useLoaderData } from "react-router";
import type { LbRunInfo } from "@aihot/contracts/leaderboard";
import { loadOr404 } from "../lib/api.server";
import { breadcrumbLd, pageMeta } from "../lib/seo";
import { pct } from "../features/leaderboard/format";
import { fullDateTime } from "../lib/format";
import { IconArrowLeft, IconChevronRight } from "../components/icons";
import { AsideCard, ReadingLayout } from "../components/ui/Page";

interface RulesData {
  run: LbRunInfo;
  budgets: Array<{ key: string; name: string; weight: number; sources: string[] }>;
  anchors: string[];
}

export async function loader({ request }: { request: Request }) {
  return loadOr404<RulesData>("/api/site/leaderboard/rules", { signal: request.signal });
}

export function meta() {
  return pageMeta({
    title: "Método do índice de consenso",
    description: `Ver ${SITE.name} Como o ranking verifica resultados públicos, compara avaliações compartilhadas, trata evidência ausente e determina a ordem e o índice de consenso de 0 a 100.`,
    path: "/leaderboard/rules",
    image: "/og/pages/leaderboard.png",
    jsonLd: breadcrumbLd([
      { name: "Ranking de modelos", path: "/leaderboard" },
      { name: "Como o ranking é calculado", path: "/leaderboard/rules" },
    ]),
  });
}

export function headers() {
  return { "Cache-Control": "public, max-age=0, s-maxage=600, stale-while-revalidate=3600" };
}

const STEPS = [
  {
    n: "01",
    title: "Primeiro, confirme a identidade do modelo",
    body: "Nomes e versões são reconciliados entre fontes. Cada modelo tem uma configuração representativa de raciocínio, escolhida por regra prévia, sem selecionar a maior nota. Codinomes anônimos e resultados obtidos misturando modelos são excluídos. Versões de prévia oficialmente públicas podem participar.",
  },
  {
    n: "02",
    title: "Compare modelos efetivamente avaliados",
    body: "Somente resultados reais da mesma avaliação são comparados. Quando ambos têm erro publicado, diferenças pequenas dentro da margem de erro se aproximam de um empate, sem vitória presumida. Sem avaliação, não há comparação.",
  },
  {
    n: "03",
    title: "Defina os pesos antes de reunir as evidências",
    body: "Cada avaliação recebe um orçamento prévio. O ranking geral exige ao menos três instituições, três famílias de evidência e três áreas específicas. Repetir uma coleta ou recortar a mesma avaliação não cria peso adicional.",
  },
  {
    n: "04",
    title: "Encontre a ordem com menos conflitos",
    body: "Avaliações podem discordar. Escolhemos a ordem que contradiz o menor apoio líquido ponderado da evidência compartilhada e calculamos o índice separadamente. Dados ausentes não viram zero; resultados não publicados não são presumidos.",
  },
];

const FAQ = [
  {
    q: "Como um modelo com menos evidência pode entrar no ranking?",
    a: "Quantidade de avaliações e capacidade são aspectos distintos. O ranking geral exige três instituições e evidência de várias capacidades. A maioria das categorias exige duas instituições; conhecimento usa duas avaliações da mesma instituição, com essa limitação explícita. Ausência não vale zero, mas pode introduzir viés.",
  },
  {
    q: "O que significa sensibilidade à evidência?",
    a: "A indicação aparece se retirar uma avaliação ou instituição, variar um peso em 20% ou mudar o tratamento do erro produzir uma amplitude de três posições ou mais, perda de elegibilidade em algum cenário ou comparação incompleta. A amplitude apresentada não é um intervalo de confiança de 95% e não inclui resultados desconhecidos.",
  },
  {
    q: "Um modelo mais bem colocado sempre vence comparações diretas?",
    a: "Não. A pode vencer B, B vencer C e C vencer A. A ordem completa equilibra esses conflitos; modelos não adjacentes podem ter resultado direto diferente. O ótimo matemático minimiza conflitos segundo as regras atuais, sem demonstrar uma ordem universal de capacidade no trabalho real.",
  },
  {
    q: "Por que o ranking pode divergir da minha experiência?",
    a: "O ranking reúne avaliações públicas e reflete a capacidade apoiada por essas evidências. A experiência depende também da versão do produto, nível de raciocínio, ferramentas e estabilidade em tarefas longas. Novas avaliações revisam a ordem; diferenças pequenas de índice ou posição não devem ser exageradas.",
  },
  {
    q: "Quando novos modelos aparecem?",
    a: `${SITE.name} Os resultados de origem são verificados quatro vezes por dia. Um modelo participa somente após a instituição publicar seus resultados. Atualização da página, preço ou horário de coleta não representa nova avaliação.`,
  },
  {
    q: "O que acontece se uma fonte ficar indisponível?",
    a: "Snapshots ainda válidos podem ser usados. Dentro da mesma versão da avaliação, linhas temporariamente ausentes podem reutilizar registros verificados dos últimos sete dias. Resultados ainda públicos não são apagados por permanecerem constantes. Retiradas, correções ou novas versões invalidam ou substituem os registros, sem conservar máximos históricos. Se a rodada inteira falhar, permanecem o último ranking válido e sua data.",
  },
  {
    q: "O índice geral conta duas vezes avaliações específicas?",
    a: "A sobreposição é revisada pelas questões e métodos públicos, limitando a participação total de fontes relacionadas. Correlações não confirmadas continuam sendo uma limitação. O índice AA ocupa 30%; texto geral e criação do Arena compartilham os 10% de preferência humana, com 5% cada. Por haver votos sobrepostos, formam uma única família de evidência.",
  },
  {
    q: "Preço ou velocidade alteram a posição?",
    a: "Não. Os preços informam o custo de API por milhão de tokens, com a fonte oficial do fabricante, e não representam assinaturas.",
  },
];

const SECTIONS = [
  ["#rules-steps", "Quatro etapas do ranking"],
  ["#rules-budgets", "Distribuição da evidência"],
  ["#rules-faq", "Perguntas frequentes"],
  ["#rules-details", "Detalhes do cálculo"],
] as const;

/** One question or detail block: a hairline row that opens in place. */
function Disclosure({ summary, children, defaultOpen = false }: { summary: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="disclosure group border-b border-line" open={defaultOpen}>
      <summary className="flex items-center justify-between gap-3 py-4 text-[14px] font-semibold text-ink transition-colors hover:text-accent">
        {summary}
        <span className="shrink-0 text-[18px] font-normal leading-none text-ink-4 transition-transform duration-200 group-open:rotate-45" aria-hidden="true">
          +
        </span>
      </summary>
      <div className="max-w-[64em] pb-5 text-[13px] leading-[1.8] text-ink-3">{children}</div>
    </details>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="mono text-[11px] font-semibold tracking-[0.14em] text-accent">{children}</span>;
}

export default function LeaderboardRulesPage() {
  const { run, budgets, anchors } = useLoaderData<typeof loader>();
  const aside = (
    <>
      <AsideCard title="Nesta página" className="hidden lg:block">
        <nav aria-label="Nesta página" className="-mx-2 -mb-1">
          {SECTIONS.map(([href, label]) => (
            <a key={href} href={href} className="block rounded-control px-2 py-2 text-[13.5px] text-ink-2 transition-colors hover:bg-bg-sunk hover:text-ink">
              {label}
            </a>
          ))}
        </nav>
      </AsideCard>
      <AsideCard title="Método atual">
        <dl className="space-y-2 text-[12.5px]">
          <div className="flex gap-3">
            <dt className="w-14 shrink-0 text-ink-4">Versão do método</dt>
            <dd className="mono min-w-0 text-ink-2">{run.methodologyVersion}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-14 shrink-0 text-ink-4">Rodada atual</dt>
            <dd className="mono min-w-0 text-ink-2">{fullDateTime(run.generatedAt)}</dd>
          </div>
        </dl>
      </AsideCard>
      <AsideCard title="Continue explorando">
        <nav aria-label="Continue explorando" className="-mx-2 -mb-1">
          {[
            ["/leaderboard", "Ranking de modelos"],
            ["/leaderboard/sources", "Cada fonte de evidência"],
          ].map(([to, label]) => (
            <Link key={to} to={to!} prefetch="intent" className="flex items-center justify-between rounded-control px-2 py-2 text-[13.5px] text-ink-2 transition-colors hover:bg-bg-sunk hover:text-ink">
              {label}
              <IconChevronRight size={14} className="text-ink-4" />
            </Link>
          ))}
        </nav>
      </AsideCard>
    </>
  );
  return (
    <ReadingLayout aside={aside}>
      <Link to="/leaderboard" className="inline-flex items-center gap-1.5 py-2 text-[13px] text-ink-3 transition-colors hover:text-accent">
        <IconArrowLeft size={14} /> Voltar ao ranking de modelos
      </Link>

      <header className="pt-3">
        <h1 className="text-[24px] font-semibold leading-[1.3] text-ink">Como o ranking é calculado</h1>
        <p className="mt-1.5 text-[13px] text-ink-3">Conheça a evidência e os métodos que sustentam o ranking de avaliações públicas.</p>
      </header>

      <section className="mt-6 grid items-center gap-5 rounded-panel border border-line-soft bg-bg-sunk px-6 py-7 dark:bg-bg-muted/40 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)] md:px-10 md:py-9 lg:grid-cols-1 xl:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        <p className="mono text-[44px] font-medium leading-none tracking-[-0.04em] text-accent md:text-center md:text-[52px]">0—100</p>
        <div>
          <h2 className="text-[17px] font-bold text-ink">Evidência compartilhada, ordem clara.</h2>
          <p className="mt-2.5 text-[13px] leading-[1.8] text-ink-3">Reunimos avaliações públicas para minimizar conflitos com resultados conhecidos na ordem completa. O ranking geral e os quatro rankings por categoria exibem até 30 posições.</p>
          <p className="mt-1.5 text-[13px] leading-[1.8] text-ink-3">
            O índice converte diferenças de evidência que sustentam a ordem em uma escala de 0 a 100. Não é uma taxa de acerto nem um percentual de diferença de capacidade. Apoios semelhantes podem gerar índices iguais; a evidência completa ainda determina a posição.
          </p>
        </div>
      </section>

      <ol id="rules-steps" className="mt-8 grid scroll-mt-6 gap-x-10 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {STEPS.map((s) => (
          <li key={s.n} className="border-b border-line py-5">
            <span className="mono text-[11px] text-ink-4">{s.n}</span>
            <h2 className="mt-2 text-[15px] font-bold text-ink">{s.title}</h2>
            <p className="mt-1.5 text-[13px] leading-[1.8] text-ink-3">{s.body}</p>
          </li>
        ))}
      </ol>

      <section id="rules-budgets" className="mt-12 scroll-mt-6">
        <Eyebrow>VISÃO EQUILIBRADA</Eyebrow>
        <h2 className="mt-2 text-[20px] font-bold text-ink">Avaliações gerais, preferência humana e testes específicos em conjunto.</h2>
        <p className="mt-1.5 max-w-[64em] text-[13px] leading-[1.8] text-ink-3">
          Avaliações gerais ocupam 30%, preferência humana cega 10% e avaliações específicas 60%. Antes de acrescentar uma avaliação, verificamos sua sobreposição nos métodos públicos e distribuímos a participação correspondente. Parcelas ausentes não são transferidas a outras avaliações.
        </p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-label="Distribuição do orçamento de evidência">
          {budgets.map((b) => (
            <li key={b.key} className="card flex flex-col p-4 lg:p-5">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-[13.5px] font-semibold text-ink">{b.name}</span>
                <span className="mono text-[20px] font-medium text-ink">{pct(b.weight, 0)}</span>
              </span>
              <span className="mt-2.5 text-[11.5px] leading-[1.7] text-ink-4">{b.sources.join(" · ") || "—"}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-[64em] text-[12.5px] leading-[1.8] text-ink-3">
          Programação, raciocínio, conhecimento e trabalho profissional usam resultados reais e índices independentes. Visão e multilinguismo continuam no ranking geral; renomear categorias não amplia o peso da mesma evidência. O índice geral não é a média aritmética das categorias. Normalmente uma categoria precisa de duas avaliações válidas e cinco modelos comparáveis. Conhecimento usa duas avaliações do Epoch, com a limitação de uma única instituição explícita. Preferência criativa e desenvolvimento web permanecem no ranking geral; esta versão não tem rankings separados de estética ou escrita.
        </p>
      </section>

      <section id="rules-faq" className="mt-12 scroll-mt-6">
        <h2 className="text-[20px] font-bold text-ink">Outras dúvidas</h2>
        <div className="mt-3 border-t border-line">
          {FAQ.map((f) => (
            <Disclosure key={f.q} summary={f.q}>
              {f.a}
            </Disclosure>
          ))}
        </div>
      </section>

      <section id="rules-details" className="mt-10 scroll-mt-6 border-t border-line">
        <Disclosure summary="Consulte o cálculo e a versão atual">
          <div className="space-y-3">
            <p>
              Versão do método:<code className="mono rounded-mark bg-bg-sunk px-1.5 py-0.5 text-[12px] text-ink-2">{run.methodologyVersion}</code>. A ordem usa Kemeny ponderado incompleto. Para cada par de modelos com avaliações compartilhadas, calcula-se o apoio líquido M; o objetivo minimiza o apoio líquido das comparações invertidas. A otimização inteira retorna o estado ótimo e os limites do objetivo. Somente resultados completamente validados são publicados.
            </p>
            <p>
              Com erros padrão explícitos para ambos os modelos, o apoio líquido é 2Φ(diferença / erro padrão combinado) − 1, com covariância zero por padrão. Outras comparações usam somente a direção original. Erro desconhecido não equivale a zero; tratar diferenças pequenas como ordinais continua sendo uma limitação. Pesos se aplicam a pares potenciais; fontes com mais modelos usam mais posições comparáveis. O orçamento nominal não é a contribuição percentual exata para a ordem final.
            </p>
            <p>
              O índice preserva a ordem original: invertemos cada par adjacente, permitimos reorganizar os demais e calculamos o aumento mínimo do apoio líquido contrário. Essas diferenças não negativas são acumuladas na ordem e mapeadas por função sigmoide para 0 a 100 em relação a referências fixas. Ordens alternativas igualmente ótimas mantêm distância zero; exibimos uma casa decimal, sem diferença mínima artificial. O índice não reordena o ranking e depende dos candidatos, referências e evidências. Sua diferença não é uma distância real de capacidade. Soluções de mesmo custo usam ordem fixa de IDs. A otimização usa HiGHS (highs 1.15.3); a função normal utiliza o mesmo algoritmo de SciPy norm.cdf. Fontes, protocolos, elegibilidade e entradas de cada rodada têm versões. Componentes sem conexão pela evidência compartilhada não recebem uma ordem de precisão artificial.
            </p>
            <p>
              Modelos de referência fixos:<span className="mono text-[12px] text-ink-2">{anchors.join("、")}</span>. As referências definem a escala, sem determinar a posição de um fabricante. Índices de categorias diferentes não são diretamente comparáveis.
            </p>
          </div>
        </Disclosure>
      </section>

      <Link to="/leaderboard/sources" className="mt-8 inline-flex items-center gap-1 text-[13.5px] font-medium text-accent hover:text-accent-ink">
        Consulte cada evidência →
      </Link>
    </ReadingLayout>
  );
}
