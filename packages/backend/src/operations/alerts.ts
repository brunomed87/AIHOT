// Operations alerts. The person reading them is the site owner, not an engineer: each
// message says what readers see, whether it heals by itself and what, if anything, the owner must do.
//   now    — readers are affected and it has not healed: sent at once, repeated hourly, recovery reported.
//   today  — money at risk or only the owner can act: sent at once, repeated at most daily, recovery reported.
//   digest — follow-ups without reader impact: one 09:00 message a day, meant to be handed to the AI.
// Delivery goes through sendAlert (ops chat, internal-chat fallback; off unless FEISHU_INTERNAL_ENABLED).
import { beijingDate, beijingTime } from "@aihot/contracts/time";
import { sql } from "../db.ts";
import { beijingDay, beijingStamp, duration, formatAlert, formatRecovery, sendAlert, type Finding, type Level } from "../notify/feishu.ts";
import { backupConfigured } from "./backup.ts";

const REPEAT_MS: Record<Exclude<Level, "digest">, number> = { now: 3600_000, today: 24 * 3600_000 };

const collecting = () => process.env.COLLECT_ENABLED !== "false";
const modelsOn = () => process.env.MODEL_CALLS_ENABLED !== "false";
/** How long the site may go without a new article before it counts as stalled (small source lists are quieter). */
const QUIET_MS = Number(process.env.ALERT_QUIET_MINUTES || 360) * 60_000;

/** Everything wrong right now, with its level. */
export async function collectFindings(now = Date.now()): Promise<Finding[]> {
  const out: Finding[] = [];

  // ---- Readers affected now ----------------------------------------------------------------------
  // Content flow, judged by outcome: whatever broke (worker, egress proxy, models, queues), readers see
  // a site that stops changing. Skipped for 20 minutes after the worker starts, and where the valves are off.
  const [hb] = await sql<{ value: { startedAt?: string } }[]>`SELECT value FROM settings WHERE key = 'heartbeat.worker'`;
  const settled = !hb?.value.startedAt || now - Date.parse(hb.value.startedAt) > 20 * 60_000;
  if (settled && collecting()) {
    const [last] = await sql<{ at: Date | null }[]>`SELECT max(discovered_at) AS at FROM articles WHERE discovered_at > ${new Date(now - 4 * QUIET_MS)}`;
    const [anySource] = await sql`SELECT 1 FROM sources WHERE enabled LIMIT 1`;
    if (anySource && (!last?.at || now - last.at.getTime() > QUIET_MS)) {
      out.push({
        key: "content.collect",
        level: "now",
        title: "O site parou de receber novos conteúdos",
        impact: last?.at ? `Última matéria recebida em ${beijingStamp(last.at)}; depois disso, novos conteúdos não apareceram` : "Sem novas matérias há muito tempo",
        heals: "Não existe",
        action: "Encaminhar para tratamento pela IA",
        detail: `articles.discovered_at está sem novos valores há ${Math.round(QUIET_MS / 60_000)} minutos (ALERT_QUIET_MINUTES); confira sources.schedule, proxy de saída e falhas de coleta`,
        since: last?.at ?? undefined,
      });
    }
  }
  if (settled && collecting() && modelsOn()) {
    const [p] = await sql<{ waiting: number; oldest: Date | null; failed: number }[]>`
      SELECT count(*) FILTER (WHERE processing_state = 'new' AND discovered_at < now() - interval '2 hours')::int AS waiting,
             min(discovered_at) FILTER (WHERE processing_state = 'new') AS oldest,
             count(*) FILTER (WHERE processing_state = 'failed' AND discovered_at > now() - interval '3 hours')::int AS failed
      FROM articles WHERE processing_state IN ('new', 'failed') AND discovered_at > now() - interval '2 days'`;
    if (p!.waiting >= 10 || p!.failed >= 20) {
      const errors = await sql<{ error: string; n: number }[]>`
        SELECT left(coalesce(processing_error, '(sem erro)'), 120) AS error, count(*)::int AS n FROM articles
        WHERE processing_state IN ('new', 'failed') AND discovered_at > now() - interval '3 hours' AND processing_error IS NOT NULL
        GROUP BY 1 ORDER BY 2 DESC LIMIT 3`;
      out.push({
        key: "content.process",
        level: "now",
        title: "Novo conteúdo bloqueado no processamento",
        impact: [p!.waiting >= 10 && `${p!.waiting} matérias aguardam conclusão há mais de duas horas`, p!.failed >= 20 && `Nas últimas três horas, ${p!.failed} matérias falharam no processamento`]
          .filter(Boolean)
          .join("; ") + "; destaques e repercussão terão lacunas",
        heals: p!.waiting >= 10 ? "O processamento será retomado automaticamente após a recuperação" : "Não; corrija a falha e reprocesse as matérias",
        action: "Encaminhar para tratamento pela IA",
        detail: errors.map((e) => `${e.error}(${e.n})`).join("; ") || "Nenhum erro registrado",
        since: p!.waiting >= 10 && p!.oldest ? p!.oldest : undefined,
      });
    }
    // The daily report is composed at 08:00 and caught up hourly.
    if (Number(beijingTime(now).slice(0, 2)) >= 10) {
      const [r] = await sql`SELECT 1 FROM reports WHERE kind = 'daily' AND key = ${beijingDate(now)}`;
      if (!r) {
        out.push({
          key: "report.daily",
          level: "now",
          title: "O relatório diário de hoje ainda não foi gerado",
          impact: "Leitores não conseguem ver a edição de hoje",
          heals: "O sistema tenta recompor a cada hora, ainda sem sucesso",
          action: "Encaminhar para tratamento pela IA",
          detail: `reports daily ${beijingDate(now)} não existe; consulte as execuções reports.daily e reports.catch-up`,
        });
      }
    }
  }

  // ---- Money, and things only the owner can do --------------------------------------------------
  out.push(...(await providerFindings()));

  // Content-group pushes the Feishu webhook refused (a removed bot, a changed address); nothing resends them.
  const [refused] = await sql<{ n: number; target: string | null; response: string | null }[]>`
    SELECT count(*)::int AS n, max(t.note) AS target, left(max(d.response), 200) AS response FROM deliveries d JOIN notify_targets t ON t.key = d.target_key
    WHERE d.status = 'failed' AND d.updated_at > now() - interval '1 day'`;
  if (refused!.n > 0) {
    out.push({
      key: "deliveries.failed",
      level: "today",
      title: "Há notificações Feishu não enviadas",
      impact: `Últimas 24 horas ${refused!.n} notificações de selecionados ou reinícios não chegaram a${refused!.target ?? "Grupo de conteúdo"}`,
      heals: "Não será reenviado automaticamente",
      action: "Encaminhe à IA. Se o robô foi removido do grupo, será necessário adicioná-lo novamente",
      detail: refused!.response ?? "",
    });
  }

  // Reset monitor: posts are recognized in order, so one that keeps failing holds up every later one.
  const [stuck] = await sql<{ url: string; collected_at: Date; failures: { count: number; error?: string } | null }[]>`
    SELECT p.url, p.collected_at, s.value AS failures FROM monitor_posts p LEFT JOIN monitor_state s ON s.key = 'failures:' || p.id
    WHERE p.processed_at IS NULL ORDER BY p.published_at, p.id LIMIT 1`;
  if (stuck && now - stuck.collected_at.getTime() > 60 * 60_000) {
    out.push({
      key: "monitor.stuck",
      level: "today",
      title: "Monitor de reinícios do Codex bloqueado",
      impact: "Novos anúncios não podem ser confirmados e o grupo não recebe notificações",
      heals: "Ainda não há",
      action: "Encaminhar para tratamento pela IA",
      detail: `${stuck.url} Aguardando ${duration(now - stuck.collected_at.getTime())}${stuck.failures ? `; falhas de identificação: ${stuck.failures.count} tentativas:${stuck.failures.error ?? ""}` : ""}; no painel, use Reinícios do Codex → Publicações e identificação → Aguardando identificação para ignorar`,
      since: stuck.collected_at,
    });
  }
  // Claims held back from a post (a quote not in it, an unsure confirmation) wait for a person.
  const held = await sql<{ url: string }[]>`
    SELECT url FROM monitor_posts WHERE processed_at > ${new Date(now - 48 * 3600_000)} AND jsonb_array_length(coalesce(recognition->'held', '[]'::jsonb)) > 0
      AND (recognition->>'reviewed')::boolean IS NOT TRUE ORDER BY published_at DESC LIMIT 5`;
  if (held.length) {
    out.push({
      key: "monitor.review",
      level: "today",
      title: "Há anúncios de reinício que exigem confirmação",
      impact: "A identificação destas publicações é incerta; suas conclusões ainda não foram aplicadas ou notificadas",
      heals: "Não",
      action: "Revise em Reinícios do Codex → Publicações e identificação → Revisão pendente; depois esclareça no grupo se necessário",
      detail: held.map((h) => h.url).join(" "),
    });
  }

  if (backupConfigured()) {
    const [b] = await sql<{ value: { at: string; uploaded: boolean; filesError?: string } }[]>`SELECT value FROM settings WHERE key = 'backup.last'`;
    const age = b ? now - Date.parse(b.value.at) : Infinity;
    const state = b?.value.filesError ? `Banco enviado, mas o empacotamento dos anexos falhou:${b.value.filesError}` : b?.value.uploaded === false ? "Não enviado" : "";
    if (b?.value.uploaded && age > 50 * 3600_000) {
      out.push({
        key: "backup.failed",
        level: "today",
        title: "Backup do banco falhou por dois dias consecutivos",
        impact: "Sem efeito imediato; uma falha do servidor pode causar perda dos dados desde o último backup",
        heals: "Não",
        action: "Encaminhar para tratamento pela IA",
        detail: `Último sucesso ${beijingStamp(b.value.at)}; consulte ops.backup`,
        since: new Date(b.value.at),
      });
    } else if (!b || !b.value.uploaded || age > 30 * 3600_000) {
      out.push({ key: "backup.stale", level: "digest", title: "Backup do banco sem sucesso há mais de um dia", detail: b ? `Última tentativa ${beijingStamp(b.value.at)}${state ? `(${state})` : ""}; consulte ops.backup` : "Nenhum backup bem-sucedido registrado" });
    }
  }

  // ---- Follow-ups for the daily digest ------------------------------------------------------------
  const [r] = await sql<{ receipts: number; services: string | null; deliveries: number }[]>`
    SELECT (SELECT count(*)::int FROM receipts WHERE status = 'unknown') AS receipts,
           (SELECT string_agg(DISTINCT service || '/' || purpose, '、') FROM receipts WHERE status = 'unknown') AS services,
           (SELECT count(*)::int FROM deliveries WHERE status = 'unknown') AS deliveries`;
  if (r!.receipts > 0) {
    out.push({ key: "receipts.unknown", level: "digest", title: `${r!.receipts} solicitações pagas continuam com resultado desconhecido após uma tentativa automática`, detail: `${r!.services}; verifique e libere na página Execução do painel` });
  }
  if (r!.deliveries > 0) out.push({ key: "deliveries.unknown", level: "digest", title: `${r!.deliveries} notificações Feishu sem confirmação de entrega`, detail: "Confira o grupo e marque ou reenvie na página Execução" });

  // Runnable jobs (deferred ones excluded) that have waited more than two hours.
  const queues = await sql<{ name: string; n: number; oldest: Date }[]>`
    SELECT name, count(*)::int AS n, min(start_after) AS oldest FROM pgboss.job
    WHERE state IN ('created', 'retry') AND start_after <= now() AND name NOT LIKE 'cron.%' GROUP BY 1`;
  for (const q of queues) {
    if (now - q.oldest.getTime() > 2 * 3600_000) {
      out.push({ key: `queue.${q.name}`, level: "digest", title: `Tarefas aguardando há mais de duas horas:${q.name}`, detail: `${q.n} pendentes; a mais antiga aguarda ${duration(now - q.oldest.getTime())}` });
    }
  }

  // A leaderboard source keeps its last snapshot while failing.
  const [lb] = await sql<{ value: { sources?: Record<string, { ok: boolean; lastOkAt: string | null; error?: string }> } }[]>`SELECT value FROM settings WHERE key = 'leaderboard.fetch'`;
  const stale = Object.entries(lb?.value.sources ?? {}).filter(([, s]) => !s.ok && s.lastOkAt && now - Date.parse(s.lastOkAt) > 26 * 3600_000);
  if (stale.length) {
    out.push({
      key: "leaderboard.fetch",
      level: "digest",
      title: `O ranking de modelos tem ${stale.length} fontes sem coleta há mais de um dia; usando dados anteriores`,
      detail: stale.slice(0, 6).map(([k, s]) => `${k}: ${s.error ?? "Falhas"}(último sucesso ${beijingStamp(s.lastOkAt!)})`).join("; "),
    });
  }

  return out;
}

const MODEL_STOPS = "As etapas que usam este modelo pararam. Consulte Modelos e avaliações; novos conteúdos podem não entrar nos destaques";
const PROVIDERS: Record<string, { name: string; stops: string; where: string }> = {
  llm: { name: "Serviço de modelo padrão", stops: "Seleção, resumo, agrupamento e relatório de novas matérias estão suspensos", where: "Painel do fornecedor do modelo" },
  zhipu: { name: "Zhipu", stops: MODEL_STOPS, where: "Plataforma Zhipu" },
  dashscope: { name: "Alibaba Cloud Bailian", stops: MODEL_STOPS, where: "Painel Alibaba Cloud Bailian" },
  deepseek: { name: "DeepSeek", stops: MODEL_STOPS, where: "Plataforma DeepSeek" },
  mimo: { name: "Xiaomi MiMo", stops: MODEL_STOPS, where: "Plataforma Xiaomi MiMo" },
  socialdata: { name: "SocialData", stops: "Novos conteúdos do X não estão sendo recebidos", where: "Painel SocialData" },
  jina: { name: "Jina", stops: "Texto de algumas matérias indisponível", where: "Painel Jina" },
  dajiala: { name: "Dajiala", stops: "Novos conteúdos das contas WeChat não estão sendo recebidos", where: "Painel Dajiala" },
};
export const providerName = (service: string) => PROVIDERS[service]?.name ?? service;
export const providerStops = (service: string) => PROVIDERS[service]?.stops ?? "Funções relacionadas suspensas";
export const providerConsole = (service: string) => PROVIDERS[service]?.where ?? `${service} Painel administrativo`;

/** Paid services that refuse us (no balance, a dead key), and daily budgets used up. */
async function providerFindings(): Promise<Finding[]> {
  const out: Finding[] = [];
  const refused = await sql<{ service: string; n: number; last: string }[]>`
    SELECT service, count(*)::int AS n, (array_agg(left(error, 200) ORDER BY started_at DESC))[1] AS last FROM receipt_attempts
    WHERE status = 'failed' AND started_at > now() - interval '1 hour'
      AND error ~* '(HTTP 40[123]\\M|insufficient|balance|arrear|good standing|欠费|余额)'
    GROUP BY 1 HAVING count(*) >= 3`;
  for (const p of refused) {
    out.push({
      key: `provider.refused.${p.service}`,
      level: "today",
      title: `${providerName(p.service)} Serviço recusado: possível saldo insuficiente ou conta inválida`,
      impact: providerStops(p.service),
      heals: "Não",
      action: `Acesse${providerConsole(p.service)}e confira saldo e estado da conta. O sistema retoma após a regularização`,
      detail: `Recusas na última hora: ${p.n} tentativas:${p.last}`,
    });
  }
  const capped = await sql<{ service: string; per_day: number; used: number }[]>`
    SELECT b.service, b.per_day, count(a.id)::int AS used FROM budgets b
    JOIN receipt_attempts a ON a.service = b.service AND a.origin = 'live' AND a.started_at > now() - interval '1 day'
    WHERE b.per_day > 0 GROUP BY 1, 2 HAVING count(a.id) >= b.per_day`;
  for (const c of capped) {
    out.push({
      key: `budget.day.${c.service}`,
      level: "today",
      title: `${providerName(c.service)} Limite de chamadas das últimas 24 horas esgotado`,
      impact: `${providerStops(c.service)}; aguardando liberação na janela móvel`,
      heals: "Sim; o limite se recupera na janela móvel de 24 horas",
      action: "Nenhuma ação necessária agora. Se recorrente, avalie aumentar o limite",
      detail: `Em 24 horas: ${c.used} chamadas; limite: ${c.per_day}(tabela budgets)`,
    });
  }
  return out;
}

interface AlertState {
  [key: string]: { title: string; level?: Level; since: string; sentAt: string };
}

/** Every 10 minutes: new problems and recoveries of the now/today levels go out; digest items wait for 09:00. */
export async function checkAlerts(now = Date.now()) {
  const found = (await collectFindings(now)).filter((f) => f.level !== "digest");
  const [row] = await sql<{ value: AlertState }[]>`SELECT value FROM settings WHERE key = 'alerts.state'`;
  const state: AlertState = { ...(row?.value ?? {}) };
  const sent: string[] = [];
  for (const f of found) {
    const level = f.level as Exclude<Level, "digest">;
    const open = state[f.key]?.level ? state[f.key] : undefined;
    if (open && now - Date.parse(open.sentAt) <= REPEAT_MS[level]) continue;
    const since = open ? new Date(open.since) : (f.since ?? new Date(now));
    const msg = formatAlert(f, since, now, !!open);
    await sendAlert(msg.title, msg.lines);
    state[f.key] = { title: f.title, level, since: since.toISOString(), sentAt: new Date(now).toISOString() };
    sent.push(f.key);
  }
  for (const key of Object.keys(state)) {
    if (found.some((f) => f.key === key)) continue;
    // Entries without a level predate this scheme (2026-09-29) and close without a message.
    if (state[key]!.level) {
      const msg = formatRecovery(state[key]!.title, new Date(state[key]!.since), now);
      await sendAlert(msg.title, msg.lines);
      sent.push(`${key}:recovered`);
    }
    delete state[key];
  }
  await sql`INSERT INTO settings (key, value, updated_by) VALUES ('alerts.state', ${sql.json(state as never)}, 'alerts')
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
  return { open: Object.keys(state), sent };
}

/** 09:00: one message with the follow-ups that do not touch readers; nothing when there are none. */
export async function sendDigest(now = Date.now()) {
  const items = (await collectFindings(now)).filter((f) => f.level === "digest");
  const lines = items.map((f, i) => `${i + 1}. ${f.title}${f.detail ? `\n   ${f.detail}` : ""}`);
  if (!lines.length) return { items: 0 };
  await sendAlert(`📋 Relatório diário do sistema · ${beijingDay(now)}`, ["Os itens abaixo não afetam leitores. Não exigem ação; encaminhe à IA se necessário.", ...lines]);
  return { items: lines.length };
}
