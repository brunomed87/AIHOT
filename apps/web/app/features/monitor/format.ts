// Beijing-time wording for the reset monitor. Inputs are ISO strings with +08:00.
import { addDays } from "@aihot/contracts/time";

export function bjDate(iso: string): string {
  return iso.slice(0, 10);
}

export function bjTime(iso: string): string {
  return iso.slice(11, 16);
}

export function monthDay(date: string): string {
  return `${date.slice(8,10)}/${date.slice(5,7)}`;
}

/** Hoje, amanhã, ontem ou data em dia/mês. */
export function dayWord(date: string, today: string): string {
  if (date === today) return "Hoje";
  if (date === addDays(today, 1)) return "Amanhã";
  if (date === addDays(today, -1)) return "Ontem";
  return monthDay(date);
}

export function windowText(from: string | null, through: string | null, today: string): string {
  if (!from) return "";
  const a = `${dayWord(bjDate(from), today)} ${bjTime(from)}`;
  if (!through || through === from) return a;
  const sameDay = bjDate(from) === bjDate(through);
  return sameDay ? `${a}–${bjTime(through)}` : `${a}–${dayWord(bjDate(through), today)} ${bjTime(through)}`;
}

export function durationText(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} minutos`;
  return m ? `${h} horas ${m} minutos` : `${h} horas`;
}

/** "9/26 21:40" */
export function stamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))} ${bjTime(iso)}`;
}

export function typeName(type: "direct_reset" | "reset_credit"): string {
  return type === "reset_credit" ? "Distribuição de créditos de reinício" : "Reinício de limites do Codex";
}
