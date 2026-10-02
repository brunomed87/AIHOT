import assert from "node:assert/strict";
import { test } from "node:test";
import { adminGet } from "../app/lib/admin.server.ts";
import { safeAdminReturn } from "@aihot/contracts/admin-return";

test("login return URLs keep page filters and reject destinations outside the admin", () => {
  for (const [input, expected] of [
    ["/admin", "/admin"],
    ["/admin.data?_routes=admin-layout", "/admin"],
    ["/admin/sources.data?page=2&_routes=admin-layout&search=olho", "/admin/sources?page=2&search=olho"],
    ["/admin/sources?search=olho%20seco#fontes", "/admin/sources?search=olho+seco#fontes"],
    ["https://local/admin/sources.data?page=2", "/admin/sources?page=2"],
    ["//evil.example/admin", "/admin"],
    ["/administrator", "/admin"],
    ["/admin/../radar", "/admin"],
    ["/admin/%2e%2e/radar", "/admin"],
    ["https://invalid[", "/admin"],
  ]) assert.equal(safeAdminReturn(input!), expected);
});

test("an expired admin session returns to the HTML page after a data navigation", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 401 });
  try {
    await assert.rejects(
      adminGet(new Request("http://local/admin/sources.data?_routes=admin-layout,routes/admin/sources&page=2&search=olho"), "/api/admin/sources"),
      (error: unknown) => {
        assert(error instanceof Response);
        assert.equal(error.status, 302);
        const login = new URL(error.headers.get("location")!, "http://local");
        assert.equal(login.pathname, "/admin/login");
        assert.equal(login.searchParams.get("return"), "/admin/sources?page=2&search=olho");
        return true;
      },
    );
  } finally {
    globalThis.fetch = original;
  }
});
