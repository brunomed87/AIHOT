# Seleção e calibração

## Fluxo de uma matéria

1. Coleta e deduplicação de endereço e conteúdo. Materiais só com título ou resumo buscam a página original.
2. prefilter.md verifica pertinência ampla: BLOCK não é público; PASS e UNKNOWN seguem.
3. selection-score.md é aplicado duas vezes independentemente, de zero a cem. Soma pelo menos duas vezes o limite da fonte seleciona. Nota visível é a média arredondada para baixo.
4. Selecionados e não selecionados acima de understandFloor seguem content-understanding.md para título português, resumo, justificativa e marcadores. Demais usam summarize-*.md e aparecem nas notícias gerais.
5. structure.md extrai categoria, marcadores, instituição e fato, em paralelo à pontuação; alimenta temas e agrupamento.
6. group-*.md agrupa relatos do mesmo acontecimento, story-digest.md sintetiza e o ranking ordena acontecimentos. Selecionados aguardam agrupamento por até três minutos, evitando repetições iniciais.
7. Agenda original produz diário às 08:00, semanal segunda às 10:00 e mensal no primeiro dia às 10:30. O diário cobre de 08:00 anterior até atual. Materiais cuja publicação selecionada cruza o corte entram na próxima edição. Transações com horário definido antes do corte são aguardadas para evitar perda entre edições. Deduplicação factual e capacidade continuam limitando publicação. O radar médico usa agenda adicional de São Paulo.

Instruções ficam em industry/prompts/. A versão corresponde ao hash do conteúdo: mudanças afetam materiais novos, sem reprocessar os anteriores automaticamente.

## Limites

```ts
export const SELECTION = {
  thresholds: { T1: 60, T1_5: 65, T2: 76 },
  understandFloor: 50,
};
```

Fonte oficial T1 tem limite menor; imprensa e pessoas T2 maior, favorecendo o original direto do mesmo fato. EXCLUDE_MP não seleciona. Os limites herdados são rigorosos e calibrados em IA; recalibre após trocar setor, instruções ou modelo.

## Preparar amostras

Anote cem a duzentas matérias como selecionar ou rejeitar em .data/gold.jsonl, fora do Git. industry/gold.example.jsonl contém formato. Cada linha inclui caseId único, material com título, original, publicação, fonte e corpo; sourceFacts com tipo, classe, origem direta e idioma; samplingContext opcional; gold.decision como select, reject ou either, sendo either excluído da precisão global.

bodyZh mantém o nome técnico por compatibilidade e contém a versão localizada; bodyOriginal conserva o original. Pelo menos um corpo deve existir. benchmarkSplit separa development e holdout; samplingStratum identifica grupo de análise, como regulação ou divulgação. Inclua casos difíceis para evitar métricas infladas; reserve conjunto de validação sem ajustar instruções a ele. Prefira anotadores que representem os leitores reais.

## Executar avaliação

```sh
node --env-file=.env scripts/eval-selection.ts --gold .data/gold.jsonl --split development --label "Primeira versão"
```

Cada amostra recebe pré-seleção e duas notas. Saída inclui taxa de acerto, precisão dos selecionados, cobertura dos que deveriam ser selecionados, simulação de limites 40–90 a cada dois pontos e casos errados. Relatórios ficam em .data/eval/ e no SelectBench.

Sem --models, segue a rota de pontuação em produção, definida no painel, SCORE_MODEL ou padrão. --models default,deepseek-flash compara modelos configurados; --n 200 limita amostras; --split holdout usa validação reservada.

Entradas de pontuação idênticas compartilham chamadas, mas cada exemplo recebe pré-seleção, limite e referência anotada próprios. Falhas também são compartilhadas naquela execução. Repetições reutilizam recibos. Uso de tokens e latência incluem todas as tentativas dos recibos, inclusive falhas de interpretação; dados históricos de cache não representam custo novo.

## Corrigir erros

No SelectBench, leia matéria e justificativa. Falsos negativos pedem explicitar relevância em selection-score.md; falsos positivos pedem controlar ruído. Só ajuste limites quando o problema global for notas próximas do corte. Limite move todos os casos e não corrige categorias mal descritas. Execute novamente após cada mudança e compare versões.

O painel Modelos e avaliação apresenta rotas, sucesso, duração e tokens. Trocas afetam tarefas novas. Antes de trocar pontuação, compare modelos com --models no mesmo conjunto.
