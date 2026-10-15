// Practice uniqueness + Bitcoin road shape.
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
const jiti = createJiti(join(root, "tests/practice-samples.test.mjs"));
const {
  derivePracticeSeed,
  practiceFor,
  gradeStepAnswer,
  PIZZA_EXPLORER,
} = jiti(join(root, "src/lib/practice-samples.ts"));

const bitcoin = JSON.parse(
  readFileSync(join(root, "content/tracks/bitcoin.json"), "utf8"),
);
const bip39 = new Set(
  readFileSync(join(root, "src/lib/data/bip39-english.txt"), "utf8")
    .split("\n")
    .map((w) => w.trim())
    .filter(Boolean),
);

function bech32Valid(addr) {
  const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  const s = addr.toLowerCase();
  const pos = s.lastIndexOf("1");
  if (pos < 1 || pos + 7 > s.length) return false;
  const data = [...s.slice(pos + 1)].map((c) => CHARSET.indexOf(c));
  if (data.includes(-1)) return false;
  const values = [
    ...[...s.slice(0, pos)].map((c) => c.charCodeAt(0) >> 5),
    0,
    ...[...s.slice(0, pos)].map((c) => c.charCodeAt(0) & 31),
    ...data,
  ];
  let chk = 1;
  for (const v of values) {
    const b = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) chk ^= (b >> i) & 1 ? GEN[i] : 0;
  }
  return chk === 1;
}

describe("practice samples", () => {
  it("derives unique valid practice per seed", () => {
    const a = practiceFor(derivePracticeSeed("a@example.com", "CD-DRIVE-2026"));
    const b = practiceFor(derivePracticeSeed("b@example.com", "CD-DRIVE-2026"));
    assert.notEqual(a.address, b.address);
    assert.notEqual(a.txid, b.txid);
    assert.notDeepEqual(a.words, b.words);
    for (const set of [a, b]) {
      assert.ok(set.address.startsWith("bc1q"));
      assert.ok(bech32Valid(set.address));
      assert.ok(bech32Valid(set.dest));
      assert.ok(bech32Valid(set.swapped));
      assert.notEqual(set.dest.slice(-4), set.swapped.slice(-4));
      assert.match(set.txid, /^[0-9a-f]{64}$/);
      assert.equal(set.words.length, 12);
      for (const w of set.words) assert.ok(bip39.has(w), `"${w}" is not BIP39`);
      assert.ok(set.slowFee + Number(set.sendBtc) <= set.balance + 1e-9);
      assert.ok(set.fastFee + Number(set.sendBtc) > set.balance);
      const sum = set.cheques.reduce((n, x) => n + x, 0);
      assert.ok(Math.abs(sum - Number(set.chequesTotal)) < 1e-9);
    }
  });

  it("grades address and cheques answers", () => {
    const p = practiceFor(derivePracticeSeed("grade@example.com", "CD-DRIVE-STARTER"));
    assert.equal(
      gradeStepAnswer("btc-paid-address", "address-check", p, {
        first4: p.address.slice(0, 4),
        last4: p.address.slice(-4),
      }),
      null,
    );
    assert.ok(
      gradeStepAnswer("btc-paid-address", "address-check", p, {
        first4: "xxxx",
        last4: "yyyy",
      }),
    );
    assert.equal(
      gradeStepAnswer("btc-intro-cheques", "intro", p, {
        chequesTotal: p.chequesTotal,
      }),
      null,
    );
  });
});

describe("bitcoin first drive", () => {
  it("opens with the protocol stop and ends on one certificate", () => {
    assert.equal(bitcoin.drives.length, 5);
    assert.equal(bitcoin.drives[0].slug, "what-is");
    const steps = bitcoin.drives.flatMap((drive) => drive.steps);
    assert.equal(steps.length, 18);
    const certs = steps.filter((step) => step.cert);
    assert.equal(certs.length, 1);
    assert.equal(certs[0].id, "btc-test-mismatch");
    assert.match(certs[0].cert.certMilestoneLabel, /receive, verify, and send/i);
  });

  it("gives every what-is step unique instructional ideaBody", () => {
    const whatIs = bitcoin.drives.find((d) => d.slug === "what-is");
    assert.ok(whatIs);
    assert.equal(whatIs.steps.length, 7);
    const bodies = [];
    for (const step of whatIs.steps) {
      assert.ok(step.ideaTitle?.trim(), `${step.id} missing ideaTitle`);
      assert.ok(step.ideaBody?.trim(), `${step.id} missing ideaBody`);
      assert.ok(step.objective?.trim(), `${step.id} missing objective`);
      assert.ok(step.whyItMatters?.trim(), `${step.id} missing whyItMatters`);
      assert.ok(Array.isArray(step.keyTerms) && step.keyTerms.length >= 1, `${step.id} keyTerms`);
      assert.ok(step.misconception?.trim(), `${step.id} missing misconception`);
      bodies.push(step.ideaBody.trim());
    }
    assert.equal(new Set(bodies).size, bodies.length, "duplicate ideaBody among what-is steps");
  });

  it("rejects identical ideaBody across any bitcoin steps that define one", () => {
    const withBody = bitcoin.drives
      .flatMap((d) => d.steps)
      .filter((s) => typeof s.ideaBody === "string" && s.ideaBody.trim());
    const bodies = withBody.map((s) => s.ideaBody.trim());
    assert.equal(new Set(bodies).size, bodies.length, "duplicate ideaBody in bitcoin.json");
  });

  it("gives all 18 bitcoin steps the full idea panel", () => {
    const steps = bitcoin.drives.flatMap((d) => d.steps);
    assert.equal(steps.length, 18);
    for (const step of steps) {
      assert.ok(step.ideaTitle?.trim(), `${step.id} missing ideaTitle`);
      assert.ok(step.ideaBody?.trim(), `${step.id} missing ideaBody`);
      assert.ok(step.objective?.trim(), `${step.id} missing objective`);
      assert.ok(step.whyItMatters?.trim(), `${step.id} missing whyItMatters`);
      assert.ok(Array.isArray(step.keyTerms) && step.keyTerms.length >= 1, `${step.id} keyTerms`);
      assert.ok(step.misconception?.trim(), `${step.id} missing misconception`);
    }
  });

  it("ships the verified pizza explorer lesson after the simulated receipt", () => {
    const paid = bitcoin.drives.find((d) => d.slug === "get-paid");
    assert.ok(paid);
    assert.equal(paid.steps.map((s) => s.slug).join(","), "address,receipt,explorer");
    const explorer = paid.steps.find((s) => s.id === "btc-paid-explorer");
    assert.ok(explorer);
    assert.equal(explorer.action.type, "explorer-read");
    assert.equal(explorer.action.txid, PIZZA_EXPLORER.txid);
    assert.equal(explorer.action.explorerUrl, PIZZA_EXPLORER.explorerUrl);
    assert.match(explorer.job, /real receipt/i);
  });

  it("grades explorer-read loosely for confirmed pizza tx fields", () => {
    const p = practiceFor(derivePracticeSeed("explorer@example.com", "CD-DRIVE-STARTER"));
    assert.equal(
      gradeStepAnswer("btc-paid-explorer", "explorer-read", p, {
        explorerConfirmed: "yes",
        explorerConfirmations: PIZZA_EXPLORER.confirmationsMin,
        explorerFeeRate: PIZZA_EXPLORER.feeRateSatVb,
      }),
      null,
    );
    assert.equal(
      gradeStepAnswer("btc-paid-explorer", "explorer-read", p, {
        explorerConfirmed: "yes",
        explorerConfirmations: 900_000,
        explorerFeeRate: PIZZA_EXPLORER.feeRateMin,
      }),
      null,
    );
    assert.ok(
      gradeStepAnswer("btc-paid-explorer", "explorer-read", p, {
        explorerConfirmed: "no",
        explorerConfirmations: 900_000,
        explorerFeeRate: PIZZA_EXPLORER.feeRateSatVb,
      }),
    );
    assert.ok(
      gradeStepAnswer("btc-paid-explorer", "explorer-read", p, {
        explorerConfirmed: "yes",
        explorerConfirmations: 12,
        explorerFeeRate: PIZZA_EXPLORER.feeRateSatVb,
      }),
    );
    assert.ok(
      gradeStepAnswer("btc-paid-explorer", "explorer-read", p, {
        explorerConfirmed: "yes",
        explorerConfirmations: 900_000,
        explorerFeeRate: 12,
      }),
    );
  });
});
