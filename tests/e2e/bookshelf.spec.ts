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

test("the footer button opens its track", async ({ page }) => {
  await page.getByTestId("shelf-next").click();
  await page
    .getByTestId("shelf-book-bitcoin")
    .getByRole("link", { name: "Open Bitcoin — first drive" })
    .click();
  await page.waitForURL("**/track/bitcoin");
});

test("dragging over the footer button does not navigate", async ({ page }) => {
  await page.evaluate(() => {
    const shelf = document.querySelector('[data-testid="track-bookshelf"]')!;
    const cta = document.querySelector('[data-testid="shelf-book-money-map"] .bookshelf-cta')!;
    const r = cta.getBoundingClientRect();
    const x = r.x + r.width / 2;
    const y = r.y + r.height / 2;
    const send = (type: string, tx: number) =>
      shelf.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          buttons: 1,
          clientX: tx,
          clientY: y,
          pointerId: 7,
          pointerType: "touch",
        }),
      );
    send("pointerdown", x);
    send("pointermove", x - 120);
    window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    (cta as HTMLElement).click();
  });
  await page.waitForURL("**/course");
  await expect(page.getByTestId("shelf-book-bitcoin")).toHaveAttribute(
    "data-active",
    "true",
  );
});

test("drag left glides the shelf to the next book", async ({ page }) => {
  // Synthetic pointers: CDP gesture injection is swallowed over links in
  // mobile emulation, so drive the real React pointer path directly.
  await page.evaluate(() => {
    const shelf = document.querySelector('[data-testid="track-bookshelf"]')!;
    const r = shelf.getBoundingClientRect();
    const x = r.x + r.width / 2;
    const y = r.y + 200;
    const send = (type: string, tx: number) =>
      shelf.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          buttons: 1,
          clientX: tx,
          clientY: y,
          pointerId: 7,
          pointerType: "touch",
        }),
      );
    send("pointerdown", x);
    send("pointermove", x - 60);
    send("pointermove", x - 120);
    window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
  });
  await expect(page.getByTestId("shelf-book-bitcoin")).toHaveAttribute(
    "data-active",
    "true",
  );
});

test("a short drag snaps back without moving", async ({ page }) => {
  await page.evaluate(() => {
    const shelf = document.querySelector('[data-testid="track-bookshelf"]')!;
    const r = shelf.getBoundingClientRect();
    const x = r.x + r.width / 2;
    const y = r.y + 200;
    const send = (type: string, tx: number) =>
      shelf.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          buttons: 1,
          clientX: tx,
          clientY: y,
          pointerId: 7,
          pointerType: "touch",
        }),
      );
    send("pointerdown", x);
    send("pointermove", x - 20);
    window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
  });
  await expect(page.getByTestId("shelf-book-money-map")).toHaveAttribute(
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
    // Flattened row exposes every book, so every CTA opens directly.
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
      .getByRole("link", { name: "Open Bitcoin — first drive" })
      .click();
    await page.waitForURL("**/track/bitcoin");
  });
});
