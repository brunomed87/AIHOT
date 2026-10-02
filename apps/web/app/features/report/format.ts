import { SITE } from "@aihot/industry/site";
// Names, dates and grouping for daily, weekly and monthly reports.
import type { ReportNavigationEntry, ReportKind } from "@aihot/contracts/site";
import { beijingWeekday } from "@aihot/contracts/time";

export const KINDS: ReportKind[] = ["daily", "weekly", "monthly"];
export const KIND_PATH: Record<ReportKind, string> = { daily: "/daily", weekly: "/weekly", monthly: "/monthly" };
export const KIND_LABEL: Record<ReportKind, string> = { daily: "Relatório diário", weekly: "Relatório semanal", monthly: "Relatório mensal" };

export function kindFromPath(pathname: string): ReportKind {
  if (pathname.startsWith("/weekly")) return "weekly";
  if (pathname.startsWith("/monthly")) return "monthly";
  return "daily";
}

export function reportPath(kind: ReportKind, key: string): string {
  return `${KIND_PATH[kind]}/${key}`;
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** Monday and Sunday (YYYY-MM-DD) of an ISO week key such as 2026-W38. */
export function isoWeekRange(key: string): [string, string] {
  const [y, w] = key.split("-W").map(Number) as [number, number];
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const monday = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 86400000 + (w - 1) * 7 * 86400000);
  return [ymd(monday), ymd(new Date(monday.getTime() + 6 * 86400000))];
}

/** First and last day of a month key such as 2026-08. */
export function monthRange(key: string): [string, string] {
  const [y, m] = key.split("-").map(Number) as [number, number];
  return [`${key}-01`, ymd(new Date(Date.UTC(y, m, 0)))];
}

/** Manchete com quantidade de acontecimentos do dia, semana ou mês. */
export function headline(kind: ReportKind, key: string, count: number): string {
  if (kind === "daily") return `Neste dia: ${count} acontecimentos importantes`;
  if (kind === "weekly") return `Nesta semana: ${count} acontecimentos importantes`;
  return `${monthName(Number(key.slice(5, 7)))}: ${count} acontecimentos importantes`;
}

/** "09.16" for a story inside a week or month. */
export function shortDay(iso: string): string {
  const d = new Date(Date.parse(iso) + 8 * 3600000);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`;
}

/** Data curta da edição diária, em dia/mês. */
export function dayLabel(key: string): string {
  return `${key.slice(8,10)}/${key.slice(5,7)}`;
}


export interface ArchiveGroup {
  id: string;
  label: string;
  entries: Array<ReportNavigationEntry & { short: string }>;
}

/** Arquivo agrupa dias por mês, semanas pelo mês da segunda-feira e meses por ano; mantém ordem recente recebida. */
export function archiveGroups(kind: ReportKind, index: ReportNavigationEntry[]): ArchiveGroup[] {
  const groups: ArchiveGroup[] = [];
  const push = (id: string, label: string, e: ReportNavigationEntry & { short: string }) => {
    const g = groups[groups.length - 1];
    if (g && g.id === id) g.entries.push(e);
    else groups.push({ id, label, entries: [e] });
  };
  if (kind === "weekly") {
    const byMonth = new Map<string, string[]>();
    for (const e of index) {
      const m = isoWeekRange(e.key)[0].slice(0, 7);
      byMonth.set(m, [...(byMonth.get(m) ?? []), e.key]);
    }
    for (const e of index) {
      const m = isoWeekRange(e.key)[0].slice(0, 7);
      const weeks = [...byMonth.get(m)!].sort();
      push(m, `${monthName(Number(m.slice(5)))} de ${m.slice(0,4)}`, { ...e, short: `Semana ${weeks.indexOf(e.key) + 1}` });
    }
    return groups;
  }
  for (const e of index) {
    if (kind === "daily") push(e.key.slice(0, 7), `${monthName(Number(e.key.slice(5,7)))} de ${e.key.slice(0,4)}`, { ...e, short: e.key.slice(8,10) });
    else push(e.key.slice(0,4), e.key.slice(0,4), { ...e, short: monthName(Number(e.key.slice(5,7))) });
  }
  return groups;
}

/** An issue's mark in the archive column: a large number over a small word (a month's number stands alone). */
export function archiveMark(kind: ReportKind, key: string): { big: string; small: string | null } {
  if (kind === "daily") return { big: key.slice(8, 10), small: beijingWeekday(key) };
  if (kind === "weekly") {
    const start = isoWeekRange(key)[0];
    return { big: key.slice(6), small: `desde ${dayLabel(start)}` };
  }
  return { big: key.slice(5, 7), small: null };
}

/** Rótulo curto para alternância móvel: Hoje, dia/mês, semana do mês ou mês. */
export function chipLabel(kind: ReportKind, key: string, index: ReportNavigationEntry[], today: string): string {
  if (kind === "daily") return key === today ? "Hoje" : dayLabel(key);
  if (kind === "monthly") return monthName(Number(key.slice(5,7)));
  const group = archiveGroups("weekly", index).find((g) => g.entries.some((e) => e.key === key));
  const entry = group?.entries.find((e) => e.key === key);
  return group && entry ? `${monthName(Number(group.id.slice(5)))} · ${entry.short}` : key;
}

/** Use edição informada pela sequência completa, sem inferi-la do tamanho da navegação truncada. */
export function issueNumber(index: ReportNavigationEntry[], key: string): number | null {
  const n = index.find((e) => e.key === key)?.issueNumber;
  return typeof n === "number" && Number.isInteger(n) && n > 0 ? n : null;
}

/** The masthead's date block: a large figure and two small lines beside it. */
export function dateMark(kind: ReportKind, key: string): { figure: string; top: string; bottom: string } {
  if (kind === "daily") return { figure: key.slice(8, 10), top: `${monthName(Number(key.slice(5,7)))} de ${key.slice(0,4)}`, bottom: beijingWeekday(key) };
  if (kind === "weekly") {
    const [a, b] = isoWeekRange(key);
    return { figure: key.slice(6), top: `${key.slice(0,4)} · semana ${Number(key.slice(6))}`, bottom: `${dayLabel(a)} — ${dayLabel(b)}` };
  }
  return { figure: key.slice(5, 7), top: key.slice(0,4), bottom: monthName(Number(key.slice(5,7))) };
}

/** When each kind comes out (F10), for the masthead. */
export const EDITION: Record<ReportKind, string> = { daily: "Publicado diariamente às 08h", weekly: "Publicado às segundas-feiras", monthly: "Publicado no primeiro dia do mês" };

/** The masthead's figures, in the order a reader wants them; zero model releases is left out. */
const METRICS: Array<[key: string, unit: string]> = [
  ["totalEvents", "acontecimentos"],
  ["totalStories", "acontecimentos"],
  ["sourcesCount", "fontes"],
  ["firstPartyEvents", "publicações de primeira mão"],
  ["modelsReleased", "novos modelos"],
  ["selectedCount", "selecionados"],
  ["reportsCovered", "relatórios diários"],
];
export function metricItems(metrics: Record<string, number>): Array<{ value: number; unit: string }> {
  return METRICS.filter(([k]) => typeof metrics[k] === "number" && (k !== "modelsReleased" || metrics[k]! > 0)).map(([k, unit]) => ({ value: metrics[k]!, unit }));
}

/** Rótulos de edição anterior e seguinte, com data ou semana. */
export function neighbourLabel(kind: ReportKind, key: string, direction: "prev" | "next"): string {
  if (kind === "daily") return `${direction === "prev" ? "Dia anterior" : "Dia seguinte"} · ${dayLabel(key)}`;
  const which = direction === "prev" ? "Edição anterior" : "Próxima edição";
  return kind === "weekly" ? `${which} · semana ${Number(key.slice(6))}` : `${which} · ${monthName(Number(key.slice(5,7)))}`;
}

const MONTHS = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const monthName = (n:number) => MONTHS[n-1] ?? String(n);
/** Mantém o nome da função para compatibilidade; usa números decimais. */
export function cnNumber(n: number): string {
  return String(n);
}

/** Linha acima do título com data e dia da semana, intervalo semanal ou mês e ano. */
export function dateLine(kind: ReportKind, key: string): string {
  const m = dateMark(kind, key);
  if (kind === "daily") return `${Number(key.slice(8,10))} de ${m.top} · ${m.bottom}`;
  return kind === "weekly" ? `${m.top} · ${m.bottom}` : `${m.top} ${m.bottom}`;
}

/** What each kind is, under its nameplate. */
export const MOTTO: Record<ReportKind, string> = { daily: `${SITE.subject} · notícias diárias`, weekly: `${SITE.subject} · retrospectiva semanal`, monthly: `${SITE.subject} · retrospectiva mensal` };

export interface PeriodCell {
  key: string | null;
  /** Texto ao passar o ponteiro com data e número da edição. */
  label: string;
  state: "current" | "issue" | "none" | "pad";
}

/** ISO week number of a date (YYYY-MM-DD). */
function isoWeek(day: string): number {
  const d = new Date(`${day}T00:00:00Z`);
  const thursday = new Date(d.getTime() + (3 - ((d.getUTCDay() + 6) % 7)) * 86400000);
  const jan1 = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  return Math.floor((thursday.getTime() - jan1.getTime()) / 86400000 / 7) + 1;
}

/**
 * The dot grid beside the date in the masthead: the days of this issue's month (dailies, Monday first),
 * the weeks of its year (weeklies) or the months of its year (monthlies), each marked as this issue,
 * an issue that exists, or none.
 */
export function periodGrid(kind: ReportKind, key: string, index: ReportNavigationEntry[], currentIssueNumber?: number): { title: string; note: string; columns: number; heads: string[] | null; cells: PeriodCell[] } {
  const exists = new Set(index.map((e) => e.key));
  const cell = (k: string, name: string): PeriodCell => {
    const n = k === key && currentIssueNumber !== undefined && Number.isInteger(currentIssueNumber) && currentIssueNumber > 0 ? currentIssueNumber : issueNumber(index, k);
    const published = k === key || exists.has(k);
    return { key: k, label: n ? `${name} · edição ${n}` : `${name} · ${published ? "Publicada" : "Não publicada"}`, state: k === key ? "current" : exists.has(k) ? "issue" : "none" };
  };
  const count = (cells: PeriodCell[]) => cells.filter((c) => c.state === "issue" || c.state === "current").length;
  const year = key.slice(0, 4);
  if (kind === "daily") {
    const m = Number(key.slice(5, 7));
    const days = new Date(Date.UTC(Number(year), m, 0)).getUTCDate();
    const lead = (new Date(Date.UTC(Number(year), m - 1, 1)).getUTCDay() + 6) % 7;
    const cells: PeriodCell[] = [
      ...Array.from({ length: lead }, (): PeriodCell => ({ key: null, label: "", state: "pad" })),
      ...Array.from({ length: days }, (_, i) => cell(`${key.slice(0, 7)}-${pad(i + 1)}`, `${pad(i+1)}/${pad(m)}`)),
    ];
    return { title: monthName(m), note: `${count(cells)} edições neste mês`, columns: 7, heads: ['seg.','ter.','qua.','qui.','sex.','sáb.','dom.'], cells };
  }
  if (kind === "weekly") {
    const weeks = isoWeek(`${year}-12-28`);
    const cells = Array.from({ length: weeks }, (_, i) => {
      const k = `${year}-W${pad(i + 1)}`;
      const [a, b] = isoWeekRange(k);
      return cell(k, `Semana ${i+1} (${dayLabel(a)}–${dayLabel(b)})`);
    });
    return { title: year, note: `${count(cells)} edições neste ano`, columns: 13, heads: null, cells };
  }
  const cells = Array.from({ length: 12 }, (_, i) => cell(`${year}-${pad(i + 1)}`, monthName(i+1)));
  return { title: year, note: `${count(cells)} edições neste ano`, columns: 6, heads: null, cells };
}
