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
