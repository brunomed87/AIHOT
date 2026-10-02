// Ferramentas da instalação local; uma conferência explícita consome uma chamada do plano.
const command = process.argv[2] ?? "status";
if (!["status", "models", "test"].includes(command)) throw new Error("Use chatgpt status, models ou test.");
if (command === "test") process.env.MODEL_CALLS_ENABLED = "true";
const { chatGPTPlan } = await import("@aihot/backend/providers/chatgpt");
const { closeDb } = await import("@aihot/backend/db");
try {
  if (command === "status") console.log(JSON.stringify(await chatGPTPlan.status(), null, 2));
  else if (command === "models") console.log(JSON.stringify(await chatGPTPlan.models(), null, 2));
  else {
    const { chatJson } = await import("@aihot/backend/providers/llm");
    const { completeReceipt } = await import("@aihot/backend/providers/receipts");
    const { sql } = await import("@aihot/backend/db");
    const { z } = await import("zod");
    const result = await chatJson({ model: "chatgpt-plan", purpose: "chatgpt_connection_test", subject: "chatgpt:connection",
      promptVersion: "chatgpt-connection-v1", attemptTag: String(Date.now()), system: "Confira apenas a conexão. Responda exatamente com o objeto JSON {\"conexao\":\"ok\"}.",
      user: "Teste da conexão do Radar Oftalmologia Brasil.", schema: z.object({ conexao: z.literal("ok") }), maxTokens: 512 });
    await completeReceipt(sql, result.receiptId);
    console.log(JSON.stringify({ conexao: result.data.conexao, receiptId: result.receiptId, usage: result.usage }));
  }
} finally { await closeDb(); }
