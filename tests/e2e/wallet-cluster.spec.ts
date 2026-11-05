// Wallet instrument cluster: the standalone /wallet page wears the bezel,
// dial, odometer and trip log; the in-drive modal stays a flat sheet.
import { expect, test } from "@playwright/test";
import { uniqueEmail, unlock } from "./helpers";

test.beforeEach(async ({ page }) => {
  await unlock(page, uniqueEmail("cluster"));
});

async function createWallet(page: import("@playwright/test").Page) {
  const res = await page.request.post("/api/wallet");
  expect(res.ok()).toBe(true);
}

test("the page carries the cluster head", async ({ page }) => {
  await page.goto("/wallet");
  await expect(
    page.getByRole("heading", { name: "Instrument cluster", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("SANDBOX · PLAY MONEY ONLY")).toBeVisible();
});

test("a ready wallet wears the bezel, dial and odometer", async ({ page }) => {
  await createWallet(page);
  await page.goto("/wallet");
  await expect(page.locator(".w-balance")).toBeVisible();

  const chrome = await page.evaluate(() => {
    const shell = getComputedStyle(document.querySelector(".wallet-cluster .w-shell")!);
    const dial = getComputedStyle(
      document.querySelector(".wallet-cluster .w-balance-block")!,
      "::before",
    );
    const odo = getComputedStyle(document.querySelector(".wallet-cluster .w-balance-sub")!);
    return {
      shellRadius: shell.borderRadius,
      dialMask: dial.maskImage,
      odoBorder: odo.borderTopWidth,
    };
  });
  expect(chrome.shellRadius).not.toBe("0px");
  expect(chrome.dialMask).not.toBe("none");
  expect(chrome.odoBorder).not.toBe("0px");
});

test("the in-drive wallet modal stays a flat sheet", async ({ page, isMobile }) => {
  // On mobile the wallet opens from the route drawer; wallet-modal.spec
  // already exercises that path — here the flat-shell contract only
  // needs proving once.
  test.skip(isMobile, "covered by wallet-modal.spec on mobile");
  await createWallet(page);
  await page.goto("/track/bitcoin/what-is/satoshi");
  await page.getByRole("button", { name: "Practice wallet" }).click();
  const modal = page.locator(".wallet-modal");
  await expect(modal).toBeVisible();
  await expect(page.locator(".wallet-modal .w-shell").first()).toBeVisible();
  const radius = await page.evaluate(() => {
    const shell = document.querySelector(".wallet-modal .w-shell")!;
    return getComputedStyle(shell).borderRadius;
  });
  expect(radius).toBe("0px");
});

test("no horizontal scroll at 320 px", async ({ page }) => {
  await createWallet(page);
  await page.goto("/wallet");
  await page.setViewportSize({ width: 320, height: 600 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
