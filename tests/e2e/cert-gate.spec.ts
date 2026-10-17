// Cert gate: a direct POST to /api/complete with no exam pass fails.
// The happy path (walk all 25 steps, pass the exam, issue) is walk.spec.ts.
import { expect, test } from "@playwright/test";
import { uniqueEmail, unlock } from "./helpers";

test("direct issue without the exam pass is rejected", async ({ page }) => {
  await unlock(page, uniqueEmail("cgate"));
  const res = await page.request.post("/api/complete", {
    data: { studentName: "Gate Crasher", moduleSlug: "btc-prove-exam" },
  });
  expect(res.status()).toBe(400);
  const body = (await res.json()) as { error?: string };
  expect(body.error ?? "").toMatch(/final exam/);
});
