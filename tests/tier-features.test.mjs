// Tier packaging flags for Starter / Certified / VIP.
// Run with: node --test tests/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadTier(id) {
  return JSON.parse(readFileSync(join(root, `content/tiers/${id}.json`), "utf8"));
}

describe("tier feature flags", () => {
  it("gives Starter full practice without certificate or verify link", () => {
    const f = loadTier("starter").features;
    assert.equal(f.fullPractice, true);
    assert.equal(f.certificate, false);
    assert.equal(f.verifyLink, false);
    assert.equal(f.liveCall, false);
  });

  it("gives Certified practice + certificate + verify link", () => {
    const f = loadTier("certified").features;
    assert.equal(f.fullPractice, true);
    assert.equal(f.certificate, true);
    assert.equal(f.verifyLink, true);
    assert.equal(f.liveCall, false);
  });

  it("gives VIP the Certified package plus liveCall", () => {
    const f = loadTier("vip").features;
    assert.equal(f.fullPractice, true);
    assert.equal(f.certificate, true);
    assert.equal(f.verifyLink, true);
    assert.equal(f.liveCall, true);
  });
});
