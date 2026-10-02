import "./setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
const directory = await mkdtemp(path.join(tmpdir(), "radar-chatgpt-receipts-"));
process.env.AIHOT_DATA_DIR = directory;
process.env.LLM_TRANSPORT = "chatgpt-plan";
process.env.MODEL_CALLS_ENABLED = "true";
const { sql, closeDb } = await import("@aihot/backend/db");
const { config } = await import("@aihot/backend/config");
const { chatJson } = await import("@aihot/backend/providers/llm");
const { chatGPTPlan } = await import("@aihot/backend/providers/chatgpt");
const { BudgetExceededError, ReceiptUnknownError } = await import("@aihot/backend/providers/receipts");
const { buildApp } = await import("../apps/api/src/app.ts");
await mkdir(path.join(directory, "chatgpt"));
await writeFile(path.join(directory, "chatgpt/model.json"), JSON.stringify({ slug: "plan-test-model" }));
const nativeFetch = globalThis.fetch, nativeCredentials = chatGPTPlan.credentials.bind(chatGPTPlan);
let requests = 0, account = "synthetic-account-one", partial = false;
chatGPTPlan.credentials = async () => ({ accessToken: "synthetic-private-token", accountKey: account });
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  assert.equal(String(url), "https://api.openai.com/v1/responses", "não permite fallback silencioso para API ou endpoint interno");
  requests++;
  const body = JSON.parse(String(init?.body));
  assert.equal(body.model, "plan-test-model"); assert.equal(body.store, false); assert.equal(body.stream, true);
  assert.equal("temperature" in body, false); assert.equal("max_tokens" in body, false); assert.equal("messages" in body, false);
  const event = partial ? { type: "response.output_text.delta", delta: "parcial" } : { type: "response.completed", response: {
    id: `plan-test-${requests}`, status: "completed", output: [{ content: [{ type: "output_text", text: '{"conexao":"ok"}' }] }], usage: { input_tokens: 10, output_tokens: 5 },
  } };
  return new Response(`data: ${JSON.stringify(event)}\n\n`, { headers: { "content-type": "text/event-stream" } });
}) as typeof fetch;
const app = await buildApp();
after(async () => {
  globalThis.fetch = nativeFetch; chatGPTPlan.credentials = nativeCredentials;
  await app.close(); await closeDb();
  assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep));
  await rm(directory, { recursive: true, force: true });
});
const runId = randomUUID();
const request = (subject: string) => ({ model: "default", purpose: "chatgpt_test", subject: `${runId}:${subject}`, promptVersion: "plan-test-v1",
  system: "Responda JSON.", user: subject, schema: z.object({ conexao: z.literal("ok") }) });

test("assinatura usa receipts, preserva uso e reutiliza somente pedidos da mesma conta", async () => {
  const a = await chatJson(request("plan:receipt"));
  const b = await chatJson(request("plan:receipt"));
  assert.equal(a.data.conexao, "ok"); assert.equal(a.receiptId, b.receiptId); assert.equal(b.reused, true); assert.equal(requests, 1);
  account = "synthetic-account-two";
  const c = await chatJson(request("plan:receipt")); assert.notEqual(c.receiptId, a.receiptId); assert.equal(requests, 2);
  const [receipt] = await sql`SELECT service, request, response FROM receipts WHERE id=${a.receiptId}`;
  assert.equal(receipt.service, "chatgpt-plan"); assert.equal(JSON.stringify(receipt).includes("synthetic-private-token"), false);
  assert.equal(a.usage?.prompt_tokens, 10); assert.equal(a.usage?.completion_tokens, 5);
});

test("orçamento interrompe o plano antes de enviar novo pedido", async () => {
  const [before] = await sql`SELECT per_minute FROM budgets WHERE service='chatgpt-plan'`;
  try { await sql`UPDATE budgets SET per_minute=0 WHERE service='chatgpt-plan'`;
    const calls = requests; await assert.rejects(chatJson(request("plan:blocked")), BudgetExceededError); assert.equal(requests, calls);
  } finally { await sql`UPDATE budgets SET per_minute=${before.per_minute} WHERE service='chatgpt-plan'`; }
});

test("resposta interrompida fica desconhecida e não é repetida automaticamente", async () => {
  partial = true;
  const calls = requests;
  await assert.rejects(chatJson(request("plan:partial")), /antes de confirmar/);
  assert.equal(requests, calls + 1);
  await assert.rejects(chatJson(request("plan:partial")), ReceiptUnknownError);
  assert.equal(requests, calls + 1);
  const [receipt] = await sql`SELECT status FROM receipts WHERE subject=${`${runId}:plan:partial`}`;
  assert.equal(receipt.status, "unknown");
});

test("conexão e escolhas da assinatura exigem administração e proteção CSRF", async () => {
  for (const url of ["/api/admin/chatgpt", "/api/admin/chatgpt/connect", "/api/admin/chatgpt/models", "/api/admin/chatgpt/model", "/api/admin/chatgpt/disconnect"])
    assert.equal((await app.inject({ method: url.endsWith("chatgpt") ? "GET" : "POST", url, payload: {} })).statusCode, 401);
  config.devAdmin = { displayName: "Teste de administração" };
  try { assert.equal((await app.inject({ method: "POST", url: "/api/admin/chatgpt/connect", payload: {} })).statusCode, 403); }
  finally { config.devAdmin = null; }
});
