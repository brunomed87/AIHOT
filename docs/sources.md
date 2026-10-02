# Fontes

O painel Fontes permite criar, tentar uma coleta, alterar frequência, ativar ou pausar e consultar falhas e materiais recentes. industry/sources.json é importado na primeira execução sem sobrescrever fontes existentes.

## Seis tipos

| Tipo | Uso | Dependência |
|---|---|---|
| rss | RSS/Atom de blogs, imprensa, Substack e conversores | Nenhuma |
| web_list | Listas de notícias, blogs e atualizações sem RSS | Seletores; Jina opcional pago |
| json_list | Interfaces JSON, como GitHub Releases | Caminhos de campos |
| x_search | Contas X | Chave SocialData, por requisição |
| mp_account | Contas públicas WeChat | Chave Dajiala, por requisição |
| external | Materiais enviados por seu coletor | INGEST_TOKEN |

Configurações aceitas estão em packages/backend/src/sources/config-keys.ts. Campos desconhecidos são rejeitados ao salvar e falham explicitamente na coleta, sem troca silenciosa para parser genérico.

### RSS

```json
{"feedUrl":"https://example.com/feed.xml"}
```

summaryIsBody indica resumo que já contém corpo; allowCategories e denyCategories filtram categorias do feed.

### Lista web

```json
{"url":"https://example.com/news","itemSelector":"article","linkSelector":"a","titleSelector":"h2","publishedAtSelector":"time"}
```

parseMode aceita html com seletores, markdown após Jina ou docusaurus_changelog. detail complementa data, título ou resumo via página original e respectivos seletores. allowUrlPrefixes e denyUrlPrefixes limitam caminhos.

### X

```json
{"query":"from:SomeAccount -filter:replies"}
```

Contas comuns são combinadas em consultas com cerca de vinte contas para reduzir requisições.

### WeChat

```json
{"ghid":"gh_xxxxxxxx","nickname":"Nome da conta"}
```

Cada conta é consultada conforme intervalo; lista é cobrada por chamada e corpo das novas matérias é recuperado.

## Classificação e permissões

T1 representa fontes oficiais diretas; T1_5 contas oficiais e criadores próximos; T2 imprensa e pessoas; EXCLUDE_MP não participa de seleção. Limites ficam em industry/selection.ts. editorial aparece na seleção e notícias; hot_signal só contribui para discussão; isolated não entra em páginas públicas. first_party sinaliza o envolvido direto e recebe prioridade na página do acontecimento.

site_fulltext permite integral no site; syndicate_fulltext permite corpo no RSS integral. Ambos começam desligados e exigem autorização explícita da fonte. Acesso técnico a WeChat ou conteúdo pago não concede direitos de republicação.

## Frequência e histórico

Cada fonte possui intervalo. Às 04:20 do calendário original, produção dos últimos sete dias reajusta frequência: mínimo de quinze minutos; fontes gratuitas até sessenta; pagas até 120–180. Falhas não avançam posição; próxima tentativa continua do mesmo ponto. Falhas contínuas ficam marcadas e relatório semanal pode ir ao grupo interno Feishu às segundas.

Materiais com mais de 48 horas ao serem descobertos, primeira importação de estoque e ingestões históricas são arquivados pela data original, sem novidades do dia ou envios. A regra é compartilhada por todos os caminhos.

## Ingestão externa

Usa deduplicação, seleção e agrupamento normais.

```http
POST /api/ingest/items
Authorization: Bearer TOKEN_CONFIGURADO
Content-Type: application/json

{"sourceId":"my-crawler","sourceName":"Meu coletor","items":[{"title":"Título obrigatório","url":"https://example.com/artigo","publishedAt":"2026-10-01T08:00:00-03:00","author":"Opcional"}]}
```

- Configure INGEST_TOKEN com pelo menos dezesseis caracteres; ausente, retorna 401.
- Máximo de cinquenta itens por requisição e dez chamadas por minuto por cliente.
- Cada item precisa ser objeto JSON. null, arrays ou outros valores retornam 400 sem criar fonte ou material.
- Resposta: {"ok":true,"created":numero}. Itens sem título ou endereço são ignorados; endereço repetido no lote usa o primeiro.
- sourceId novo cria fonte external isolada. Altere participação para editorial no painel antes de torná-la pública.
- Fonte pausada retorna 409, sem novos artigos; retomar permite ingestão.
- raw._aihot.backfill verdadeiro marca histórico, sem novidades ou envio.
