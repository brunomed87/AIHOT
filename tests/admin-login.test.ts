import "./setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import Fastify from "fastify";

process.env.ADMIN_PASSWORD = "test-admin-password-0123456789";
const { registerAdminAuth } = await import("../apps/api/src/routes/admin-auth.ts");
const { closeDb } = await import("@aihot/backend/db");
const app = Fastify();
registerAdminAuth(app);
after(async () => { await app.close(); await closeDb(); });

test("password login converts an old data return URL to the admin page and keeps the session", async () => {
  const response = await app.inject({
    method: "POST", url: "/api/auth/password",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    payload: new URLSearchParams({ password: process.env.ADMIN_PASSWORD!, return: "/admin/sources.data?_routes=admin-layout&page=2" }).toString(),
  });
  assert.equal(response.statusCode, 303);
  assert.equal(response.headers.location, "/admin/sources?page=2");
  const cookie = String(response.headers["set-cookie"]).split(";")[0]!;
  const me = await app.inject({ method: "GET", url: "/api/admin/me", headers: { cookie } });
  assert.equal(me.statusCode, 200);
  assert.equal(me.json().dev, false);
});

test("a rejected password and the proxy login also preserve a page return URL", async () => {
  for (const response of [
    await app.inject({ method: "POST", url: "/api/auth/password", payload: { password: "wrong", return: "/admin/sources.data?_routes=admin-layout&page=2" } }),
    await app.inject({ method: "GET", url: `/api/auth/login?${new URLSearchParams({ return: "https://local/admin/sources.data?_routes=admin-layout&page=2" })}` }),
  ]) {
    const login = new URL(String(response.headers.location), "http://local");
    assert.equal(login.pathname, "/admin/login");
    assert.equal(login.searchParams.get("return"), "/admin/sources?page=2");
  }
});
