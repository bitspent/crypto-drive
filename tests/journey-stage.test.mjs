// Journey stage contracts: anchor coverage + theme palette completeness.
// Run with: node --test tests/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const jiti = createJiti(join(root, "tests/journey-stage.test.mjs"));
const { JOURNEY_DRIVES, JOURNEY_ANCHORS, anchorFor } = jiti(
  join(root, "src/components/journey/registry.ts"),
);
const { JOURNEY_PALETTES } = jiti(join(root, "src/components/journey/palette.ts"));

const bitcoin = JSON.parse(readFileSync(join(root, "content/tracks/bitcoin.json"), "utf8"));

const isVec3 = (v) =>
  Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number" && Number.isFinite(n));

describe("journey anchors", () => {
  it("covers every step of every journey drive", () => {
    assert.ok(JOURNEY_DRIVES.size > 0, "no journey drives registered");
    for (const drive of bitcoin.drives) {
      const key = `bitcoin/${drive.slug}`;
      if (!JOURNEY_DRIVES.has(key)) continue;
      const anchors = JOURNEY_ANCHORS[key];
      assert.ok(anchors, `missing anchor map for ${key}`);
      for (const step of drive.steps) {
        const anchor = anchors[step.slug];
        assert.ok(anchor, `missing anchor for ${key}/${step.slug}`);
        assert.ok(isVec3(anchor.pos), `bad pos for ${key}/${step.slug}`);
        assert.ok(isVec3(anchor.look), `bad look for ${key}/${step.slug}`);
      }
    }
  });

  it("registers only real bitcoin drives", () => {
    const slugs = new Set(bitcoin.drives.map((d) => `bitcoin/${d.slug}`));
    for (const key of JOURNEY_DRIVES) {
      assert.ok(slugs.has(key), `journey drive ${key} is not a real bitcoin drive`);
    }
  });

  it("falls back gracefully for unknown steps", () => {
    const anchor = anchorFor("bitcoin/what-is", "nope");
    assert.ok(isVec3(anchor.pos) && isVec3(anchor.look));
  });
});

describe("journey palettes", () => {
  const colorKeys = [
    "sky",
    "ground",
    "road",
    "hills",
    "dash",
    "hemiSky",
    "hemiGround",
    "sunColor",
    "rimColor",
    "glassTint",
  ];
  for (const mode of ["light", "dark"]) {
    it(`defines a complete ${mode} palette`, () => {
      const palette = JOURNEY_PALETTES[mode];
      assert.ok(palette, `missing ${mode} palette`);
      for (const key of colorKeys) {
        assert.match(
          palette[key],
          /^#[0-9a-fA-F]{6}$/,
          `${mode}.${key} is not a hex color: ${palette[key]}`,
        );
      }
      assert.ok(palette.hemiIntensity > 0, `${mode}.hemiIntensity must be positive`);
      assert.ok(palette.sunIntensity > 0, `${mode}.sunIntensity must be positive`);
      assert.ok(palette.rimIntensity > 0, `${mode}.rimIntensity must be positive`);
    });
  }

  it("differs between themes", () => {
    assert.notDeepEqual(JOURNEY_PALETTES.light, JOURNEY_PALETTES.dark);
  });
});
