import { test, expect } from "@playwright/test";

test("GET /api/health reports ok with db and bitcoin mode", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(["file", "postgres"]).toContain(body.db);
  expect(body.bitcoin).toBe("simulated");
});
