// The Monday source-health report for the ops chat. It goes through the same gated channel as the
// alerts (off unless FEISHU_INTERNAL_ENABLED).
import { sql } from "../db.ts";
import { beijingDay, sendAlert } from "../notify/feishu.ts";

const pct = (a: number, b: number) => (b ? `${a >= b ? "+" : ""}${(((a - b) / b) * 100).toFixed(0)}%` : "—");
const n = (v: number) => v.toLocaleString("en-US");

/** Monday 09:00: how the sources did over the last seven days. */
export async function sourceHealthWeekly(now = Date.now()) {
  const since = new Date(now - 7 * 86400_000);
  const before = new Date(now - 14 * 86400_000);
  const [[counts], [items], failing, silent] = await Promise.all([
    sql<{ enabled: number; failing: number; degraded: number; added: number }[]>`
      SELECT count(*) FILTER (WHERE enabled)::int AS enabled,
             count(*) FILTER (WHERE enabled AND health = 'failing')::int AS failing,
             count(*) FILTER (WHERE enabled AND health = 'degraded')::int AS degraded,
             count(*) FILTER (WHERE created_at >= ${since})::int AS added
      FROM sources`,
    sql<{ week: number; prev: number; selected: number }[]>`
      SELECT count(*) FILTER (WHERE discovered_at >= ${since})::int AS week,
             count(*) FILTER (WHERE discovered_at >= ${before} AND discovered_at < ${since})::int AS prev,
             (SELECT count(*)::int FROM publications p WHERE p.selected AND p.visibility <> 'withdrawn' AND p.discovered_at >= ${since}) AS selected
      FROM articles WHERE discovered_at >= ${before}`,
    sql<{ name: string; fail_count: number; last_ok_at: Date | null; last_error: string | null }[]>`
      SELECT name, fail_count, last_ok_at, left(regexp_replace(last_error, '\s+', ' ', 'g'), 80) AS last_error FROM sources
      WHERE enabled AND health = 'failing' ORDER BY fail_count DESC LIMIT 10`,
    // Enabled sources that fetched fine but produced nothing for a week (external and WeChat ones report on their own).
    sql<{ name: string; last: Date | null }[]>`
      SELECT s.name, max(a.discovered_at) AS last FROM sources s LEFT JOIN articles a ON a.source_id = s.id
      WHERE s.enabled AND s.health <> 'failing' AND s.kind NOT IN ('external', 'mp_account') AND s.created_at < ${since}
      GROUP BY s.id, s.name HAVING max(a.discovered_at) IS NULL OR max(a.discovered_at) < ${since}
      ORDER BY max(a.discovered_at) NULLS FIRST LIMIT 15`,
  ]);
  const lines = [
    `Catalogados nesta semana: ${n(items!.week)} itens (semana anterior: ${n(items!.prev)}, ${pct(items!.week, items!.prev)}); selecionados: ${n(items!.selected)} itens`,
    `Fontes ativas ${counts!.enabled} ; novas nesta semana: ${counts!.added} ; falhas de coleta: ${counts!.failing} ; instáveis: ${counts!.degraded} fontes`,
  ];
  if (failing.length) lines.push("", "Fontes com falha: novos conteúdos destas origens estão temporariamente indisponíveis:", ...failing.map((f) => `· ${f.name}: falhas consecutivas ${f.fail_count} vezes${f.last_ok_at ? `, último sucesso ${beijingDay(f.last_ok_at)}` : ""}${f.last_error ? `(${f.last_error})` : ""}`));
  if (silent.length) lines.push("", "Fontes sem novidades há sete dias: origem sem atualização ou coletor com problema:", ...silent.map((s) => `· ${s.name}${s.last ? `(últimos ${beijingDay(s.last)})` : "(nunca produziu conteúdo)"}`));
  lines.push("", failing.length || silent.length ? "Para tratar, encaminhe esta mensagem à IA. Detalhes nas páginas Fontes e Execução do painel." : "Nenhuma fonte exige atenção.");
  await sendAlert("📊 Relatório semanal das fontes", lines);
  return { failing: failing.length, silent: silent.length };
}
