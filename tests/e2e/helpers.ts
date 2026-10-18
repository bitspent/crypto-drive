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

/**
 * Layout contract: narrow top-anchored rail + content. Desktop (>=1024):
 * the rail is visible at 260px, top-aligned with the content, sticky, and
 * the content never exceeds the drive-head width. Below 1024: single
 * column, rail hidden, Route trigger visible.
 */
export async function expectLayoutContract(page: Page, tag: string): Promise<void> {
  await page.waitForSelector(".drive-layout");
  // Measure the at-rest alignment: reset scroll so a sticky-pinned rail and
  // a scrolled content column can't skew the viewport-relative comparison.
  await page.evaluate(() => window.scrollTo(0, 0));
  const wide = await page.evaluate(() => window.innerWidth >= 1024);
  const m = await page.evaluate(() => {
    const r = (el: Element | null) => {
      const b = (el ?? document.body).getBoundingClientRect();
      return {
        t: Math.round(b.top),
        l: Math.round(b.left),
        r: Math.round(b.right),
        w: Math.round(b.width),
      };
    };
    const rail = document.querySelector(".drive-layout > nav.drive-rail");
    const cs = rail ? getComputedStyle(rail) : null;
    const trigger = document.querySelector(".drive-route-trigger") as HTMLElement | null;
    return {
      head: r(document.querySelector(".drive-head")),
      rail: r(rail),
      content: r(document.querySelector(".drive-layout > div")),
      railDisplay: cs?.display ?? "missing",
      railPosition: cs?.position ?? "missing",
      railAlign: cs?.alignSelf ?? "missing",
      cols: getComputedStyle(document.querySelector(".drive-layout") as Element)
        .gridTemplateColumns,
      triggerVisible: !!trigger && trigger.offsetParent !== null,
    };
  });
  if (wide) {
    expect(m.railDisplay, `${tag}: rail display`).toBe("block");
    expect(m.rail.w, `${tag}: rail width`).toBeGreaterThanOrEqual(258);
    expect(m.rail.w, `${tag}: rail width`).toBeLessThanOrEqual(262);
    expect(m.railPosition, `${tag}: rail position`).toBe("sticky");
    expect(m.railAlign, `${tag}: rail align`).toBe("start");
    expect(
      Math.abs(m.rail.t - m.content.t),
      `${tag}: rail top ${m.rail.t} vs content top ${m.content.t}`,
    ).toBeLessThanOrEqual(2);
    expect(
      m.cols.split(" ").length,
      `${tag}: two grid tracks, got ${m.cols}`,
    ).toBe(2);
  } else {
    expect(m.railDisplay, `${tag}: rail display`).toBe("none");
    expect(m.triggerVisible, `${tag}: Route trigger visible`).toBe(true);
  }
  expect(m.content.r, `${tag}: content.r=${m.content.r} head.r=${m.head.r}`).toBeLessThanOrEqual(
    m.head.r + 1,
  );
}
