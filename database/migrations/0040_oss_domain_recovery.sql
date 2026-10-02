-- article_ids e inputs_hash completos verificam elegibilidade; coluna guarda somente relatos usados na escrita e dependências de síntese anterior.
-- NULL indica versão histórica sem contexto verificável; próxima geração deve usar relatos atuais.
ALTER TABLE story_digests ADD COLUMN IF NOT EXISTS context_article_ids text[];

-- Pare API e worker antigos antes de atualizar. Código antigo sem verificação de geração em paralelo não integra a garantia de segurança.
-- Corrija somente dependências que perderam visibilidade, sem afetar outros acontecimentos ou chamar modelos na migração.
CREATE TEMP TABLE story_content_repair ON COMMIT DROP AS
WITH last_inputs AS (
  SELECT DISTINCT ON (story_id) story_id,article_ids
  FROM story_digests ORDER BY story_id,version DESC
), detached_inputs AS (
  -- Acontecimentos manuais antigos podem nunca ter recebido síntese; auditoria de separação preserva vínculo anterior.
  SELECT a.subject, f.story_id FROM audit_log a
  CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(a.before->'facts')='array' THEN a.before->'facts' ELSE '[]'::jsonb END
  ) removed(fact_id) JOIN facts f ON f.id::text=removed.fact_id
  WHERE a.action='content.detach'
  UNION
  SELECT a.subject, st.id FROM audit_log a
  CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(a.before->'stories')='array' THEN a.before->'stories' ELSE '[]'::jsonb END
  ) removed(story_id) JOIN stories st ON st.id::text=removed.story_id
  WHERE a.action='content.detach'
), unsafe_stories AS (
  SELECT f.story_id FROM facts f JOIN fact_articles fa ON fa.fact_id=f.id
  LEFT JOIN publications p ON p.article_id=fa.article_id LEFT JOIN sources s ON s.id=p.source_id
  WHERE p.article_id IS NULL OR p.visibility<>'public' OR s.participation_mode<>'editorial'
    OR (p.selected AND (p.visible_after IS NULL OR p.visible_after>now()))
  UNION
  SELECT d.story_id FROM last_inputs d CROSS JOIN LATERAL unnest(d.article_ids) i(article_id)
  LEFT JOIN publications p ON p.article_id=i.article_id LEFT JOIN sources s ON s.id=p.source_id
  WHERE p.article_id IS NULL OR p.visibility<>'public' OR s.participation_mode<>'editorial' OR NOT p.eligible
    OR (p.selected AND (p.visible_after IS NULL OR p.visible_after>now()))
  UNION
  SELECT d.story_id FROM detached_inputs d
  LEFT JOIN publications p ON d.subject='content:'||p.article_id LEFT JOIN sources s ON s.id=p.source_id
  WHERE p.article_id IS NULL OR p.visibility<>'public' OR s.participation_mode<>'editorial'
    OR (p.selected AND (p.visible_after IS NULL OR p.visible_after>now()))
)
SELECT st.id,to_jsonb(st) AS before_story,coalesce(rep.title,'Acontecimento em atualização') AS safe_title
FROM stories st
LEFT JOIN LATERAL (
  SELECT p.title FROM facts f JOIN fact_articles fa ON fa.fact_id=f.id
  JOIN publications p ON p.article_id=fa.article_id JOIN sources s ON s.id=p.source_id
  WHERE f.story_id=st.id AND p.visibility='public' AND s.participation_mode='editorial'
    AND (NOT p.selected OR p.visible_after<=now())
  ORDER BY p.first_party DESC,p.selected DESC,coalesce(p.published_at,p.discovered_at),p.article_id LIMIT 1
) rep ON true
WHERE st.merged_into IS NULL AND st.id IN (SELECT story_id FROM unsafe_stories);

-- Texto manual ou importado e estrutura factual antigos ficam na auditoria privada, na mesma transação da alternativa pública.
INSERT INTO audit_log(actor,action,subject,reason,before,after)
SELECT 'system','story.inputs_invalidated','story:'||r.id,'Atualização corrige entradas históricas invalidadas de acontecimentos',
  jsonb_build_object('story',r.before_story,'facts',coalesce((SELECT jsonb_agg(to_jsonb(f)) FROM facts f WHERE f.story_id=r.id),'[]'::jsonb)),
  jsonb_build_object('title',r.safe_title,'version',(r.before_story->>'version')::integer+1)
FROM story_content_repair r;

UPDATE stories st SET title=r.safe_title,summary=NULL,digest=NULL,latest=NULL,digest_updated_at=NULL,
  version=st.version+1,updated_at=now()
FROM story_content_repair r WHERE st.id=r.id;

UPDATE facts f SET title=coalesce((
  SELECT p.title FROM fact_articles fa JOIN publications p ON p.article_id=fa.article_id
  JOIN sources s ON s.id=p.source_id
  WHERE fa.fact_id=f.id AND p.visibility='public' AND s.participation_mode='editorial'
    AND (NOT p.selected OR p.visible_after<=now())
  ORDER BY p.first_party DESC,p.selected DESC,coalesce(p.published_at,p.discovered_at),p.article_id LIMIT 1
),'Acontecimento em atualização'),subject=NULL,action=NULL,object=NULL,conditions=NULL,occurred_at=NULL,version=f.version+1,updated_at=now()
WHERE f.story_id IN (SELECT id FROM story_content_repair);
