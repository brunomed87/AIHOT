# Ranking de modelos e monitor Codex

Módulos herdados do setor de IA. Podem ser desativados em industry/features.ts, conforme [personalização](customize.md).

## Ranking: /leaderboard

Combina resultados públicos de Artificial Analysis, LMArena, LiveBench, Epoch, EQ-Bench, Vals e outras fontes para obter ordenação que minimize conflitos com evidências. Inclui categorias de programação, raciocínio, conhecimento e outras. /leaderboard/rules explica consenso v15 e ordenação Kemeny incompleta ponderada; /leaderboard/sources apresenta tarefas, estado e participação de cada fonte.

Filtros de fornecedores chineses e pesos abertos podem ser combinados. Primeiro filtram a lista completa, depois mostram trinta modelos, preservando posição e nota originais. Origem do fornecedor não garante disponibilidade em determinado país; pesos exigem correspondência oficial com versão exata e não garantem uso comercial irrestrito. Links oficiais permitem conferir licença e implantação.

Mapeamentos verificados ficam em packages/backend/src/leaderboard/model-weights.json; origem de fornecedores em access.ts. Modelos não cadastrados não são classificados automaticamente como pesos abertos. Informações de acesso podem mudar sem recalcular posições.

Atualizações originais ocorrem às 02:05, 08:05, 14:05 e 20:05 do calendário herdado. Falhas reutilizam o último retrato; nova rodada só publica quando evidência muda. O worker inicial calcula uma rodada se o módulo estiver habilitado.

ARTIFICIAL_ANALYSIS_API_KEY é específica da fonte. Sem ela, a participação fica vazia e não é redistribuída, podendo diferir do site original. GITHUB_TOKEN opcional aumenta a cota de leitura.

O catálogo em database/seeds/ contém nomes, fornecedores, lançamentos e aliases, importados por scripts/seed.ts. Modelos desconhecidos podem ser criados com nomes recebidos da avaliação. Preços vêm dos arquivos de dados iniciais e são preenchidos para modelos sem preço; atualize arquivos e execute node --env-file=.env scripts/import-leaderboard-prices.ts após mudanças. Preços não compõem capacidade.

| Local | Conteúdo |
|---|---|
| packages/backend/src/leaderboard/source-registry.json | Fontes, grupos, estados, participações e explicações |
| packages/backend/src/leaderboard/fetch/sources/ | Leitores por fornecedor |
| packages/backend/src/leaderboard/method/ | Algoritmos v15.ts e kemeny.ts |
| apps/web/app/features/leaderboard/ e routes/leaderboard*.tsx | Interface |

```sh
node --env-file=.env scripts/lb-round.ts --fetch
node --env-file=.env scripts/lb-fetch-check.ts
```

O primeiro coleta e calcula; o segundo confere coleta contra dados armazenados sem gravar. Constantes de v15.ts fazem parte do método: alterações exigem atualizar /leaderboard/rules e subir a versão. Texto público deve corresponder ao algoritmo real.

## Monitor: /codex-reset

Acompanha anúncios de reinício de limites publicados por Tibo, da equipe Codex, no X @thsottiaux: previsões, progresso, confirmação e retirada. Exibe horário estimado e link original. Interface estruturada: /api/v1/codex-resets.

- SOCIALDATA_API_KEY habilita leitura de X. Sem chave, não executa e a página fica sem registros; pode ser desativado.
- Consulta a cada cinco minutos, ou três durante previsão ou falha; revisão das últimas 48 horas às 04:40.
- Reconhecimento por MONITOR_MODEL, com modelo padrão como alternativa; código determina estados, sem confiar somente na redação do modelo.
- Dúvidas aguardam revisão administrativa em Reinícios Codex, permitindo corrigir vínculo, complementar e retirar.
- Com notificações Feishu habilitadas, previsões e confirmações podem ser enviadas ao grupo.
