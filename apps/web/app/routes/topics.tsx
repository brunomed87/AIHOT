import { data as withHeaders, Link, useLoaderData } from "react-router";
import type { Route } from "./+types/topics";
import { apiGet, releaseBoundCache } from "../lib/api.server";
import { pageMeta } from "../lib/seo";

interface TopicSummary {
  slug: string;
  name: string;
  group: "company" | "field" | "genre";
  definition: string;
  total: number;
  recent: number;
  indexable: boolean;
  latestAt: string | null;
}

export async function loader({ request }: { request: Request }) {
  const upstream = new Headers();
  const data = await apiGet<{ topics: TopicSummary[]; refreshAt: string | null }>("/api/site/topics", { signal: request.signal, responseHeaders: upstream });
  return withHeaders(data, { headers: releaseBoundCache(data.refreshAt, 300, Date.now(), upstream) });
}

export function meta() {
  return pageMeta({ title: "Temas", description: "Temas de IA organizados por empresas, modelos, áreas técnicas e tipos de conteúdo, incluindo OpenAI, Anthropic, agentes, multimodalidade, pesquisas e tutoriais.", path: "/topics", image: "/og/pages/topics.png" });
}

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return loaderHeaders;
}

const GROUPS = [
  { key: "company", name: "Empresas e modelos", blurb: "Acompanhe lançamentos e resultados por fabricante e família de modelos" },
  { key: "field", name: "Áreas técnicas", blurb: "Explore áreas como agentes, multimodalidade e inteligência incorporada" },
  { key: "genre", name: "Tipos de conteúdo", blurb: "Explore pesquisas, tutoriais, opiniões e políticas" },
] as const;

export default function TopicsPage() {
  const { topics } = useLoaderData<typeof loader>();
  return (
    <div className="pb-10">
      <header className="pb-2 pt-5 lg:pt-1">
        <h1 className="text-[24px] font-semibold leading-[1.3] text-ink">Explore os temas</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">
          Navegue por empresas, modelos, áreas técnicas e tipos de conteúdo <span className="num">{topics.length}</span> temas com destaques e conteúdos selecionados.
        </p>
      </header>
      {GROUPS.map((g) => (
        <section key={g.key} aria-labelledby={`topics-${g.key}`} className="pt-8">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <h2 id={`topics-${g.key}`} className="text-[15px] font-bold text-ink">
              {g.name}
            </h2>
            <p className="text-[12px] text-ink-4">{g.blurb}</p>
          </div>
          <ul className="mt-3.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {topics
              .filter((t) => t.group === g.key)
              .map((t) => (
                <li key={t.slug}>
                  <Link
                    to={`/topics/${t.slug}`}
                    prefetch="intent"
                    aria-label={`Ver${t.name}Artigos selecionados relacionados`}
                    className="card card-hover group flex h-full flex-col px-5 py-[18px]"
                  >
                    <span className="text-[15px] font-bold text-ink transition-colors group-hover:text-accent">{t.name}</span>
                    <span className="mt-1.5 line-clamp-2 flex-1 text-[12.5px] leading-[1.7] text-ink-3">{t.definition}</span>
                    <span className="mono mt-3 text-[11.5px] text-accent">
                      Ver {t.total} selecionados <span className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">→</span>
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
