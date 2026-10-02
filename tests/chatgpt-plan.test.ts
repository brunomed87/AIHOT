import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { SignJWT, generateKeyPair, exportJWK, createLocalJWKSet } from "jose";
process.env.SITE_URL = "http://127.0.0.1:3040";
const { ChatGPTPlan, verifyChatGPTIdentity, readChatGPTStream, chatGPTRequestBody } = await import("@aihot/backend/providers/chatgpt");
const keys = await generateKeyPair("RS256");
const jwk = await exportJWK(keys.publicKey);
const localKeys = createLocalJWKSet({ keys: [{ ...jwk, kid: "pilot-test", alg: "RS256" }] });
const scope = "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct";
async function identity(nonce?: string, options: { issuer?: string; audience?: string; subject?: string; expiration?: number } = {}) {
  return new SignJWT({ nonce, name: "Conta de teste", email: "teste@example.com" }).setProtectedHeader({ alg: "RS256", kid: "pilot-test" })
    .setIssuer(options.issuer ?? "https://auth.openai.com").setAudience(options.audience ?? "oaiapp_test")
    .setSubject(options.subject ?? "test-subject").setIssuedAt().setExpirationTime(options.expiration ?? Math.floor(Date.now() / 1000) + 3600).sign(keys.privateKey);
}
async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), "radar-chatgpt-test-"));
  const encryptionKey = randomBytes(32);
  const cipher = async (mode: "encrypt" | "decrypt", bytes: Buffer) => {
    if (mode === "encrypt") { const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", encryptionKey, iv); const body = Buffer.concat([c.update(bytes), c.final()]); return Buffer.concat([iv, c.getAuthTag(), body]); }
    const c = createDecipheriv("aes-256-gcm", encryptionKey, bytes.subarray(0, 12)); c.setAuthTag(bytes.subarray(12, 28)); return Buffer.concat([c.update(bytes.subarray(28)), c.final()]);
  };
  let nonce = "", tokenCalls = 0, refreshCalls = 0, responseScope = scope, expires = 3600, invalidNonce = false;
  const requests: Array<{ url: string; body: string }> = [];
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    const target = String(url); const body = String(init?.body ?? ""); requests.push({ url: target, body });
    if (target.endsWith("/oauth/token")) {
      tokenCalls++;
      const form = new URLSearchParams(body), refresh = form.get("grant_type") === "refresh_token";
      if (refresh) { refreshCalls++; await new Promise(resolve => setTimeout(resolve, 30)); }
      return Response.json({ access_token: refresh ? "rotated-access-token" : "secret-access-token", refresh_token: refresh ? "rotated-refresh-token" : "secret-refresh-token",
        id_token: await identity(refresh ? undefined : invalidNonce ? "bad-nonce" : nonce), expires_in: refresh ? 3600 : expires, scope: responseScope, token_type: "Bearer" });
    }
    if (target.endsWith("/models")) return Response.json({ models: [{ slug: "test-model", display_name: "Modelo de teste", visibility: "list" }, { slug: "hidden", display_name: "Oculto", visibility: "hide" }] });
    if (target.endsWith("openid-configuration")) return Response.json({ revocation_endpoint: "https://auth.openai.com/oauth/revoke" });
    if (target.endsWith("/revoke")) return new Response(null, { status: 200 });
    throw new Error("O teste tentou acessar um endereço inesperado");
  }) as typeof fetch;
  const plan = new ChatGPTPlan({ directory, cipher, fetcher,
    verifyIdentity: (token, client, expectedNonce, _remote, receivedAt) => verifyChatGPTIdentity(token, client, expectedNonce, localKeys, receivedAt) });
  async function begin() { const result = await plan.beginSignIn(); const url = new URL(result.authorizationUrl); nonce = url.searchParams.get("nonce")!; return url; }
  async function callback(url: URL, patch: Record<string, string> = {}) {
    const target = new URL(url.searchParams.get("redirect_uri")!);
    target.search = new URLSearchParams({ state: url.searchParams.get("state")!, code: "test-code", client_id: "oaiapp_test", ...patch }).toString();
    return fetch(target, { redirect: "manual" });
  }
  return { plan, directory, requests, begin, callback, tokenCalls: () => tokenCalls, refreshCalls: () => refreshCalls,
    noScope: () => { responseScope = "openid email"; }, expiring: () => { expires = 1; }, wrongNonce: () => { invalidNonce = true; },
    cleanup: async () => { plan.cancelSignIn(); assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep)); await rm(directory, { recursive: true, force: true }); } };
}

test("login oficial usa PKCE, estado único, host estável e credenciais cifradas", async () => {
  const f = await fixture();
  try {
    const u = await f.begin();
    assert.equal(u.origin, "https://auth.openai.com"); assert.equal(u.searchParams.get("client_id"), "dynamic_agent_client");
    assert.equal(u.searchParams.get("agent_name_hint"), "Radar Oftalmologia Brasil");
    assert.equal(new URL(u.searchParams.get("redirect_uri")!).hostname, "127.0.0.1");
    assert.equal((await f.callback(u, { state: "wrong-state" })).status, 400); assert.equal(f.tokenCalls(), 0);
    assert.equal((await f.callback(u)).status, 303);
    const form = new URLSearchParams(f.requests[0].body);
    assert.equal(form.get("client_id"), "oaiapp_test");
    assert.equal(createHash("sha256").update(form.get("code_verifier")!).digest("base64url"), u.searchParams.get("code_challenge"));
    const status = await f.plan.status(); assert.equal(status.sharing, true); assert.equal(status.email, "teste@example.com");
    assert.equal(JSON.stringify(status).includes("secret-access-token"), false);
    const saved = await readFile(path.join(f.directory, "connection.json"), "utf8"); assert.equal(saved.includes("secret-access-token"), false);
    const again = await f.begin(); assert.equal(again.searchParams.get("client_id"), "oaiapp_test");
    assert.equal(again.searchParams.get("ext_agent_host_id"), u.searchParams.get("ext_agent_host_id"));
    assert.notEqual(again.searchParams.get("state"), u.searchParams.get("state"));
    assert.equal((await f.callback(again, { client_id: "oaiapp_wrong" })).status, 400); assert.equal(f.tokenCalls(), 1);
  } finally { await f.cleanup(); }
});

test("login sem permissão do plano permanece identificado mas bloqueia inferência", async () => {
  const f = await fixture();
  try { f.noScope(); const u = await f.begin(); assert.equal((await f.callback(u)).status, 303);
    assert.equal((await f.plan.status()).sharing, false); await assert.rejects(f.plan.credentials(), /não autorizou/);
  } finally { await f.cleanup(); }
});

test("login rejeita nonce inválido e mantém registro para tentar novamente", async () => {
  const f = await fixture();
  try { f.wrongNonce(); const u = await f.begin(); assert.equal((await f.callback(u)).status, 400);
    assert.equal((await f.plan.status()).sharing, false); const again = await f.begin(); assert.equal(again.searchParams.get("client_id"), "oaiapp_test");
  } finally { await f.cleanup(); }
});

test("duas tentativas simultâneas não substituem a transação de login", async () => {
  const f = await fixture();
  try { const first = f.begin(); await assert.rejects(f.plan.beginSignIn(), /login em andamento/); await first; }
  finally { await f.cleanup(); }
});

test("renovação é serializada entre processos e persiste os tokens rotacionados", async () => {
  const f = await fixture();
  try { f.expiring(); const u = await f.begin(); await f.callback(u);
    const [a, b] = await Promise.all([f.plan.credentials(), f.plan.credentials()]);
    assert.equal(a.accessToken, "rotated-access-token"); assert.equal(b.accessToken, a.accessToken); assert.equal(f.refreshCalls(), 1);
    assert.equal(a.accountKey, b.accountKey); assert.equal(a.accountKey.includes("test-subject"), false);
  } finally { await f.cleanup(); }
});

test("modelos vêm da conta e desconexão remove credenciais sem perder registro", async () => {
  const f = await fixture();
  try { const u = await f.begin(); await f.callback(u);
    assert.deepEqual(await f.plan.models(), [{ slug: "test-model", displayName: "Modelo de teste" }]);
    await assert.rejects(f.plan.selectModel("hidden"), /disponível/); await f.plan.selectModel("test-model");
    assert.equal((await f.plan.status()).model, "test-model"); assert.equal((await f.plan.disconnect()).remoteRevoked, true);
    assert.equal((await f.plan.status()).sharing, false); await assert.rejects(f.plan.credentials(), /Conecte/);
    const again = await f.begin(); assert.equal(again.searchParams.get("client_id"), "oaiapp_test");
  } finally { await f.cleanup(); }
});

test("ID token exige assinatura, emissor, audiência, validade e nonce corretos", async () => {
  assert.equal((await verifyChatGPTIdentity(await identity("nonce"), "oaiapp_test", "nonce", localKeys)).subject, "test-subject");
  for (const token of [await identity("wrong"), await identity("nonce", { issuer: "https://attacker.invalid" }), await identity("nonce", { audience: "another-client" }), await identity("nonce", { expiration: 1 })])
    await assert.rejects(verifyChatGPTIdentity(token, "oaiapp_test", "nonce", localKeys));
  const token = await identity("nonce"); const parts = token.split("."); parts[2] = Buffer.from("invalid-signature").toString("base64url");
  await assert.rejects(verifyChatGPTIdentity(parts.join("."), "oaiapp_test", "nonce", localKeys));
});

test("Responses da assinatura omite parâmetros não permitidos e preserva imagens", () => {
  const b = chatGPTRequestBody("test-model", "Dados não confiáveis", [{ type: "text", text: "Uma notícia" }, { type: "image_url", image_url: { url: "https://example.com/photo.jpg" } }], true);
  assert.equal(b.store, false); assert.equal(b.stream, true); assert.ok(b.instructions.includes("JSON"));
  assert.deepEqual(Object.keys(b).sort(), ["input", "instructions", "model", "store", "stream"]);
  assert.deepEqual(b.input[0].content, [{ type: "input_text", text: "Uma notícia" }, { type: "input_image", image_url: "https://example.com/photo.jpg" }]);
});

function stream(event: unknown, byteChunks = false) {
  const bytes = new TextEncoder().encode((Array.isArray(event) ? event : [event]).map(e => `event: response\r\ndata: ${JSON.stringify(e)}\r\n\r\n`).join(""));
  return new Response(new ReadableStream({ start(c) { if (byteChunks) for (const b of bytes) c.enqueue(new Uint8Array([b])); else c.enqueue(bytes); c.close(); } }));
}
test("stream preserva UTF-8 e CRLF divididos e só conclui após response.completed", async () => {
  const result = await readChatGPTStream(stream({ type: "response.completed", response: { id: "response-test", status: "completed", output: [{ content: [{ type: "output_text", text: '{"título":"Córnea e visão"}' }] }], usage: { input_tokens: 12, output_tokens: 8 } } }, true));
  assert.equal(result.choices[0].message.content, '{"título":"Córnea e visão"}'); assert.equal(result.usage.prompt_tokens, 12); assert.equal(result.usage.completion_tokens, 8);
  await assert.rejects(readChatGPTStream(stream({ type: "response.output_text.delta", delta: "Texto parcial" })), /antes de confirmar/);
  await assert.rejects(readChatGPTStream(stream({ type: "response.failed" })), /não concluiu/);
});
test("texto em partes só é aceito com confirmação final, mesmo quando output é omitido", async () => {
  const deltas = [
    { type: "response.output_text.delta", output_index: 0, content_index: 0, delta: '{"título":' },
    { type: "response.output_text.delta", output_index: 0, content_index: 0, delta: '"Visão"}' },
    { type: "response.output_text.done", output_index: 0, content_index: 0, text: '{"título":"Visão"}' },
  ];
  const completed = { type: "response.completed", response: { id: "response-deltas", status: "completed", usage: { input_tokens: 3, output_tokens: 4 } } };
  const result = await readChatGPTStream(stream([...deltas, completed], true));
  assert.equal(result.choices[0].message.content, '{"título":"Visão"}'); assert.equal(result.usage.completion_tokens, 4);
  await assert.rejects(readChatGPTStream(stream(deltas)), /antes de confirmar/);
  for (const type of ["response.failed", "response.incomplete", "error"]) await assert.rejects(readChatGPTStream(stream([...deltas, { type }])), /não concluiu/);
});
test("texto final tem prioridade sobre deltas e partes são reunidas na ordem correta", async () => {
  const deltas = [{ type: "response.output_text.delta", output_index: 1, delta: "B" }, { type: "response.output_text.delta", output_index: 0, delta: "A" }];
  const completed = { type: "response.completed", response: { id: "ordered", status: "completed" } };
  assert.equal((await readChatGPTStream(stream([...deltas, completed]))).choices[0].message.content, "AB");
  assert.equal((await readChatGPTStream(stream([...deltas, { ...completed, response: { ...completed.response, output: [{ content: [{ type: "output_text", text: "Final" }] }] } }]))).choices[0].message.content, "Final");
});
