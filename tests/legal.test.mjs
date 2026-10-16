// Legal pages: content docs are complete, well-formed, and lawyer-reviewable
// from a single source of truth per page (src/content/legal/*.ts).
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const jiti = createJiti(join(root, "tests/legal.test.mjs"));
const shared = jiti(join(root, "src/content/legal/shared.ts"));
const terms = jiti(join(root, "src/content/legal/terms.ts")).termsDoc;
const privacy = jiti(join(root, "src/content/legal/privacy.ts")).privacyDoc;
const refund = jiti(join(root, "src/content/legal/refund.ts")).refundDoc;

const DOCS = { terms, privacy, refund };
const savedEnv = { ...process.env };

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL;
});
afterEach(() => {
  process.env = { ...savedEnv };
});

describe("legal docs", () => {
  for (const [name, doc] of Object.entries(DOCS)) {
    it(`${name}: has title, description, updated line, and sections`, () => {
      assert.ok(doc.title.length > 0);
      assert.ok(doc.description.length > 20);
      assert.match(doc.updated, /^[A-Z][a-z]+ \d{1,2}, \d{4}$/);
      assert.ok(doc.sections.length >= 3, "at least 3 sections");
    });

    it(`${name}: every section has a heading and non-empty blocks`, () => {
      for (const section of doc.sections) {
        assert.ok(section.heading.trim().length > 0);
        assert.ok(section.blocks.length >= 1);
        for (const block of section.blocks) {
          if (block.type === "paragraph") {
            assert.ok(block.text.trim().length > 20);
          } else if (block.type === "list") {
            assert.ok(block.items.length >= 2);
            for (const item of block.items) assert.ok(item.trim().length > 0);
          } else {
            assert.fail(`unknown block type in ${name}/${section.heading}`);
          }
        }
      }
    });
  }

  it("every doc carries the same last-updated date", () => {
    assert.equal(terms.updated, shared.LEGAL_UPDATED);
    assert.equal(privacy.updated, shared.LEGAL_UPDATED);
    assert.equal(refund.updated, shared.LEGAL_UPDATED);
  });

  it("contact helpers return valid emails and derive from NEXT_PUBLIC_APP_URL", () => {
    assert.match(shared.supportEmail(), /^hello@.+\..+$/);
    assert.match(shared.privacyEmail(), /^privacy@.+\..+$/);
    process.env.NEXT_PUBLIC_APP_URL = "https://example.org/";
    assert.equal(shared.supportEmail(), "hello@example.org");
    assert.equal(shared.privacyEmail(), "privacy@example.org");
  });

  it("falls back to the yourdomain placeholder without NEXT_PUBLIC_APP_URL", () => {
    assert.equal(shared.supportEmail(), "hello@yourdomain.com");
  });
});
