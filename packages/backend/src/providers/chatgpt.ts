// Implementação própria do protocolo público Sign in with ChatGPT. Tokens ficam no backend.
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer, type Server } from "node:http";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import lockfile from "proper-lockfile";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { config } from "../config.ts";

const ISSUER = "https://auth.openai.com";
const RESOURCE = "https://api.openai.com/v1";
const SCOPE = "chatgpt.tokens.use.direct";
const jwks = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`));
const defaultDirectory = path.join(config.dataDir, "chatgpt");
const fail = (message: string, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const missing = (e: unknown) => (e as { code?: string }).code === "ENOENT";

export async function verifyChatGPTIdentity(token: string, clientId: string, nonce?: string, keys: JWTVerifyGetKey = jwks, receivedAt?: number) {
  const { payload } = await jwtVerify(token, keys, {
    issuer: ISSUER, audience: clientId, requiredClaims: ["sub", "exp", "iat"],
    algorithms: ["RS256", "ES256"], clockTolerance: 5,
    ...(receivedAt ? { currentDate: new Date(receivedAt) } : {}),
  });
  if (!payload.sub || (nonce !== undefined && payload.nonce !== nonce)) throw fail("Não foi possível validar a identidade do ChatGPT.");
  return { subject: payload.sub, name: typeof payload.name === "string" ? payload.name : null,
    email: typeof payload.email === "string" ? payload.email : null };
}

// DPAPI CurrentUser protege os tokens com a conta do Windows, sem chave em código ou argumentos.
export async function windowsCredentialCipher(mode: "encrypt" | "decrypt", input: Buffer): Promise<Buffer> {
  if (process.platform !== "win32") throw fail("Esta conexão local usa o armazenamento protegido do Windows.");
  const script = `Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $r=[System.Security.Cryptography.ProtectedData]::${mode === "encrypt" ? "Protect" : "Unprotect"}($b,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($r))`;
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let output = "";
    const timer = setTimeout(() => child.kill(), 15_000);
    child.stdout.on("data", d => { output += d.toString(); });
    child.stderr.resume();
    child.on("error", () => { clearTimeout(timer); reject(fail("Armazenamento protegido do Windows indisponível.")); });
    child.on("close", code => {
      clearTimeout(timer);
      if (code !== 0 || !output.trim()) return reject(fail("Não foi possível proteger ou ler a conexão do ChatGPT."));
      resolve(Buffer.from(output.trim(), "base64"));
    });
    child.stdin.end(input.toString("base64"));
  });
}

interface Tokens { access_token: string; refresh_token?: string; id_token: string; expires_in: number; scope?: string; token_type?: string }
interface SavedConnection {
  clientId: string; subject?: string; name?: string | null; email?: string | null; scopes?: string[];
  accessToken?: string; refreshToken?: string; idToken?: string; expiresAt?: number;
  pendingRefresh?: { tokens: Tokens; receivedAt: number };
}
export interface ChatGPTConnection {
  status: "disconnected" | "connecting" | "connected" | "reauth_required";
  sharing: boolean; name: string | null; email: string | null; model: string | null; error: string | null;
  usageUrl: string;
}
export interface ChatGPTModel { slug: string; displayName: string }
interface Options {
  directory?: string; fetcher?: typeof fetch;
  cipher?: (mode: "encrypt" | "decrypt", input: Buffer) => Promise<Buffer>;
  verifyIdentity?: typeof verifyChatGPTIdentity;
}

export class ChatGPTPlan {
  private directory: string;
  private fetcher: typeof fetch;
  private cipher: NonNullable<Options["cipher"]>;
  private verify: typeof verifyChatGPTIdentity;
  private pending: { state: string; nonce: string; verifier: string; redirectUri: string; clientId?: string; subject?: string; server: Server; timer: ReturnType<typeof setTimeout>; expiresAt: number; consumed: boolean } | null = null;
  private error: string | null = null;
  private starting = false;
  constructor(options: Options = {}) {
    this.directory = options.directory ?? defaultDirectory;
    this.fetcher = options.fetcher ?? fetch;
    this.cipher = options.cipher ?? windowsCredentialCipher;
    this.verify = options.verifyIdentity ?? verifyChatGPTIdentity;
  }
  private async locked<T>(fn: () => Promise<T>): Promise<T> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const release = await lockfile.lock(this.directory, { stale: 120_000, retries: { retries: 40, minTimeout: 100, maxTimeout: 1000 } });
    try { return await fn(); } finally { await release(); }
  }
  private async atomic(name: string, value: unknown) {
    const temporary = path.join(this.directory, `.${randomUUID()}.tmp`);
    await writeFile(temporary, JSON.stringify(value), { mode: 0o600, flag: "wx" });
    await rename(temporary, path.join(this.directory, name));
  }
  private async load(): Promise<SavedConnection | null> {
    let raw: string;
    try { raw = await readFile(path.join(this.directory, "connection.json"), "utf8"); }
    catch (e) { if (missing(e)) return null; throw fail("Não foi possível ler a conexão salva."); }
    try {
      const envelope = JSON.parse(raw);
      if (envelope.version !== 1 || envelope.protection !== "windows-dpapi-current-user") throw new Error();
      const record = JSON.parse((await this.cipher("decrypt", Buffer.from(envelope.ciphertext, "base64"))).toString("utf8"));
      if (typeof record.clientId !== "string" || record.clientId === "dynamic_agent_client") throw new Error();
      return record;
    } catch { throw fail("A conexão salva não pôde ser validada. Ela foi preservada; confira o acesso ao armazenamento protegido."); }
  }
  private async save(record: SavedConnection) {
    const ciphertext = await this.cipher("encrypt", Buffer.from(JSON.stringify(record)));
    await this.atomic("connection.json", { version: 1, protection: "windows-dpapi-current-user", ciphertext: ciphertext.toString("base64") });
  }
  async status(): Promise<ChatGPTConnection> {
    return this.locked(async () => {
      const saved = await this.load();
      const sharing = Boolean(saved?.accessToken && saved.scopes?.includes(SCOPE));
      let model: string | null = null;
      try { model = JSON.parse(await readFile(path.join(this.directory, "model.json"), "utf8")).slug; } catch (e) { if (!missing(e)) throw fail("Seleção de modelo inválida."); }
      return { status: this.pending ? "connecting" : !saved?.accessToken ? "disconnected" : !saved.refreshToken && (saved.expiresAt ?? 0) <= Date.now() ? "reauth_required" : "connected",
        sharing, name: saved?.name ?? null, email: saved?.email ?? null, model, error: this.error, usageUrl: "https://chatgpt.com/settings/usage" };
    });
  }
  private async tokenRequest(body: URLSearchParams): Promise<Tokens> {
    let response: Response;
    try { response = await this.fetcher(`${ISSUER}/api/accounts/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(30_000) }); }
    catch { throw fail("Não foi possível conectar ao login da OpenAI. Tente novamente.", 503); }
    if (!response.ok) throw fail(`A OpenAI não renovou ou autorizou a conexão (${response.status}). Entre novamente.`);
    const t = await response.json() as Tokens;
    if (!t.access_token || !t.id_token || !Number.isFinite(t.expires_in) || t.expires_in <= 0 || (t.token_type && t.token_type.toLowerCase() !== "bearer")) throw fail("Resposta de autorização inválida.");
    return t;
  }
  async beginSignIn(): Promise<{ authorizationUrl: string; expiresAt: number }> {
    if (this.pending || this.starting) throw fail("Já existe um login em andamento. Termine ou cancele a conexão.", 409);
    this.starting = true;
    try { return await this.createSignIn(); } finally { this.starting = false; }
  }
  private async createSignIn(): Promise<{ authorizationUrl: string; expiresAt: number }> {
    const site = new URL(config.siteUrl);
    if (site.protocol !== "http:" || site.hostname !== "127.0.0.1") throw fail("O login da assinatura está disponível nesta instalação local em 127.0.0.1.");
    const prepared = await this.locked(async () => {
      const saved = await this.load();
      let host: { id: string };
      try { host = JSON.parse(await readFile(path.join(this.directory, "host.json"), "utf8")); }
      catch (e) { if (!missing(e)) throw fail("Identidade da instalação inválida."); host = { id: `urn:uuid:${randomUUID()}` }; await this.atomic("host.json", host); }
      if (!/^urn:uuid:[a-f0-9-]{36}$/.test(host.id)) throw fail("Identidade da instalação inválida.");
      return { saved, host };
    });
    const state = randomBytes(32).toString("base64url"), nonce = randomBytes(32).toString("base64url"), verifier = randomBytes(48).toString("base64url");
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const returnedState = Buffer.from(url.searchParams.get("state") ?? "");
      const expectedState = Buffer.from(state);
      if (req.method !== "GET" || url.pathname !== "/auth/callback" || !this.pending || this.pending.consumed || returnedState.length !== expectedState.length || !timingSafeEqual(returnedState, expectedState)) {
        res.writeHead(400, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }); res.end("Login inválido ou expirado."); return;
      }
      this.pending.consumed = true;
      void this.completeSignIn(url).then(() => {
        res.writeHead(303, { location: new URL("/admin/models", site).toString(), "cache-control": "no-store", "referrer-policy": "no-referrer" });
        res.end();
      }).catch(() => {
        this.error = "Não foi possível concluir o login. Confira as permissões e tente novamente.";
        res.writeHead(400, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }); res.end(this.error);
      }).finally(() => this.cancelSignIn());
    });
    await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    const address = server.address();
    if (!address || typeof address === "string") throw fail("Não foi possível iniciar o retorno do login.");
    const redirectUri = `http://127.0.0.1:${address.port}/auth/callback`, expiresAt = Date.now() + 10 * 60_000;
    const timer = setTimeout(() => { this.error = "O login expirou. Tente novamente."; this.cancelSignIn(); }, 10 * 60_000);
    timer.unref();
    this.pending = { state, nonce, verifier, redirectUri, clientId: prepared.saved?.clientId, subject: prepared.saved?.subject, server, timer, expiresAt, consumed: false };
    this.error = null;
    const url = new URL(`${ISSUER}/api/accounts/authorize`);
    url.search = new URLSearchParams({ client_id: prepared.saved?.clientId ?? "dynamic_agent_client", ext_agent_host_id: prepared.host.id,
      ...(!prepared.saved?.clientId ? { agent_name_hint: "Radar Oftalmologia Brasil" } : {}), response_type: "code", redirect_uri: redirectUri,
      scope: `openid profile email offline_access resource.invoke ${SCOPE}`, resource: RESOURCE, state, nonce,
      code_challenge_method: "S256", code_challenge: createHash("sha256").update(verifier).digest("base64url") }).toString();
    return { authorizationUrl: url.toString(), expiresAt };
  }
  cancelSignIn() {
    if (this.pending) { clearTimeout(this.pending.timer); this.pending.server.close(); this.pending = null; }
  }
  private async completeSignIn(url: URL) {
    const pending = this.pending!;
    if (pending.expiresAt <= Date.now() || url.searchParams.has("error")) throw fail("Login cancelado ou expirado.");
    const supplied = url.searchParams.get("client_id"), clientId = pending.clientId ?? supplied;
    const code = url.searchParams.get("code");
    if (!code || !clientId || !/^[a-zA-Z0-9_-]{1,200}$/.test(clientId) || clientId === "dynamic_agent_client" || (pending.clientId && supplied && supplied !== pending.clientId)) throw fail("Registro de conexão inválido.");
    await this.locked(async () => {
      const existing = await this.load();
      if (existing && existing.clientId !== clientId) throw fail("A conexão mudou durante o login.");
      // Preserva o registro emitido mesmo se a troca do código falhar.
      if (!existing) await this.save({ clientId });
      const tokens = await this.tokenRequest(new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, code,
        code_verifier: pending.verifier, redirect_uri: pending.redirectUri, resource: RESOURCE }));
      const identity = await this.verify(tokens.id_token, clientId, pending.nonce);
      if (pending.subject && identity.subject !== pending.subject) throw fail("A conta retornada é diferente da conexão selecionada.");
      await this.save({ clientId, ...identity, scopes: (tokens.scope ?? "").split(/\s+/), accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token, idToken: tokens.id_token, expiresAt: Date.now() + tokens.expires_in * 1000 });
      this.error = null;
    });
  }
  async credentials(): Promise<{ accessToken: string; accountKey: string }> {
    return this.locked(async () => {
      let saved = await this.load();
      if (!saved?.accessToken || !saved.subject) throw fail("Conecte sua assinatura do ChatGPT no painel de modelos.");
      if (!saved.scopes?.includes(SCOPE)) throw fail("O login não autorizou o uso do plano. Gerencie a permissão nas configurações do ChatGPT.");
      if (saved.pendingRefresh || (saved.expiresAt ?? 0) <= Date.now() + 60_000) {
        if (!saved.pendingRefresh) {
          if (!saved.refreshToken) throw fail("Sua conexão expirou. Entre novamente com ChatGPT.");
          const tokens = await this.tokenRequest(new URLSearchParams({ grant_type: "refresh_token", client_id: saved.clientId,
            refresh_token: saved.refreshToken, resource: RESOURCE }));
          saved.pendingRefresh = { tokens, receivedAt: Date.now() };
          await this.save(saved);
        }
        const { tokens, receivedAt } = saved.pendingRefresh;
        const identity = await this.verify(tokens.id_token, saved.clientId, undefined, undefined, receivedAt);
        if (identity.subject !== saved.subject) throw fail("Não foi possível confirmar a conta na renovação.");
        saved = { clientId: saved.clientId, ...identity, accessToken: tokens.access_token, refreshToken: tokens.refresh_token ?? saved.refreshToken,
          idToken: tokens.id_token, expiresAt: receivedAt + tokens.expires_in * 1000, scopes: tokens.scope ? tokens.scope.split(/\s+/) : saved.scopes };
        await this.save(saved);
      }
      if (!saved.scopes?.includes(SCOPE) || !saved.accessToken || (saved.expiresAt ?? 0) <= Date.now()) throw fail("A conexão precisa de nova autorização para usar o plano.");
      return { accessToken: saved.accessToken, accountKey: createHash("sha256").update(`${saved.clientId}:${saved.subject}`).digest("hex") };
    });
  }
  async models(): Promise<ChatGPTModel[]> {
    const credentials = await this.credentials();
    const r = await this.fetcher(`${RESOURCE}/models`, { headers: { authorization: `Bearer ${credentials.accessToken}` }, signal: AbortSignal.timeout(30_000) });
    if (!r.ok) throw fail(`Não foi possível listar os modelos do plano (${r.status}). Confira o acesso no ChatGPT.`, 503);
    const data = await r.json() as { models?: Array<{ slug: string; display_name: string; visibility: string }> };
    if (!Array.isArray(data.models)) throw fail("Catálogo de modelos do plano inválido.");
    return data.models.filter(m => m.visibility === "list" && typeof m.slug === "string" && typeof m.display_name === "string").map(m => ({ slug: m.slug, displayName: m.display_name }));
  }
  async selectModel(slug: string) {
    const model = (await this.models()).find(m => m.slug === slug);
    if (!model) throw fail("Escolha um modelo disponível para sua conta.");
    await this.locked(() => this.atomic("model.json", model));
    return model;
  }
  async disconnect(): Promise<{ remoteRevoked: boolean }> {
    this.cancelSignIn();
    return this.locked(async () => {
      const saved = await this.load();
      if (!saved) return { remoteRevoked: true };
      let remoteRevoked = !saved.refreshToken;
      if (saved.refreshToken) {
        try {
          const discovery = await this.fetcher(`${ISSUER}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(10_000) });
          const { revocation_endpoint: endpoint } = await discovery.json() as { revocation_endpoint: string };
          const endpointUrl = new URL(endpoint);
          if (endpointUrl.origin !== ISSUER) throw new Error();
          const r = await this.fetcher(endpoint, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: saved.refreshToken, token_type_hint: "refresh_token", client_id: saved.clientId }), signal: AbortSignal.timeout(15_000) });
          remoteRevoked = r.ok;
        } catch { remoteRevoked = false; }
      }
      await this.save({ clientId: saved.clientId, subject: saved.subject, name: saved.name, email: saved.email });
      this.error = remoteRevoked ? null : "A conexão local foi removida. Confirme a desconexão também nas configurações do ChatGPT.";
      return { remoteRevoked };
    });
  }
}

export const chatGPTPlan = new ChatGPTPlan();
export function selectedChatGPTModel(): string {
  try { const value = JSON.parse(readFileSync(path.join(defaultDirectory, "model.json"), "utf8")); return typeof value.slug === "string" ? value.slug : ""; }
  catch { return ""; }
}

export function chatGPTRequestBody(model: string, system: string, user: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>, json: boolean) {
  const content = typeof user === "string" ? user : user.map(p => p.type === "text" ? { type: "input_text", text: p.text } : { type: "input_image", image_url: p.image_url.url });
  return { model, input: [{ role: "user", content }], instructions: `${system}${json ? "\nResponda somente com um objeto JSON válido, sem cercas de código ou texto adicional." : ""}`, store: false, stream: true };
}

// Apenas um response.completed autoriza o pipeline a tratar a resposta como recebida.
export async function readChatGPTStream(response: Response): Promise<{ id: string; choices: Array<{ message: { content: string } }>; usage: Record<string, unknown> }> {
  if (!response.body) throw fail("A OpenAI não retornou uma resposta de processamento.", 503);
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let pending = "", bytes = 0;
  const textParts = new Map<string, { output: number; content: number; text: string }>();
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 8 * 1024 * 1024) throw fail("A resposta do modelo excedeu o limite local.", 503);
      pending += decoder.decode(chunk.value, { stream: true });
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(pending)) !== null) {
        const frame = pending.slice(0, boundary.index).replace(/\r\n/g, "\n"); pending = pending.slice(boundary.index + boundary[0].length);
        const data = frame.split("\n").filter(l => l.startsWith("data:")).map(l => l.slice(5).trimStart()).join("\n");
        if (!data || data === "[DONE]") continue;
        const event = JSON.parse(data) as { type: string; delta?: string; text?: string; output_index?: number; content_index?: number; response?: { id: string; status?: string; output?: Array<{ content?: Array<{ type: string; text?: string }> }>; usage?: Record<string, unknown> } };
        if (["response.failed", "response.incomplete", "error"].includes(event.type)) throw fail("O ChatGPT não concluiu o processamento. Confira o uso e as permissões do plano.", 503);
        if (event.type === "response.output_text.delta" || event.type === "response.output_text.done") {
          const output = event.output_index ?? 0, content = event.content_index ?? 0, key = `${output}:${content}`;
          if (!Number.isSafeInteger(output) || output < 0 || !Number.isSafeInteger(content) || content < 0) throw fail("A OpenAI retornou partes de resposta inválidas.", 503);
          const previous = textParts.get(key)?.text ?? "";
          if (event.type === "response.output_text.delta" && typeof event.delta === "string") textParts.set(key, { output, content, text: previous + event.delta });
          if (event.type === "response.output_text.done" && typeof event.text === "string") textParts.set(key, { output, content, text: event.text });
        }
        if (event.type === "response.completed" && event.response?.status === "completed") {
          const finalText = (event.response.output ?? []).flatMap(o => o.content ?? []).filter(c => c.type === "output_text").map(c => c.text ?? "").join("");
          // A modalidade por assinatura pode omitir output no evento final; o texto já veio em deltas.
          const text = finalText || [...textParts.values()].sort((a, b) => a.output - b.output || a.content - b.content).map(p => p.text).join("");
          if (!text.trim()) throw fail("O ChatGPT retornou uma resposta vazia.", 503);
          const usage = event.response.usage ?? {};
          return { id: event.response.id, choices: [{ message: { content: text } }], usage: { ...usage, prompt_tokens: usage.input_tokens ?? 0, completion_tokens: usage.output_tokens ?? 0 } };
        }
      }
    }
    throw fail("A conexão terminou antes de confirmar o processamento. O pedido não será repetido automaticamente.", 503);
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
