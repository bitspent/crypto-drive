import { expect, type Page } from "@playwright/test";

export const DEMO_LICENSE = "CD-DRIVE-2026";

export function uniqueEmail(prefix: string): string {
  return `pw-${prefix}-${Date.now()}@example.com`;
}

export async function unlock(page: Page, email: string, base = ""): Promise<void> {
  await page.goto(`${base}/unlock`);
  await page.fill("#email", email);
  await page.fill("#license", DEMO_LICENSE);
  await Promise.all([page.waitForURL("**/course"), page.click('button[type="submit"]')]);
}

/** Collect console/page/network failures like the operator scripts did. */
export function collectPageErrors(page: Page): string[] {
  const failures: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") failures.push(`console.error: ${msg.text().slice(0, 200)}`);
  });
  page.on("pageerror", (err) => {
    failures.push(`pageerror: ${String(err).slice(0, 200)}`);
  });
  page.on("response", (res) => {
    if (res.status() >= 400) failures.push(`HTTP ${res.status()} for ${res.url().slice(0, 120)}`);
  });
  page.on("requestfailed", (req) => {
    const text = req.failure()?.errorText ?? "";
    if (text.toLowerCase().includes("abort")) return; // cancelled RSC prefetch on nav
    failures.push(`requestfailed (${text}): ${req.url().slice(0, 120)}`);
  });
  return failures;
}

export function assertNoPageErrors(failures: string[]): void {
  expect(failures, failures.join("\n")).toEqual([]);
}

/** Layout contract: left column and illustration stay within the drive head. */
export async function expectLayoutContract(page: Page, tag: string): Promise<void> {
  await page.waitForSelector(".toy-stage");
  const m = await page.evaluate(() => {
    const r = (el: Element | null) => {
      const b = (el ?? document.body).getBoundingClientRect();
      return { l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width) };
    };
    return {
      head: r(document.querySelector(".drive-head")),
      left: r(document.querySelector(".drive-split > :first-child")),
      stage: r(document.querySelector(".toy-stage")),
    };
  });
  expect(m.left.r, `${tag}: left.r=${m.left.r} head.r=${m.head.r}`).toBeLessThanOrEqual(
    m.head.r + 1,
  );
  expect(m.stage.r, `${tag}: stage.r=${m.stage.r} head.r=${m.head.r}`).toBeLessThanOrEqual(
    m.head.r + 1,
  );
}
