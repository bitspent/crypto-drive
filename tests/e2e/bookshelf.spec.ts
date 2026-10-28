// Bookshelf: the /course CSS-3D track picker. Swipe/buttons/dots/keyboard
// move the active book; tapping a ready book opens its track.
import { expect, test } from "@playwright/test";
import {
  assertNoPageErrors,
  collectPageErrors,
  uniqueEmail,
  unlock,
} from "./helpers";

test.setTimeout(120_000);

let failures: string[] = [];
test.beforeEach(async ({ page }) => {
  failures = collectPageErrors(page);
  await unlock(page, uniqueEmail("shelf"));
  await expect(page.getByTestId("track-bookshelf")).toBeVisible();
});

test.afterEach(() => {
  assertNoPageErrors(failures);
});

test("shelf opens with the primer front and center", async ({ page }) => {
  const books = page.getByTestId(/shelf-book-/);
  await expect(books).toHaveCount(6);
  await expect(page.getByTestId("shelf-book-money-map")).toHaveAttribute(
    "data-active",
    "true",
  );
});

test("next button and dots move the active book", async ({ page }) => {
  await page.getByTestId("shelf-next").click();
  await expect(page.getByTestId("shelf-book-bitcoin")).toHaveAttribute(
    "data-active",
    "true",
  );
  await page.getByTestId("shelf-dot-usdt-networks").click();
  await expect(page.getByTestId("shelf-book-usdt-networks")).toHaveAttribute(
    "data-active",
    "true",
  );
});

test("arrow keys browse the shelf", async ({ page }) => {
  await page.getByTestId("track-bookshelf").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("shelf-book-bitcoin")).toHaveAttribute(
    "data-active",
    "true",
  );
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByTestId("shelf-book-money-map")).toHaveAttribute(
    "data-active",
    "true",
  );
});

test("tapping a ready book opens its track", async ({ page }) => {
  await page.getByTestId("shelf-next").click();
  await page
    .getByTestId("shelf-book-bitcoin")
    .getByRole("link", { name: "Open Bitcoin" })
    .click();
  await page.waitForURL("**/track/bitcoin");
});

test("swipe left advances the shelf", async ({ page }) => {
  // Synthetic touches: CDP gesture injection is swallowed over links in
  // mobile emulation, so drive the real React touch path directly.
  await page.evaluate(() => {
    const link = document.querySelector('[data-testid="shelf-book-money-map"] a')!;
    const r = link.getBoundingClientRect();
    const x = r.x + r.width / 2;
    const y = r.y + r.height / 2;
    const send = (type: string, tx: number) => {
      const t = new Touch({ identifier: 7, target: link, clientX: tx, clientY: y });
      link.dispatchEvent(
        new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          touches: type === "touchend" ? [] : [t],
          changedTouches: [t],
        }),
      );
    };
    send("touchstart", x);
    send("touchend", x - 120);
  });
  await expect(page.getByTestId("shelf-book-bitcoin")).toHaveAttribute(
    "data-active",
    "true",
  );
});

test("coming tracks sit greyed out with no link", async ({ page }) => {
  const eth = page.getByTestId("shelf-book-ethereum");
  await expect(eth.getByRole("link")).toHaveCount(0);
  await expect(eth).toContainText("coming next");
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("shelf flattens to a browsable row", async ({ page }) => {
    // Controls hide; every book lays flat and stays tappable.
    await expect(page.getByTestId("shelf-next")).toBeHidden();
    for (const slug of [
      "money-map",
      "bitcoin",
      "ethereum",
      "usdt-networks",
      "tron",
      "solana",
    ]) {
      await expect(page.getByTestId(`shelf-book-${slug}`)).toBeVisible();
    }
    await page
      .getByTestId("shelf-book-bitcoin")
      .getByRole("link", { name: "Open Bitcoin" })
      .click();
    await page.waitForURL("**/track/bitcoin");
  });
});
