import { SITE } from "@aihot/industry/site";
// Recognition of Tibo's posts: the model translates and states what the post claims; code checks
// the boundaries (kinds, actions, times, relations) independent of wording.
import { z } from "zod";
import { modelFor } from "../editorial/models.ts";
import { chatJson } from "../providers/llm.ts";
import { pacificParts } from "./time.ts";

export const RECOGNIZE_PROMPT_VERSION = "tibo-reset-2026-09-26.5";

export interface ContextInput {
  id: string;
  author: string;
  relation: "reply" | "quote";
  text: string;
  publishedAt: string | null;
}

export interface OpenEventInput {
  id: string;
  kind: "direct_reset" | "reset_credit";
  status: "announced" | "confirmed";
  firstPostAt: string;
  excerpt: string;
  schedule: string | null;
}

const SYSTEM = `Você é ${SITE.name} e identifica anúncios públicos de Tibo (@thsottiaux) sobre reinício de limites do Codex e distribuição de créditos de reinício. Leia uma publicação com seu contexto de respostas e citações. Retorne JSON estrito.

Regras:
- direct_reset restaura diretamente o limite de uso do Codex ou ChatGPT Work. Exemplos originais: "we'll reset usage limits", "All reset for everyone", "reset landing at 6pm".
- reset_credit adiciona um crédito que o usuário pode ativar depois. Exemplos originais: "loading a banked reset into all accounts", "credit every user with a BANKED reset", "you will get more manual resets". Reinício ativado manualmente também pertence a esse tipo.
- Se o original disser somente "a reset" ou "reset is landing", escolha o tipo mais provável com kindExplicit=false.
- action: announce é compromisso futuro; progress é distribuição ainda incompleta; confirm é conclusão ou recebimento; amend esclarece abrangência ou horário de anúncio anterior; withdraw cancela ou retira.
- Respostas breves, como "Yes", "Soon" e "Not so random, but yes", dependem da pergunta respondida. Sem contexto relacionado a reinício, não crie proposição. Perguntar quando ocorrerá corresponde a announce; perguntar se acabou de ocorrer corresponde a confirm.
- count indica quantos reinícios a frase promete ou confirma; "reset twice" significa 2. Padrão 1.
- Em uma publicação, cada reinício aparece em uma única proposição. Repetição, justificativa ou explicação de um anúncio anterior não cria outro reinício.
- real indica compromisso ou confirmação efetivos. Descrever costume ou política, como "that includes the occasional reset" e "we reset from time to time", ou melhorar a velocidade de distribuição, como "we are working to reduce this to a few minutes", não cria compromisso: real=false.
- Andamento como "rolling out", "50% done", "And now 100%" e "still propagating" pertence ao reinício recente. Use progress enquanto incompleto e confirm quando 100% ou concluído, com relatesTo correspondente. Anúncio e confirmação efetivos têm real=true. Piadas, hipóteses, perguntas, condicionais, negativas ou ausência de reinício têm real=false.
- relatesTo aponta somente para anúncio candidato ainda não concluído que esta publicação confirma, avança, esclarece ou retira, ou para esclarecimento do mesmo reinício. Novo anúncio ou confirmação de outro reinício usa null; não reutilize um acontecimento já concluído para um reinício novo.
- statedTime conserva o sentido original; não calcule datas ou horários. O código faz a conversão pela publicação. PST/PT refere-se ao horário local do Pacífico.
  - Expressões relativas usam relativeHours desde a publicação: "in the next hour" = deadline, 1; "in the next few hours" = deadline, 3; "over the next 24 hours" = deadline, 24; "in about an hour" = approximate, 1; "in ~3 hours" = approximate, 3; "shortly/soon" = approximate, 1.
  - Períodos usam period: "this afternoon" = afternoon; "this evening" = evening; "tonight" = tonight; "end of day/by midnight/today" = end_of_day com precision=deadline.
  - Horário usa clock em HH:mm de 24 horas, por exemplo 6pm = 18:00. Intervalo também usa clockThrough; precision=exact para um horário ou window para intervalo.
  - Somente data, como "on Tuesday" ou "tomorrow", usa dayOffset em relação à data local do Pacífico da publicação e precision=date. Amanhã vale 1; próxima terça usa a diferença real. Horário ou período também pode incluir dayOffset.
  - Sem indicação temporal, use null.
- expectedLanding só aparece em announce/progress. Estime janela no Pacífico, formato YYYY-MM-DD HH:mm, usando o padrão histórico: normalmente algumas horas após anunciar, frequentemente entre 16h30 e 21h30. Nunca antecipe o horário declarado. note explica a base em português.
- scope: audienceSource preserva o público original e suas condições; plans lista nomes dos planos, como Plus, Pro e Business, ou null se ausentes. audienceZh contém a descrição em português, apesar do nome técnico legado; condições desconhecidas preservam a citação original. productsZh preserva nomes dos produtos, como Codex e ChatGPT Work, ou null se ausentes.
- outage: "outage" se reconhecer falha do Codex; "recovery" se anunciar recuperação; caso contrário, null.
- relevant indica relação substancial com limites, créditos de reinício ou falha do Codex, considerando o contexto. Publicação sem relação tem propositions=[] e pode ter translationZh=null.
- translationZh deve ser uma tradução integral fiel em português da publicação relacionada, com quebras, @ e links preservados, sem acrescentar ou remover informações. contextZh traduz cada contexto em português. Os nomes técnicos terminados em Zh permanecem por compatibilidade.
- excerpt conserva a frase original que sustenta a proposição; excerptZh é sua tradução em português.
- Não invente horário, público ou quantidade. Se houver dúvida, needsReview=true.

Retorne somente JSON:
{"relevant":bool,"translationZh":string|null,"contextZh":[{"id":string,"textZh":string}],"outage":"outage"|"recovery"|null,"needsReview":bool,"propositions":[{"kind":"direct_reset"|"reset_credit","kindExplicit":bool,"action":"announce"|"progress"|"confirm"|"amend"|"withdraw","real":bool,"count":number,"relatesTo":string|null,"excerpt":string,"excerptZh":string,"statedTime":{"precision":"exact"|"approximate"|"deadline"|"date"|"window","relativeHours":number|null,"period":"afternoon"|"evening"|"tonight"|"end_of_day"|null,"clock":string|null,"clockThrough":string|null,"dayOffset":number|null}|null,"timeInferred":bool,"expectedLanding":{"earliestPacific":string,"latestPacific":string,"note":string}|null,"scope":{"audienceSource":string|null,"plans":string[]|null,"audienceZh":string|null,"productsZh":string|null}}]}`;

const PropositionSchema = z.object({
  kind: z.enum(["direct_reset", "reset_credit"]),
  kindExplicit: z.boolean().catch(false),
  action: z.enum(["announce", "progress", "confirm", "amend", "withdraw"]),
  real: z.boolean(),
  count: z.number().int().min(1).max(5).default(1),
  relatesTo: z.string().nullable().catch(null),
  excerpt: z.string(),
  excerptZh: z.string().catch(""),
  statedTime: z
    .object({
      precision: z.enum(["exact", "approximate", "deadline", "date", "window"]),
      relativeHours: z.number().min(0).max(240).nullable().catch(null),
      period: z.enum(["afternoon", "evening", "tonight", "end_of_day"]).nullable().catch(null),
      clock: z.string().regex(/^\d{2}:\d{2}$/).nullable().catch(null),
      clockThrough: z.string().regex(/^\d{2}:\d{2}$/).nullable().catch(null),
      dayOffset: z.number().int().min(-1).max(14).nullable().catch(null),
    })
    .nullable()
    .catch(null),
  timeInferred: z.boolean().catch(false),
  expectedLanding: z.object({ earliestPacific: z.string(), latestPacific: z.string(), note: z.string() }).nullable().catch(null),
  scope: z
    .object({
      audienceSource: z.string().nullable().catch(null),
      plans: z.array(z.string()).nullable().catch(null),
      audienceZh: z.string().nullable().catch(null),
      productsZh: z.string().nullable().catch(null),
    })
    .catch({ audienceSource: null, plans: null, audienceZh: null, productsZh: null }),
});

export const RecognitionSchema = z.object({
  relevant: z.boolean(),
  translationZh: z.string().nullable().catch(null),
  contextZh: z.array(z.object({ id: z.string(), textZh: z.string() })).catch([]),
  outage: z.enum(["outage", "recovery"]).nullable().catch(null),
  needsReview: z.boolean(),
  propositions: z.array(PropositionSchema),
});

export type Recognition = z.infer<typeof RecognitionSchema> & { model: string; promptVersion: string; receiptId: number };
export type Proposition = z.infer<typeof PropositionSchema>;

function describeTime(iso: string): string {
  const p = pacificParts(new Date(iso));
  return `${iso}(horário do Pacífico: ${p.date} ${p.hm})`;
}

export async function recognizePost(input: { id: string; text: string; publishedAt: string; context: ContextInput[]; openEvents: OpenEventInput[] }): Promise<Recognition> {
  const lines = [
    `Publicação ${input.id}; publicado em ${describeTime(input.publishedAt)}: `,
    input.text,
    "",
    input.context.length ? "Contexto por relação:" : "Sem contexto",
    ...input.context.map((c) => `- [${c.relation === "quote" ? "Citado" : "Respondido"}] ${c.id} @${c.author}${c.publishedAt ? `, ${describeTime(c.publishedAt)}` : ""}: ${c.text}`),
    "",
    input.openEvents.length ? "Acontecimentos candidatos recentes, anunciados ou recém-confirmados:" : "Nenhum acontecimento candidato",
    ...input.openEvents.map((e) => `- ${e.id}｜${e.kind}｜${e.status} | primeira publicação ${describeTime(e.firstPostAt)}｜${e.schedule ?? "Horário não informado"}｜“${e.excerpt}”`),
  ];
  const res = await chatJson({
    model: await modelFor("monitor"),
    purpose: "monitor.recognize",
    subject: `x:${input.id}`,
    promptVersion: RECOGNIZE_PROMPT_VERSION,
    system: SYSTEM,
    user: lines.join("\n"),
    schema: RecognitionSchema,
    temperature: 0.1,
    maxTokens: 2500,
  });
  return { ...res.data, model: res.model, promptVersion: RECOGNIZE_PROMPT_VERSION, receiptId: res.receiptId };
}
