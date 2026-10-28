// Track seal states for shelf cover stamps.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const jiti = createJiti(join(root, "tests/drive-seal.test.mjs"));
const { trackSeal } = jiti(join(root, "src/lib/drive.ts"));

const drives = [
  { steps: [{ id: "a" }, { id: "b" }] },
  { steps: [{ id: "c" }] },
];

describe("track seal", () => {
  it("marks untouched ready tracks as not opened", () => {
    const seal = trackSeal("ready", drives, {});
    assert.equal(seal.kind, "new");
    assert.equal(seal.label, "NOT OPENED");
    assert.equal(seal.pct, 0);
  });

  it("reports partial progress with counts", () => {
    const seal = trackSeal("ready", drives, { a: "1", b: "2" });
    assert.equal(seal.kind, "progress");
    assert.equal(seal.label, "2/3 · IN PROGRESS");
    assert.equal(seal.pct, 67);
  });

  it("marks fully passed tracks done", () => {
    const seal = trackSeal("ready", drives, { a: "1", b: "2", c: "3" });
    assert.equal(seal.kind, "done");
    assert.equal(seal.label, "DONE");
    assert.equal(seal.pct, 100);
  });

  it("marks scaffolds as coming next regardless of passes", () => {
    const seal = trackSeal("coming", drives, { a: "1" });
    assert.equal(seal.kind, "coming");
    assert.equal(seal.label, "COMING NEXT");
  });
});
