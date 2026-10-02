# Entrega: primeira versão do Radar Oftalmologia Brasil

Entrega local em 01/10/2026. Instalação para o usuário em `C:\Users\bruno\.local\share\AIHOT`, comando `ai-hot` em `C:\Users\bruno\.local\bin`, branch `codex/radar-oftalmologia-brasil`. Baseline upstream: `8d5a39bb47c917616798a3fdd71688a80f6c9b6c`. O checkout `C:\Projetos-ia\marketingskills` não foi modificado por esta implementação. Nenhum push, publicação externa ou configuração de serviço pago foi feito.

O [guia operacional](RADAR-OPHTHALMOLOGY.md) descreve contratos, dados, algoritmos, configuração, exemplos e limitações. Este documento reúne os 31 itens de entrega pedidos e as evidências verificadas. É uma primeira versão funcional com operação real de coleta ainda desativada, não uma avaliação clínica concluída.

## Verificação executada

| Verificação | Resultado |
| --- | --- |
| Suíte original e extensão médica | 465 testes passaram; zero falhas, cancelamentos ou testes ignorados; duração 126,7 s |
| Typecheck dos contratos, backend, API, worker, testes e web | Passou |
| Build de produção do frontend e SSR | Passou |
| Smoke HTTP e handshake MCP | 43 verificações: 40 passaram; três páginas de Leaderboard retornaram o estado esperado sem rodada publicada; zero falhas |
| Fontes médicas | 20 candidatas examinadas pelos coletores reais; 17 habilitadas, três desativadas; resultados em `source-verification.json` |
| Interface no navegador | Tela do Radar renderizada; filtro Ciência e memória de 30 dias aplicados; estado vazio sem notícias fictícias |
| Comando global em outra pasta | `ai-hot radar` executado a partir de `C:\Projetos-ia\marketingskills`, usando o checkout isolado |
| Exportações | Edição 08 e sob demanda persistidas e exportadas com janela correta de São Paulo, sem acontecimentos inventados |
| Segurança de custos na instalação | Enrich e Scout retornaram `disabled`; coleta e modelos reais desligados |
| Backup e retomada | Cópia offline PostgreSQL 17 criada; aplicação reiniciada; comando terminou com código zero |
| Formatação do diff | `git diff --check` passou |

Logs: `.data/tests-delivery.log`, `.data/typecheck-final.log`, `.data/build-final.log`, `.data/smoke-final.log`, `.data/local.log`. Os testes usam stubs locais; nenhum serviço pago foi habilitado. Os testes antigos de encerramento e arquitetura foram adaptados ao Windows mantendo as mesmas garantias.

Backup conferido: `.data/backups/2026-10-01T17-53-20-220Z`, com `manifest.json` e `postgres/PG_VERSION = 17`. É um backup físico offline; a existência da cópia foi verificada, mas uma restauração completa não foi ensaiada. Não compartilhar esse diretório: ele contém os dados do banco.

Exportações conferidas: `.data/radars/2026-10-01-08-2.md` e `.data/radars/2026-10-01-ondemand-1.md`. A edição 20 de hoje ainda não foi produzida, pois a verificação ocorreu antes das 20h. Os testes cobrem sua composição, comparação com a manhã e a rejeição de slots futuros.

## Os 31 itens solicitados

1. **Capacidades originais preservadas.** Ingestão RSS/Atom, páginas, JSON, X/WeChat opcionais; identidade/revisões/deduplicação; pré-filtro, duas avaliações, understanding e structure; Fact/Story, recall e clustering; heat, histórico e Hot; relatórios diário/semanal/mensal; UI, favoritos, busca; API, RSS, Markdown, MCP, OpenAPI, sitemap; admin, jobs, receipts/budgets, alertas e backups; SelectBench e troca de modelos; Leaderboard e monitor Codex opcionais. Catálogo anterior em `industry/sources.aihot-original.json`. Detalhes no inventário do guia.

2. **Novas capacidades.** Branding e telas médicas em português; fontes brasileiras, regionais e científicas internacionais; prompts especializados; evidência médica estruturada; resolver de primárias; flags de revisão; 11 dimensões editoriais; independência adicional de cobertura; tema editorial separado de acontecimento; memória e saturação suaves; registro auditado de recomendações usadas; Scout com proveniência; edições brasileiras 08/20 e sob demanda; novas saídas públicas UI/API/MCP/Markdown.

3. **Arquitetura final.** Coletores/Scout → intake original → seleção original → publicação/Fact/Story/heat originais. Enriquecimento médico e membros de temas acrescentam evidência e memória. Compositor persiste snapshots e recomendações. `publication/ophthalmology.ts` revalida conteúdo e dependências para todas as novas leituras públicas. Frontend acessa HTTP; pesquisas e modelos ficam no worker; receipts e budgets envolvem operações pagas. Diagrama no guia.

4. **Arquivos modificados.** Inventário exato abaixo; inclui branding, catálogo, prompts, contratos, rotas, jobs, coletores, documentação, smoke e adaptações dos testes ao domínio/Windows. Os algoritmos centrais de clustering e heat não foram substituídos.

5. **Novos arquivos.** Inventário exato abaixo; módulos médicos, contratos, publicação, UI, rotas, migrations, configuração, candidatos de avaliação, instalação, exportação e verificações.

6. **Migrations.** `0041_ophthalmology_radar.sql` cria cinco tabelas e orçamento inicial do Scout. `0042_scout_query_budget.sql` amplia somente os valores iniciais intactos de Brave. Ambas aplicadas na instalação; esquema anterior preservado. Executar `npm run db:migrate` antes de iniciar uma implantação em outro ambiente.

7. **Testes executados.** `ai-hot test`, `npm run typecheck`, `npm run build -w @aihot/web`, `node --env-file=.env scripts/smoke.ts --base http://127.0.0.1:3040`, verificação real de fontes, comandos de exportação/backup e verificação no navegador. A suíte inclui validação de evidência, causalidade/risco, identidade de primária, independência, publicação/revisões, memória/uso, datas IANA e delta, slots idempotentes, API/MCP e custos desligados.

8. **Resultados.** Tabela acima. Os 465 testes aprovam comportamento de software. Ainda não estabelecem precisão clínica, qualidade editorial nem rendimento de uma operação com modelos reais.

9. **Fontes adicionadas.** Ministério da Saúde, INCA, HuBrasil/EBSERH, Agência Brasil, G1 Pará/Bahia/Goiás/São Paulo/Rio Grande do Sul, Jornal USP, UFPA, CFM, Medical Xpress Ophthalmology e quatro consultas científicas PubMed/Europe PMC. São 17 ativas. ANVISA e Conitec ficaram desativadas por páginas dinâmicas sem itens extraídos; G1 Saúde por feed antigo. O catálogo mantém também as 18 fontes originais. URLs e amostras públicas: `docs/source-verification.json`.

10. **Credenciais.** As 17 fontes médicas e Europe PMC não exigiram chave para a coleta verificada. Brave exige `BRAVE_SEARCH_API_KEY`. Análise/seleção/reports por modelo exigem provider e chave. Integrações originais SocialData, Dajiala, Jina, embeddings, Feishu e armazenamento opcional conservam suas próprias configurações; não foram ativadas nesta entrega.

11. **Descoberta.** Coleta programada original mais Scout com `SearchProvider` extensível, Europe PMC e Brave. Famílias amplas cobrem especialidades, doenças sistêmicas, medicamentos, toxicidade, trauma, crianças, estética, esportes/celebridades, SUS e regulação. Cada resultado registra consulta/provider/proveniência. Publisher determina a fonte; motor de busca não conta como veículo independente. Consultas pagas usam receipts e budgets.

12. **Scoring.** `attentionScore` original permanece separado de evidência e oportunidade editorial. Índice adicional usa relevância ocular, evidência, interesse público, novidade, momentum, utilidade, attention e formatos/ângulos. Dimensões ausentes permanecem null e saem do denominador. Prioridades retina/catarata/refrativa são multiplicadores suaves; saturação reduz no máximo dez pontos. Fórmulas e pesos no guia.

13. **Thresholds atuais.** Seleção original: T1=60, T1_5=65, T2=76, understandFloor=50. Sugestão editorial de topo ≥75. Saturação: LOW <3, MODERATE ≥3, HIGH ≥6, SATURATED ≥10. Memória padrão 14 dias configurável, heat original 48h. Esses valores não limitam o catálogo a três pautas, três áreas ou somente Brasil.

14. **Valores provisórios.** Todos os thresholds de seleção devem ser recalibrados para o domínio médico. Pesos do índice, multiplicadores, topo, saturação, indicadores de trajetória e delta são provisórios. Não representam certeza clínica ou probabilidade de viralizar.

15. **Gold set.** Os exemplos são explicitamente sintéticos. Há 36 candidatos reais com `gold:null`, aguardando rótulo médico, não um gold validado. Construir 100–200 casos diversos, registrar justificativas e revisão humana, separar development/holdout e incluir pares de acontecimentos distintos no mesmo tema. Procedimento no guia.

16. **SelectBench.** Usar os scripts originais `eval-selection.ts` e `eval-relations.ts` com gold rotulado, split e modelos explícitos. Comparar falsos negativos por área/região/tier e erros de evidência, ajustar prompts/thresholds no development, confirmar no holdout. Esses comandos podem consumir créditos quando configurados com providers reais; não foram executados como avaliação clínica.

17. **Radar 08.** `ai-hot radar 08`; consultar `/radar/08`. Janela 20h anterior → 08h, America/Sao_Paulo. Edição persistida e idempotente; não compõe antecipadamente um slot futuro.

18. **Radar 20.** `ai-hot radar 20` após as 20h; consultar `/radar/20`. Janela 08h → 20h, comparando a edição da manhã persistida. Sem baseline, informa ausência de comparação. Agenda do worker usa timezone IANA brasileira.

19. **Sob demanda.** `ai-hot radar ondemand --hours 24 --memory-days 14`; consultar `/radar`. Janelas configuráveis via UI/API/CLI. Exporta Markdown em `.data/radars`; leituras não executam pesquisas ou chamadas pagas.

20. **Semanal/mensal.** `/weekly` e `/monthly`, preservando os calendários originais Beijing e catch-up. CLI: `ai-hot report weekly 2026-W40` e `ai-hot report monthly 2026-09`; requer modelos reais habilitados. Não foi criado histórico fictício desses relatórios. O radar brasileiro é adicional.

21. **Hot.** `/hot`, `/api/v1/hot-topics` e ferramenta MCP original `radar_oftalmo_get_hot_topics`; detalhes do evento mantêm histórico original. Heat e evidência são campos distintos.

22. **Saturation.** `/editorial-topics`, `/api/v1/ophthalmology/topics?memoryDays=14` e `radar_oftalmo_editorial_topics`. Exibe eventos, reportagens, independência, heat, recomendações, ângulos e uso. Uso efetivo exige ação administrativa auditada; não é inferido de uma recomendação.

23. **API.** `/api/v1/ophthalmology/radar`, `/api/v1/ophthalmology/topics` e `/api/v1/ophthalmology/research/{public-event-id}`. Filtros de slot/data, janela, memória, área, visão, paginação e Markdown. OpenAPI atualizado. `404` é esperado para edição ainda não salva. Correções/retiradas invalidam dependências de snapshots; corpo integral protegido não é exposto.

24. **MCP.** Streamable HTTP em `http://127.0.0.1:3040/api/mcp`. Cinco ferramentas originais e três novas: `radar_oftalmo_radar`, `radar_oftalmo_editorial_topics`, `radar_oftalmo_deep_research`. Esta última retorna dossiê e evidência persistidos; investigação paga adicional é melhoria futura. Descoberta atualizada em `llms.txt`.

25. **Admin.** `http://127.0.0.1:3040/admin/login`; senha em `ADMIN_PASSWORD` no `.env` privado. Admin original preservado. Histórico e marcação de uso em `/api/admin/ophthalmology/recommendations`, com autenticação, CSRF e motivo auditado. Credenciais não aparecem nesta documentação.

26. **Adicionar fontes.** Admin → Sources → criar e testar preview; conferir URL/data/proprietário, role e copyright antes de habilitar. Configurações RSS, web_list e json_list existentes. Fonte desabilitada não é reativada silenciosamente pelo Scout.

27. **Adicionar providers.** Implementar `SearchProvider`, registrar com `registerSearchProvider`, configurar `OPHTHALMOLOGY_SEARCH_PROVIDERS`; incluir testes locais. Provider pago precisa integrar `paidRequest`, receipt e budgets.

28. **Adicionar modelos.** Provider OpenAI-compatible por `LLM_*` ou cadastro/roteamento originais no Admin → Models. `MEDICAL_MODEL` pode especializar a extração sem trocar todas as capacidades. Alterações de modelo exigem avaliação do gold e revisão de custos.

29. **Backup.** `ai-hot backup`: encerramento gracioso, banco offline, cópia e reinício. Evidência na tabela. Preservar código e `.env` em armazenamento privado separado; restauração física exige PostgreSQL 17 e destino offline conferido. Produção conserva o mecanismo original de dump/S3-compatible.

30. **Limitações atuais.** Coleta/modelos/Scout reais desligados até configuração; banco público sem notícias médicas de demonstração. Ranking sem calibração médica humana. Primária exige identificador ou referência real para confirmação, sem resolução semântica geral. ANVISA/Conitec precisam de coletores dedicados. Republicação parafraseada requer revisão. O calendário de Pequim permanece nos periódicos originais; a interface está em português. Dossiê MCP consulta dados existentes, sem executar pesquisa paga ao ler. Exportação estática precisa regeneração após retirada. Backup não teve restauração ensaiada.

31. **Melhorias futuras.** Operação com credenciais e acompanhamento de custos; gold médico e calibração; mais fontes regulatórias/dinâmicas; resolver primárias sem identificador; republicação sem atribuição; medir retorno de tema após hiato; alertas editoriais; investigação ativa com orçamento explícito; ensaio documentado de restauração. Não confundir essas etapas com funcionalidades validadas nesta primeira entrega.

## Inventário de arquivos

Listas geradas contra o baseline Git; arquivos privados `.env`, `.data` e dependências estão ignorados e não entram no inventário versionável.

### Modificados (54)

- `.env.example`
- `README.md`
- `apps/api/src/app.ts`
- `apps/api/src/main.ts`
- `apps/api/src/routes/admin.ts`
- `apps/api/src/routes/mcp.ts`
- `apps/web/app/components/Logo.tsx`
- `apps/web/app/components/shell/nav.ts`
- `apps/web/app/routes.ts`
- `apps/web/server.ts`
- `apps/worker/src/main.ts`
- `apps/worker/src/schedules.ts`
- `industry/prompts/content-understanding.md`
- `industry/prompts/group-batch.md`
- `industry/prompts/group-definitions.md`
- `industry/prompts/group-pair.md`
- `industry/prompts/group-signal.md`
- `industry/prompts/prefilter.md`
- `industry/prompts/report-daily-lead.md`
- `industry/prompts/report-period.md`
- `industry/prompts/rules-answer-first-summary.md`
- `industry/prompts/rules-domain.md`
- `industry/prompts/rules-self-contained-title.md`
- `industry/prompts/selection-score.md`
- `industry/prompts/story-digest.md`
- `industry/prompts/structure.md`
- `industry/prompts/summarize-article-empty.md`
- `industry/prompts/summarize-article.md`
- `industry/prompts/summarize-long-post-quoted.md`
- `industry/prompts/summarize-long-post.md`
- `industry/prompts/summarize-short-post-quoted.md`
- `industry/prompts/summarize-short-post.md`
- `industry/prompts/translate-body.md`
- `industry/prompts/translate-post.md`
- `industry/site.ts`
- `industry/sources.json`
- `industry/taxonomy.ts`
- `industry/topics.json`
- `package-lock.json`
- `package.json`
- `packages/backend/src/editorial/models.ts`
- `packages/backend/src/publication/llms.ts`
- `packages/backend/src/sources/json-list.ts`
- `packages/backend/src/sources/web-list.ts`
- `packages/contracts/src/mcp.ts`
- `reference/public-v1.openapi.json`
- `scripts/smoke.ts`
- `tests/analyze-shutdown.test.ts`
- `tests/analyze.test.ts`
- `tests/architecture.test.ts`
- `tests/core-processing-recovery.test.ts`
- `tests/core-source-promotion.test.ts`
- `tests/default-model.test.ts`
- `tests/translate-shutdown.test.ts`

### Novos (30)

- `apps/api/src/routes/ophthalmology.ts`
- `apps/web/app/routes/editorial-topics.tsx`
- `apps/web/app/routes/radar.tsx`
- `database/migrations/0041_ophthalmology_radar.sql`
- `database/migrations/0042_scout_query_budget.sql`
- `docs/OPHTHALMOLOGY-DELIVERY.md`
- `docs/RADAR-OPHTHALMOLOGY.md`
- `docs/source-verification.json`
- `industry/ophthalmology-gold-candidates.jsonl`
- `industry/ophthalmology-gold.example.jsonl`
- `industry/ophthalmology-relation-gold.example.jsonl`
- `industry/ophthalmology-source-candidates.json`
- `industry/ophthalmology.ts`
- `industry/prompts/ophthalmology-evidence.md`
- `industry/sources.aihot-original.json`
- `packages/backend/src/ophthalmology/editorial.ts`
- `packages/backend/src/ophthalmology/enrich.ts`
- `packages/backend/src/ophthalmology/primary.ts`
- `packages/backend/src/ophthalmology/radar.ts`
- `packages/backend/src/ophthalmology/rules.ts`
- `packages/backend/src/ophthalmology/scout.ts`
- `packages/backend/src/ophthalmology/topics.ts`
- `packages/backend/src/publication/ophthalmology.ts`
- `packages/backend/src/publication/radar-markdown.ts`
- `packages/contracts/src/ophthalmology.ts`
- `scripts/compose-report.ts`
- `scripts/local.ts`
- `scripts/radar.ts`
- `scripts/verify-ophthalmology-sources.ts`
- `tests/ophthalmology.test.ts`
