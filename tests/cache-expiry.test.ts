// Cortes temporais usam relógio controlado e barreiras de promessas, sem espera real que esconda resultados expirados.
import assert from "node:assert/strict";
import { test } from "node:test";
import { cached } from "@aihot/backend/lib/cache";
function gate<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(open => { resolve = open; });
  return { promise, resolve };
}

test("Corte absoluto prevalece sobre janelas de cache e compartilha atualização concorrente", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1000 });
  let loads = 0;
  const pending = gate<{ expires: number; value: number }>();
  const cache = cached(async () => ++loads === 1 ? { expires: 2000, value: 1 } : pending.promise,
    { freshMs: 60_000, maxStaleMs: 600_000, expiresAt: value => value.expires });
  assert.equal((await cache.get()).value, 1);
  t.mock.timers.setTime(2000);
  const a = cache.get();
  const b = cache.get();
  assert.equal(loads, 2);
  pending.resolve({ expires: 3000, value: 2 });
  assert.deepEqual(await Promise.all([a, b]), [{ expires: 3000, value: 2 }, { expires: 3000, value: 2 }]);
});

test("Leitor após publicação rejeita resposta antiga ainda em andamento", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1000 });
  const pending = gate<{ expires: number; value: number }>();
  let loads = 0;
  const cache = cached(async () => ++loads === 1 ? pending.promise : { expires: 3000, value: 2 },
    { freshMs: 60_000, maxStaleMs: 600_000, expiresAt: value => value.expires });
  const before = cache.get();
  t.mock.timers.setTime(2000);
  const after = cache.get();
  pending.resolve({ expires: 2000, value: 1 });
  await before;
  assert.equal((await after).value, 2);
  assert.equal(loads, 2);
});

test("Limpeza impede requisição anterior de substituir valor novo ou remover compartilhamento", async () => {
  const first = gate<number>();
  const second = gate<number>();
  let loads = 0;
  const cache = cached(() => ++loads === 1 ? first.promise : second.promise, { freshMs: 60_000, maxStaleMs: 600_000 });
  const old = cache.get();
  cache.clear();
  const current = cache.get();
  first.resolve(1);
  assert.equal(await old, 1);
  const shared = cache.get();
  assert.equal(loads, 2);
  second.resolve(2);
  assert.deepEqual(await Promise.all([current, shared, cache.get()]), [2, 2, 2]);
});

test("Erro após corte é propagado sem retornar retrato expirado", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1000 });
  let loads = 0;
  const cache = cached(async () => { if (++loads > 1) throw new Error("测试数据库失败"); return { expires: 2000 }; },
    { freshMs: 60_000, maxStaleMs: 600_000, expiresAt: value => value.expires });
  await cache.get();
  t.mock.timers.setTime(2000);
  await assert.rejects(cache.get(), /测试数据库失败/);
});


test("Sem corte absoluto mantém atualização de fundo existente", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1000 });
  let loads = 0;
  const cache = cached(async () => ++loads, { freshMs: 1000, maxStaleMs: 10_000 });
  assert.equal(await cache.get(), 1);
  t.mock.timers.setTime(2000);
  assert.equal(await cache.get(), 1, "普通stale窗口仍立即返回旧值");
  assert.equal(await cache.get(), 2);
  assert.equal(loads, 2);
});
