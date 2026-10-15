// Legacy /module/* routes must not point at removed drive slugs.
// Run with: node --test tests/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("legacy module redirects", () => {
  for (const rel of ["src/app/module/1/page.tsx", "src/app/module/[slug]/page.tsx"]) {
    it(`${rel} falls back to what-is/satoshi, not a dead drive slug`, () => {
      const src = readFileSync(join(root, rel), "utf8");
      assert.match(src, /FALLBACK\s*=\s*"\/track\/bitcoin\/what-is\/satoshi"/);
      assert.doesNotMatch(src, /what-youre-holding/);
      assert.match(src, /resumeHref/);
    });
  }
});
