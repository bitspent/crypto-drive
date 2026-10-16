// Bitcoin modes: regtest hooks 404 outside regtest mode; the fees route
// resolves today's static tiers in simulated mode.
import { expect, test } from "@playwright/test";
import { uniqueEmail, unlock } from "./helpers";

test("regtest fund and mine 404 in simulated mode", async ({ page }) => {
  await unlock(page, uniqueEmail("bmodes"));
  const fund = await page.request.post("/api/wallet/regtest/fund", {
    data: { amountSats: 500000 },
  });
  expect(fund.status()).toBe(404);
  const mine = await page.request.post("/api/wallet/regtest/mine", {
    data: { blocks: 1 },
  });
  expect(mine.status()).toBe(404);
});

test("fees route returns the static tiers in simulated mode", async ({ page }) => {
  await unlock(page, uniqueEmail("bmodes"));
  const res = await page.request.get("/api/wallet/fees");
  expect(res.ok()).toBe(true);
  const data = (await res.json()) as {
    tiers: { id: string; label: string; satPerVb: number; etaLabel: string }[];
  };
  expect(data.tiers.map((t) => [t.id, t.satPerVb])).toEqual([
    ["economy", 1],
    ["standard", 5],
    ["priority", 15],
  ]);
});
