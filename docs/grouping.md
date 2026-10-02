# Agrupamento e avaliação de relações

O framework recupera fatos candidatos recentes pelos títulos e resumos e usa modelo para julgar relação. Definições em industry/prompts/group-*.md; implementação em packages/backend/src/events/relate.ts e group.ts.

- SAME_OCCURRENCE: mesmo fato real, como anúncio oficial e cobertura jornalística.
- SAME_STORY: fatos diferentes diretamente relacionados, como anúncio seguido de disponibilização ou resposta.
- UNRELATED: fatos distintos mesmo com mesma empresa, produto ou assunto.
- ROUNDUP: um relato resume vários assuntos.

## Avaliar pares com amostras próprias

`scripts/eval-relations.ts` avalia somente a relação entre duas matérias. Reutiliza PAIR_SYSTEM, pairUser(), PairSchema e versão das instruções de produção. Não reexecuta recuperação de candidatos nem altera agrupamentos. Guarde anotações em .data/; industry/relation-gold.example.jsonl fornece quatro exemplos fictícios.

Cada linha inclui caseId, relatos a e b com title, source, firstParty, publishedAt e summary; samplingContext com benchmarkSplit e samplingStratum; gold.relation com referência. frame opcional segue ReportView, com subject, action, object e occurredAt. Casos difíceis entram no desenvolvimento; parte fica em holdout para verificação final. samplingStratum somente organiza erros, sem alterar entrada do modelo.

## Execução

Configure banco e modelos e execute:

```sh
node --env-file=.env scripts/eval-relations.ts --gold .data/relation-gold.jsonl --split development
node --env-file=.env scripts/eval-relations.ts --gold .data/relation-gold.jsonl --models default,deepseek-flash --split development --n 200 --seed 7 --thresholds 0.75,0.8
```

| Parâmetro | Padrão | Função |
|---|---|---|
| --gold | .data/relation-gold.jsonl | Amostras anotadas JSONL |
| --models | Rota groupReview atual | Modelos separados por vírgula |
| --split | all | development, holdout ou divisão própria |
| --n | 200 | Limite de amostras |
| --seed | 7 | Semente de amostragem determinística |
| --concurrency | 6 | Chamadas concorrentes |
| --thresholds | 0.75,0.8 | Confiança mínima para vínculo ao mesmo acontecimento |

Relatório completo em .data/eval/relations-*.json. Cada modelo recebe matriz de confusão 4 × 4, precisão/cobertura/F1 e número de casos por relação, taxa global e macro-F1. Para SAME_OCCURRENCE ou SAME_STORY como relação positiva, inclui métricas binárias por limite de confiança, falhas, tokens, latência do fornecedor, duração total e decisão/confiança/diferença/recibo por caso.

Chamadas usam recibos e orçamento. Mesmo modelo, instrução e entrada reutilizam resultado anterior; entradas idênticas no mesmo lote compartilham sucesso ou falha, com métricas por anotação. reused inclui compartilhamento e cache. Finalidade eval_relation_pair é separada de estatísticas produtivas de agrupamento. Tokens e latência somam todas as tentativas dos recibos usados, sem duplicar recibos repetidos. Cache apresenta histórico, sem alegar gasto novo.

Integração contínua verifica leitura JSONL, amostragem, métricas, reutilização concorrente e uso em tentativas repetidas com substitutos locais, sem modelos externos.
