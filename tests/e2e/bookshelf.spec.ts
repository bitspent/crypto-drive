// Library shelf: six standing volumes on a wooden shelf. One link per
// book, seals and gilt meter from real progress, teaser pages for scaffolds.
import { expect, test, type Page } from "@playwright/test";
import {
  assertNoPageErrors,
  collectPageErrors,
  uniqueEmail,
  unlock,
} from "./helpers";

test.setTimeout(240_000);

let failures: string[] = [];
test.beforeEach(async ({ page }) => {
  failures = collectPageErrors(page);
  await unlock(page, uniqueEmail("tome"));
  await expect(page.getByTestId("track-bookshelf")).toBeVisible();
});

test.afterEach(() => {
  assertNoPageErrors(failures);
});

async function clearTickets(page: Page, picks: [string, string][]): Promise<void> {
  for (const [id, name] of picks) {
    await page
      .getByRole("group", { name: `ticket ${id}` })
      .getByRole("button", { name, exact: true })
      .click();
  }
}

async function commitForward(page: Page, buttonName: string, urlPart: string): Promise<void> {
  await page.getByRole("button", { name: buttonName }).click();
  try {
    await page.waitForURL(`**/${urlPart}`, { timeout: 8000 });
  } catch {
    await page.getByRole("link", { name: "Continue", exact: true }).click();
    await page.waitForURL(`**/${urlPart}`);
  }
}

test("shelf opens with six books, primer centred", async ({ page }) => {
  await expect(page.getByTestId(/shelf-book-/)).toHaveCount(6);
  await expect(page.getByTestId("shelf-book-money-map")).toHaveAttribute("data-active", "true");
  await expect(page.getByTestId("shelf-book-money-map")).toContainText("Money map");
  await expect(page.getByTestId("shelf-book-bitcoin")).toContainText("Bitcoin");
});

test("next arrow and dots browse the slider", async ({ page }) => {
  await page.getByRole("button", { name: "Next book" }).click();
  await expect(page.getByTestId("shelf-book-bitcoin")).toHaveAttribute("data-active", "true");
  await page.getByRole("button", { name: "Show Solana" }).click();
  await expect(page.getByTestId("shelf-book-solana")).toHaveAttribute("data-active", "true");
  await page.getByRole("button", { name: "Previous book" }).click();
  await expect(page.getByTestId("shelf-book-tron")).toHaveAttribute("data-active", "true");
});

test("arrow keys browse and move focus", async ({ page }) => {
  await page.getByRole("link", { name: "Money map — not opened" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("shelf-book-bitcoin")).toHaveAttribute("data-active", "true");
  await expect(page.getByRole("link", { name: "Bitcoin — not opened" })).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByTestId("shelf-book-money-map")).toHaveAttribute("data-active", "true");
});

test("dragging glides to the next book without opening it", async ({ page }) => {
  const stage = page.getByRole("group", { name: "Course books slider" });
  const box = await stage.boundingBox();
  if (!box) throw new Error("slider has no box");
  const cy = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, cy);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 140, cy, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByTestId("shelf-book-bitcoin")).toHaveAttribute("data-active", "true");
  await expect(page).toHaveURL(/\/course$/);
});

test("a short slow drag snaps back and does not open", async ({ page }) => {
  const stage = page.getByRole("group", { name: "Course books slider" });
  const box = await stage.boundingBox();
  if (!box) throw new Error("slider has no box");
  const cy = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, cy);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 30, cy, { steps: 6 });
  await page.waitForTimeout(180); // hold still: momentum must die
  await page.mouse.up();
  await expect(page.getByTestId("shelf-book-money-map")).toHaveAttribute("data-active", "true");
  await expect(page).toHaveURL(/\/course$/);
});

test("a quick flick advances on momentum alone", async ({ page }) => {
  const stage = page.getByRole("group", { name: "Course books slider" });
  const box = await stage.boundingBox();
  if (!box) throw new Error("slider has no box");
  const cy = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, cy);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 38, cy, { steps: 2 });
  await page.mouse.up();
  await expect(page.getByTestId("shelf-book-bitcoin")).toHaveAttribute("data-active", "true");
  await expect(page).toHaveURL(/\/course$/);
});

test("two fingers glide the shelf, overriding OS gestures", async ({ page }) => {
  const stage = page.getByRole("group", { name: "Course books slider" });
  const box = await stage.boundingBox();
  if (!box) throw new Error("slider has no box");
  const cy = box.y + box.height / 2;
  const cx = box.x + box.width / 2;
  const cdp = await page.context().newCDPSession(page);
  const touches = (dx: number) => [
    { x: cx - 40 + dx, y: cy, id: 1 },
    { x: cx + 40 + dx, y: cy, id: 2 },
  ];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: touches(0) });
  for (let i = 1; i <= 6; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: touches(-i * 22) });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(page.getByTestId("shelf-book-bitcoin")).toHaveAttribute("data-active", "true");
  await expect(page).toHaveURL(/\/course$/);
});

test("a book tap opens its track", async ({ page }) => {
  await page.getByRole("link", { name: "Bitcoin — not opened" }).click();
  await page.waitForURL("**/track/bitcoin");
});

test("keyboard opens the focused book", async ({ page }) => {
  await page.getByRole("link", { name: "Money map — not opened" }).focus();
  await page.keyboard.press("Enter");
  await page.waitForURL("**/track/money-map");
});

test("coming books open their teaser page", async ({ page }) => {
  await page.getByRole("button", { name: "Show Ethereum" }).click();
  await expect(page.getByTestId("shelf-book-ethereum")).toHaveAttribute("data-active", "true");
  await page.getByRole("link", { name: "Ethereum — coming next" }).click();
  await page.waitForURL("**/track/ethereum");
  await expect(
    page.getByText("TRACK B · ETHEREUM · COMING NEXT"),
  ).toBeVisible();
});

test("fresh learner sees not-opened and coming stamps", async ({ page }) => {
  await expect(page.getByTestId("shelf-stamp-money-map")).toHaveText("NOT OPENED");
  await expect(page.getByTestId("shelf-stamp-bitcoin")).toHaveText("NOT OPENED");
  await expect(page.getByTestId("shelf-stamp-ethereum")).toHaveText("COMING NEXT");
});

test("coming books carry no meter", async ({ page }) => {
  await expect(
    page.getByTestId("shelf-book-ethereum").getByRole("progressbar"),
  ).toHaveCount(0);
});

test("two passed stops show an in-progress seal and meter", async ({ page }) => {
  await page.getByRole("link", { name: "Money map — not opened" }).click();
  await page.waitForURL("**/track/money-map");
  await page.getByRole("link", { name: "Start the drive" }).click();
  await page.waitForURL("**/first/do");

  await clearTickets(page, [
    ["t1", "Small coins and notes"],
    ["t2", "Coins and notes in a tin box"],
    ["t3", "The same unit of counting"],
  ]);
  await commitForward(page, "Test the five jobs", "first/melt");

  await clearTickets(page, [
    ["t1", "Prices rose while the jar sat still"],
    ["t2", "Cash folded in a drawer"],
    ["t3", "People holding cash savings"],
  ]);
  await commitForward(page, "Feel the melt", "first/promise");

  await page.goto("/course");
  await expect(page.getByTestId("shelf-stamp-money-map")).toHaveText(
    "2/5 · IN PROGRESS",
  );
  const meter = page
    .getByTestId("shelf-book-money-map")
    .getByRole("progressbar", { name: "Money map progress" });
  await expect(meter).toHaveAttribute("aria-valuenow", "2");
  await expect(meter).toHaveAttribute("aria-valuemax", "5");
});

test("finishing the primer stamps it done", async ({ page }) => {
  await page.getByRole("link", { name: "Money map — not opened" }).click();
  await page.waitForURL("**/track/money-map");
  await page.getByRole("link", { name: "Start the drive" }).click();
  await page.waitForURL("**/first/do");

  const answers: Record<string, [string, string][]> = {
    do: [
      ["t1", "Small coins and notes"],
      ["t2", "Coins and notes in a tin box"],
      ["t3", "The same unit of counting"],
    ],
    melt: [
      ["t1", "Prices rose while the jar sat still"],
      ["t2", "Cash folded in a drawer"],
      ["t3", "People holding cash savings"],
    ],
    promise: [
      ["t1", "A promise between banks, settled later"],
      ["t2", "Numbers in the bank's promise ledger"],
      ["t3", "It lent the promises out and keeps only a fraction"],
    ],
    distance: [
      ["t1", "Fees and the exchange-rate cut"],
      ["t2", "Agent A: 8% fee, arrives in 3 days"],
      ["t3", "Money arriving before the pharmacy closes"],
    ],
    bearer: [
      ["t1", "A banknote in your hand"],
      ["t2", "Holding it IS owning it — no account to ask"],
      ["t3", "Bitcoin, held in your own wallet"],
    ],
  };
  const legs: [keyof typeof answers, string, string][] = [
    ["do", "Test the five jobs", "first/melt"],
    ["melt", "Feel the melt", "first/promise"],
    ["promise", "Follow the promise", "first/distance"],
    ["distance", "Price the road", "first/bearer"],
  ];
  for (const [slug, button, next] of legs) {
    await clearTickets(page, answers[slug]);
    await commitForward(page, button, next);
  }
  await clearTickets(page, answers.bearer);
  await page.getByRole("button", { name: "Start the Bitcoin road" }).click();
  await page.getByRole("link", { name: "Back to your course" }).click();
  await page.waitForURL("**/course");

  await expect(page.getByTestId("shelf-stamp-money-map")).toHaveText("DONE");
  const meter = page
    .getByTestId("shelf-book-money-map")
    .getByRole("progressbar", { name: "Money map progress" });
  await expect(meter).toHaveAttribute("aria-valuenow", "5");
  await expect(meter).toHaveAttribute("aria-valuemax", "5");
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("shelf stays fully usable without motion", async ({ page }) => {
    await expect(page.getByTestId(/shelf-book-/)).toHaveCount(6);
    await page.getByRole("link", { name: "Bitcoin — not opened" }).click();
    await page.waitForURL("**/track/bitcoin");
  });
});

test("no horizontal scroll at 320 px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 600 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
