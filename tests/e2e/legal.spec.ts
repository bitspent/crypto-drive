import { test, expect } from "@playwright/test";
import { assertNoPageErrors, collectPageErrors } from "./helpers";

const PAGES = [
  { path: "/terms", link: "Terms", heading: "Terms of Service" },
  { path: "/privacy", link: "Privacy", heading: "Privacy Policy" },
  { path: "/refund", link: "Refund", heading: "Refund Policy" },
] as const;

for (const { path, link, heading } of PAGES) {
  test(`${path} reachable from unlock footer, renders clean, links home`, async ({
    page,
  }) => {
    const failures = collectPageErrors(page);
    await page.goto("/unlock");
    await page
      .getByRole("navigation", { name: "Legal" })
      .getByRole("link", { name: link })
      .click();
    await page.waitForURL(`**${path}`);
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
    await expect(page.getByText(/Last updated:/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Back home" })).toBeVisible();
    await page.getByRole("link", { name: "Back home" }).click();
    await page.waitForURL("/");
    assertNoPageErrors(failures);
  });

  test(`${path} has no horizontal scroll`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test("unlock form carries the consent small print with three links", async ({
  page,
}) => {
  await page.goto("/unlock");
  const consent = page.getByText(/By unlocking, you agree to the/);
  await expect(consent).toBeVisible();
  for (const [name, href] of [
    ["Terms", "/terms"],
    ["Privacy Policy", "/privacy"],
    ["Refund Policy", "/refund"],
  ] as const) {
    await expect(consent.getByRole("link", { name })).toHaveAttribute("href", href);
  }
});
