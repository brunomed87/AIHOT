# Adaptar ao seu setor

A configuração original demonstra notícias de IA; esta cópia especializa oftalmologia e mantém módulos herdados. A maioria das adaptações fica em [industry/](../industry/). Um agente pode ler AGENTS.md e este guia, receber o setor desejado, fontes importantes, critérios de relevância e ruído, executar verificações e informar decisões que exigem o responsável.

## 1. Nome e textos: industry/site.ts

name identifica navegação, títulos, imagens, RSS, MCP e painel. subject compõe nomes do setor; homeTitle, description e tagline definem apresentação. mcpPrefix determina nomes como lawhot_get_latest: preserve após uso por clientes. crawlerName identifica o coletor sem usar marca alheia. ABOUT reúne título, etapas, autoria opcional e direitos. icp atende registro de sites na China continental, quando aplicável. O endereço público vem de SITE_URL, não deste arquivo.

## 2. Categorias, marcadores e temas

CATEGORIES em taxonomy.ts define filtros: key aparece em /all?category= e /feed/category/<key>.xml e deve permanecer estável. label é visível; section agrupa relatórios; guide orienta classificação. CATEGORY_TAGS, TOPIC_TAGS e ENTITY_TAGS limitam o vocabulário, com categoria obrigatória na primeira posição. ENTITIES define instituições; IDENTITY_LEXICON e PUBLISHER_DOMAINS impedem atribuições ausentes do original e podem ficar vazios em setores sem esse problema. ITEM_TYPES corresponde às tabelas de peso dos modelos e exige atualização conjunta das instruções.

O catálogo topics.json contém grupos company, field e genre. tags ou entityId definem conteúdo; preserve slug após publicação. Atualize temas com node --env-file=.env scripts/seed.ts; Docker executa a carga inicial ao iniciar.

## 3. Fontes: industry/sources.json

Importadas somente quando inexistentes. Alterações posteriores ficam no painel Fontes, com criação, tentativa de coleta, intervalos e diagnóstico.

| Campo | Significado |
|---|---|
| kind | rss, web_list, json_list, x_search, mp_account ou external |
| config | Parâmetros de cada leitor; veja [fontes](sources.md) |
| tier | T1 oficial; T1_5 contas oficiais ou próximas; T2 imprensa e pessoas; EXCLUDE_MP fora da seleção |
| participation_mode | editorial público; hot_signal somente evidência de repercussão; isolated privado |
| first_party | Publicador é parte direta do acontecimento |
| site_fulltext | Texto integral no site, desativado por padrão e somente permitido pela fonte |

X precisa de SocialData; contas WeChat usam Dajiala, com cobrança por requisição e controle de orçamento.

## 4. Instruções: industry/prompts/

| Arquivo | Função |
|---|---|
| prefilter.md | Abrangência ampla, bloqueando somente materiais claramente alheios |
| selection-score.md | Nota 0–100 por tipo e cinco dimensões, com relevância e supressão de ruído |
| content-understanding.md | Título em português, resumo com resposta inicial, justificativa e marcadores |
| rules-domain.md | Terminologia e regras de tradução e preservação |
| summarize-*.md | Redação resumida dos demais materiais |
| structure.md | Categorias, instituições e fatos estruturados |
| group-*.md | Relações entre relatos |
| story-digest.md e report-*.md | Síntese, introdução diária e relatórios maiores |
| translate-*.md | Tradução integral |

{{siteName}} substitui o nome; {{> arquivo}} inclui outra instrução. Mudanças não exigem código. Preserve ponderação, controle de ruído e segurança; troque exemplos do setor. No direito, novas normas, decisões e sanções merecem análise, enquanto propaganda e cursos exigem controle de ruído.

## 5. Limites e calibração

A soma de duas notas deve atingir duas vezes o limite. Os limites originais T1 60, T1_5 65 e T2 76 foram calibrados em IA e exigem nova calibração ao trocar setor ou instruções. Anote 100–200 materiais em .data/gold.jsonl, seguindo [seleção](selection.md), execute scripts/eval-selection.ts e examine acertos, precisão, cobertura e erros no SelectBench. Ajuste instruções e depois limites.

## 6. Módulos de IA

leaderboard e codexResetMonitor em features.ts controlam rankings e monitor, incluindo navegação, agendas, interfaces e sitemap. Para outros setores, podem ser false. Remoção definitiva exige retirar os módulos backend leaderboard/ e monitor/, as funções e rotas correspondentes da interface e apps/api/src/routes/leaderboard.ts, resolvendo dependências de compilação.

## 7. Marca

industry/brand/ contém logo.svg, icon.png de 512, icon-192.png, apple-icon.png de 180 e favicon.ico. nameplates/ guarda cabeçalhos dos relatórios; regenere após mudança de setor com scripts/nameplates.ts, conforme suas fontes. O gerador original usa Noto Sans SC 5.3.0, obtido por npm pack @fontsource/noto-sans-sc@5.3.0 e extraído antes da execução. Na interface, components/Logo.tsx usa o nome textual e pode receber uma marca própria. Códigos QR entram pelo painel Configurações ou brand/contact/. Não use nome ou logotipo AIHOT como marca própria.

## 8. Páginas e atualizações

terms.md e privacy.md são modelos: adapte à operação e obtenha confirmação do responsável antes de publicar um site. changelog.json recebe entradas novas no início e latestVersion com data e hora para o indicador de novidades.

## 9. Modelos e implantação

LLM_BASE_URL, LLM_API_KEY e LLM_MODEL no .env aceitam serviço compatível com OpenAI. Rotas específicas usam parâmetros de .env.example. Veja [implantação](deploy.md).

Execute tipos, testes com banco terminado em _test ou _ci, compilação, testes da interface e smoke. Ajuste exemplos dos testes quando mudar o vocabulário, preservando regras verificadas. Confira início, notícias, relatórios e apresentação, além do estado das fontes no painel.
