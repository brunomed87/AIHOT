import { beijingDate, beijingTime, beijingWeekday } from "@aihot/contracts/time";

export { beijingDate, beijingTime, beijingWeekday };

export function dayLabel(date: string, today: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const base = `${String(d).padStart(2,"0")}/${String(m).padStart(2,"0")}`;
  if (date === today) return `Hoje · ${base}`;
  const diff = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86400000);
  if (diff === 1) return `Ontem · ${base}`;
  if (y !== Number(today.slice(0, 4))) return `${base}/${y}`;
  return base;
}

export function relativeTime(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "Agora mesmo";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minutos atrás`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} horas atrás`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} dias atrás`;
  return beijingDate(iso);
}

export function fullDateTime(iso: string): string {
  return `${beijingDate(iso)} ${beijingTime(iso)}`;
}

/** Dia/mês e horário de Pequim para listas que atravessam dias. */
export function monthDayTime(iso: string): string {
  const [, m, d] = beijingDate(iso).split("-").map(Number) as [number, number, number];
  return `${String(d).padStart(2,"0")}/${String(m).padStart(2,"0")} ${beijingTime(iso)}`;
}

/** "X：Ethan Mollick (@emollick)" → "Ethan Mollick"; other sources keep their name. */
export function shortSourceName(name: string): string {
  const m = /^X[:：]\s*(.+?)\s*\(@[^)]+\)\s*$/.exec(name);
  if (m) return m[1]!.replace(/（.*?）/g, "").trim();
  return name.replace(/（RSS）|（网页）|（API）/g, "").trim();
}

export function sourceInitial(name: string): string {
  const s = shortSourceName(name).replace(/^[^\p{L}\p{N}]+/u, "");
  return (s[0] ?? "A").toUpperCase();
}
