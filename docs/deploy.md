# Implantação

## Docker

Requer Docker Compose. O guia original recomenda ao menos dois núcleos e 4 GB de memória para construir imagens.

```sh
git clone https://github.com/brunomed87/AIHOT.git radar-oftalmologia
cd radar-oftalmologia
node scripts/init-env.ts --llm-key CHAVE_DO_MODELO
docker compose up -d --build
```

init-env.ts cria .env com segredos aleatórios e senha administrativa, exibida uma vez. Sem Node, copie .env.example e configure ADMIN_PASSWORD com pelo menos doze caracteres, SESSION_SECRET, IMG_PROXY_SIGN_SECRET e POSTGRES_PASSWORD com valores aleatórios próprios, além de LLM_API_KEY. Não publique o arquivo. Abra a porta 3000 e /admin usando a senha configurada.

Primeiro início importa fontes de exemplo. Conteúdo só aparece quando coleta e modelos são ativados; duração depende das fontes e do processamento. Esta cópia começa com essas válvulas desligadas.

Compose inicia db com PostgreSQL 17, setup com migrações e dados iniciais, api, worker e web. setup termina após preparar o banco.

### Servidores na China continental

O projeto original oferece npm por espelho com `docker compose build --build-arg NPM_REGISTRY=https://registry.npmmirror.com`, seguido de início. Configure aceleração de imagens Docker se necessário. EGRESS_PROXY_URL encaminha coleta, imagens e avaliações externas, sem encaminhar chamadas dos modelos. Registro ICP e industry/site.ts icp são específicos daquele contexto; não são orientações de exigências brasileiras.

### Domínio e HTTPS

Aponte domínio ao servidor e configure:

```dotenv
SITE_URL=https://example.com
SITE_DOMAIN=example.com
PORT=127.0.0.1:3000
TRUST_PROXY=true
```

Porta fica local para Caddy. `docker compose --profile https up -d --build` habilita obtenção e renovação de certificados. Com Nginx existente, encaminhe para http://127.0.0.1:3000, preserve `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` e configure TRUST_PROXY=true. SITE_URL precisa ser o endereço real, usado em links, RSS, imagens e MCP.

MCP aceita o host de SITE_URL e localhost, 127.0.0.1 e [::1]. MCP_ALLOWED_HOSTS acrescenta hosts separados por vírgula, como extra.example:8443,[2001:db8::1]. Host não diferencia maiúsculas; IPv6 exige colchetes. Porta decimal de 0 a 65535 é permitida e ignorada na comparação. Caminhos, usuários e portas inválidas não são aceitos. Aliases como 127.1 exigem inclusão explícita. A lista controla Host, sem ampliar permissões de Origin do navegador.

### Atualizar

Faça backup antes. Construa, pare processos antigos, execute migrações e só então inicie:

```sh
git pull
docker compose build
docker compose stop api worker web
docker compose run --rm setup
docker compose up -d
```

Se a migração falhar, examine erro antes de iniciar. Preserve --profile https quando usado. Migrações de retirada guardam textos antigos em auditoria privada e retornam aos relatos ainda públicos, sem chamar modelos. API e worker antigos precisam parar antes, evitando recriar texto inválido. Encerramento normal do worker aguarda tarefas em andamento. Sem Docker, siga a mesma ordem: backup, compilação, parada, migração, início.

### Backup e logs

DB_BACKUP_STORE_* configura armazenamento compatível com S3 para backup diário às 04:10 do calendário original. Exportação manual:

```sh
docker compose exec -T db pg_dump -U aihot aihot | gzip > copia.sql.gz
docker compose logs -f --tail 100 api worker web
```

Volumes db, data e caddy guardam banco, uploads/cache/backups e certificados. `docker compose down` preserva volumes; a opção -v os remove. O painel Execução mostra tarefas; Fontes mostra coletas.

## Custos

Cada material novo pode receber pré-seleção, duas notas, redação, classificação e agrupamento; relatórios e sínteses acrescentam chamadas. O ensaio original com 152 materiais usou aproximadamente 930 chamadas; é referência daquele ensaio, sem previsão garantida desta cópia. O painel apresenta chamadas e tokens por etapa.

X, WeChat e Jina cobram por requisição e dependem de chaves. Orçamentos por minuto, hora e dia interrompem serviços ao atingir limites; zero desativa imediatamente. Ative somente depois de definir orçamento e avaliar instruções. Leitura de páginas não chama modelos.

## Sem Docker

Node.js 24.11 ou superior e PostgreSQL 16 ou 17:

```sh
npm ci
node scripts/init-env.ts --llm-key CHAVE_DO_MODELO
createdb myhot
```

Configure DATABASE_URL e API_BASE_URL no .env, depois:

```sh
node --env-file=.env scripts/migrate.ts
node --env-file=.env scripts/seed.ts
npm run build -w @aihot/web
node --env-file=.env apps/api/src/main.ts
node --env-file=.env apps/worker/src/main.ts
# No diretório apps/web:
NODE_ENV=production node --env-file=../../.env server.ts
```

API usa 3001 e interface 3000 por padrão. Mantenha três processos ativos com gerenciamento como systemd ou pm2. Desenvolvimento usa npm run dev:api, dev:worker e dev:web. DEV_AUTH_ROLE=admin permite acesso local de desenvolvimento; produção recusa essa configuração.

## Instalação local deste usuário

A instalação isolada no Windows usa `ai-hot start`, `ai-hot stop`, `ai-hot status`, `ai-hot backup` e `ai-hot test`. Interface em 127.0.0.1:3040; banco somente local, porta 5547. `ai-hot test` recria apenas radar_oftalmologia_test, protegido por conferência do endereço e nome. `ai-hot backup` interrompe processos, copia os dados PostgreSQL 17 e arquivos locais, grava manifesto e reinicia se já estava ativo. Backups ficam privados em .data/backups/. Veja [operação médica](RADAR-OPHTHALMOLOGY.md).
