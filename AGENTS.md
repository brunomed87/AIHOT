# Instruções para agentes

Este framework coleta fontes, usa modelos para selecionar e escrever, agrupa acontecimentos e publica relatórios pelo site, RSS, API e MCP. Esta cópia especializa o AIHOT em oftalmologia brasileira. Leia README e os documentos pertinentes em docs/.

## Adaptar a outro setor

Siga docs/customize.md. O pacote industry/ reúne identidade (site.ts), classificação (taxonomy.ts), temas (topics.json), fontes (sources.json), instruções (prompts/), limites (selection.ts), módulos (features.ts), marca (brand/) e páginas institucionais (pages/). Normalmente não é necessário alterar apps/ ou packages/.

O usuário define nome, fontes, notícias importantes, ruído, categorias e conteúdo dos termos e da privacidade. Os arquivos em industry/pages/ são modelos e exigem confirmação do responsável antes da publicação de um site.

Ao adaptar pontuação, preserve tipos de conteúdo, cinco dimensões ponderadas, controle de ruído e limites de segurança. Substitua exemplos de importância e ruído. Recalibre limites com amostras anotadas pelo usuário (docs/selection.md); não invente números.

## Execução e verificações

Node.js 24 executa TypeScript diretamente; o backend não possui etapa de compilação. Os espaços de trabalho npm são apps/*, packages/* e industry. Instalação local e Docker estão em docs/deploy.md.

Após alterações de código, execute:

```sh
npm run typecheck
# Banco vazio cujo nome termine em _test ou _ci; executar migrações antes.
DATABASE_URL=postgres://127.0.0.1:5432/myhot_test npm test
npm run build -w @aihot/web
node --test apps/web/tests/*.test.ts
node scripts/smoke.ts --base http://localhost:3000
```

Parte dos testes usa categorias, marcadores e empresas do setor original. Ao alterar industry/taxonomy.ts, adapte essas expectativas sem enfraquecer as regras verificadas.

## Regras obrigatórias

- apps/web acessa apps/api somente por HTTP. Banco, modelos e segredos ficam no backend.
- Todas as saídas públicas usam packages/backend/src/publication/, inclusive novas saídas.
- Abrir páginas não chama modelos. Essas chamadas ocorrem nas tarefas do worker.
- Requisições pagas passam por providers/receipts.ts e pelo controle de orçamento.
- No desenvolvimento e nos testes, mantenha fechadas COLLECT_ENABLED, MODEL_CALLS_ENABLED, FEISHU_*_ENABLED e INDEXNOW_SUBMIT_ENABLED. Testes usam substitutos locais, sem serviços externos.
- Fontes exibem resumo e link por padrão (site_fulltext desativado). Texto integral exige permissão explícita da fonte.
- Conteúdo público é anônimo e igual para administradores e visitantes; o painel exige administração.
- Migrações são incrementais e compatíveis. Adicione ao final de database/migrations/, na ordem numérica.
- Não envie .env, segredos ou .data/ ao Git.
- Use nome e marca próprios; não use nome ou logotipo AIHOT como marca do seu site.

## Código

Siga estilo, nomes e densidade de comentários do contexto. Prefira soluções simples e abstrações utilizadas. Verifique comportamentos relevantes; alterações simples de aparência não exigem novos testes.
