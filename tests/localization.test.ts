import assert from 'node:assert/strict';
import { test } from 'node:test';
import { looksPortuguese } from '@aihot/contracts/locale';
import { needsShortTweetTranslation, parseTranslateOutput, compactAnswerFirstSummary, enforceIdentity } from '@aihot/backend/editorial/writing';

test('publicações chinesas e inglesas são traduzidas; português não requer outra chamada', () => {
  assert.equal(needsShortTweetTranslation('研究团队发布了新的眼科诊断模型。'), true);
  assert.equal(needsShortTweetTranslation('Researchers released a new eye diagnostic model.'), true);
  assert.equal(needsShortTweetTranslation('Hoje publicamos uma pesquisa para melhorar a saúde dos pacientes. #study @clinic https://example.org'), false);
  assert.equal(looksPortuguese('今日は新しい研究を紹介します。'), false);
});

test('nomes históricos dos campos aceitam português e removem instruções repetidas', () => {
  assert.deepEqual(parseTranslateOutput('title_zh: Pesquisa sobre retina\nbody_zh: Uma pesquisa observacional.\n\nFonte: Instituto de pesquisa'), {
    titleZh: 'Pesquisa sobre retina', summaryZh: '', bodyZh: 'Uma pesquisa observacional.',
  });
});

test('resumo em português termina na frase e conserva números decimais', () => {
  const first = 'O estudo observacional acompanhou 2.5 mil pacientes e identificou uma associação que ainda exige confirmação.';
  const text = first + ' Os pesquisadores apontam limitações de seleção e recomendam novos estudos antes de qualquer mudança clínica.'.repeat(4);
  assert.equal(compactAnswerFirstSummary(text), first);
});

test('proteção contra instituições inventadas conserva o título original em português', () => {
  const title = 'Uma pesquisa sobre saúde dos pacientes foi publicada hoje';
  const result = enforceIdentity({ title, text: title, sourceKind: 'rss' }, { titleZh: 'OpenAI anuncia pesquisa', summaryZh: 'OpenAI realizou o estudo.' });
  assert.equal(result.titleZh, title);
  assert.equal(result.summaryZh, '');
  assert.equal(result.identityGuard.outcome, 'fallback');
});
