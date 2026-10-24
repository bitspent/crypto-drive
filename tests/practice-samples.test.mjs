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
  POLICY_THRESHOLDS,
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

  it("grades receipt answers against the real wallet", () => {
    const p = practiceFor(derivePracticeSeed("grade@example.com", "CD-DRIVE-STARTER"));
    const tx = (over) => ({
      id: "ab".repeat(32),
      direction: "in",
      amount: 500000,
      counterparty: "bcrt1qfaucet",
      status: "confirmed",
      confirmations: 3,
      timestamp: "2026-10-15T00:00:00.000Z",
      ...over,
    });
    const wallet = (history) => ({ exists: true, history });
    // Confirmed incoming tx passes.
    assert.equal(
      gradeStepAnswer("btc-paid-receipt", "receipt", p, { txid: "ab".repeat(32) }, wallet([tx({})])),
      null,
    );
    // Pending, outgoing, and unknown txids fail.
    assert.ok(
      gradeStepAnswer(
        "btc-paid-receipt", "receipt", p, { txid: "ab".repeat(32) },
        wallet([tx({ status: "pending", confirmations: 1 })]),
      ),
    );
    assert.ok(
      gradeStepAnswer(
        "btc-paid-receipt", "receipt", p, { txid: "ab".repeat(32) },
        wallet([tx({ direction: "out" })]),
      ),
    );
    assert.ok(
      gradeStepAnswer("btc-paid-receipt", "receipt", p, { txid: "cd".repeat(32) }, wallet([tx({})])),
    );
    // No wallet: legacy stub equality still grades pure callers.
    assert.equal(gradeStepAnswer("btc-paid-receipt", "receipt", p, { txid: p.txid }), null);
    assert.ok(gradeStepAnswer("btc-paid-receipt", "receipt", p, { txid: "cd".repeat(32) }));
  });
});

describe("bitcoin first drive", () => {
  it("opens with the protocol stop and ends on one certificate", () => {
    assert.equal(bitcoin.drives.length, 6);
    assert.equal(bitcoin.drives[0].slug, "what-is");
    const steps = bitcoin.drives.flatMap((drive) => drive.steps);
    assert.equal(steps.length, 25);
    const certs = steps.filter((step) => step.cert);
    assert.equal(certs.length, 1);
    assert.equal(certs[0].id, "btc-prove-exam");
    assert.match(
      certs[0].cert.certMilestoneLabel,
      /receive, verify, send, and custody Bitcoin\. Can explain Bitcoin's role to a non-technical stakeholder\./,
    );
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

  it("gives all 25 bitcoin steps the full idea panel", () => {
    const steps = bitcoin.drives.flatMap((d) => d.steps);
    assert.equal(steps.length, 25);
    for (const step of steps) {
      assert.ok(step.ideaTitle?.trim(), `${step.id} missing ideaTitle`);
      assert.ok(step.ideaBody?.trim(), `${step.id} missing ideaBody`);
      assert.ok(step.objective?.trim(), `${step.id} missing objective`);
      assert.ok(step.whyItMatters?.trim(), `${step.id} missing whyItMatters`);
      assert.ok(Array.isArray(step.keyTerms) && step.keyTerms.length >= 1, `${step.id} keyTerms`);
      assert.ok(step.misconception?.trim(), `${step.id} missing misconception`);
    }
  });

  it("gives all 25 bitcoin steps a unique quick check", () => {
    const steps = bitcoin.drives.flatMap((d) => d.steps);
    const questions = [];
    for (const step of steps) {
      const qc = step.quickCheck;
      assert.ok(qc?.question?.trim(), `${step.id} quickCheck question`);
      assert.ok(
        Array.isArray(qc.options) && qc.options.length >= 3,
        `${step.id} quickCheck options`,
      );
      assert.ok(
        Number.isInteger(qc.answerIndex) && qc.options[qc.answerIndex],
        `${step.id} quickCheck answerIndex`,
      );
      assert.ok(qc.explanation?.trim(), `${step.id} quickCheck explanation`);
      questions.push(qc.question.trim());
    }
    assert.equal(new Set(questions).size, questions.length, "duplicate quickCheck question");
  });

  it("gives all 25 bitcoin steps a pocket card", () => {
    const steps = bitcoin.drives.flatMap((d) => d.steps);
    for (const step of steps) {
      assert.ok(step.pocketCard?.trim(), `${step.id} missing pocketCard`);
    }
  });

  it("shapes the prove-it capstone after road-test", () => {
    assert.deepEqual(
      bitcoin.drives.map((d) => d.slug),
      ["what-is", "get-paid", "send", "guard", "road-test", "prove-it"],
    );
    const prove = bitcoin.drives.find((d) => d.slug === "prove-it");
    assert.equal(
      prove.steps.map((s) => s.slug).join(","),
      "verify,finality,custody,fees,restore,explain,exam",
    );
    const types = new Set([
      "explorer-read",
      "policy-pick",
      "model-compare",
      "fee-strategy",
      "seed-restore",
      "free-write-rubric",
      "wallet-exam",
    ]);
    for (const step of prove.steps) {
      assert.ok(types.has(step.action.type), `${step.id} action ${step.action.type}`);
      assert.ok(step.title?.trim(), `${step.id} missing title`);
      const qc = step.quickCheck;
      assert.ok(qc?.question?.trim(), `${step.id} quickCheck question`);
      assert.ok(
        Array.isArray(qc.options) && qc.options.length >= 3,
        `${step.id} quickCheck options`,
      );
      assert.ok(
        Number.isInteger(qc.answerIndex) && qc.options[qc.answerIndex],
        `${step.id} quickCheck answerIndex`,
      );
      assert.ok(qc.explanation?.trim(), `${step.id} quickCheck explanation`);
    }
    const verify = prove.steps.find((s) => s.slug === "verify");
    assert.equal(verify.action.txid, PIZZA_EXPLORER.txid);
    assert.equal(verify.action.explorerUrl, PIZZA_EXPLORER.explorerUrl);
  });

  it("keeps policy-pick expected ranges non-overlapping", () => {
    assert.equal(POLICY_THRESHOLDS.coffee, 0);
    assert.ok(POLICY_THRESHOLDS.laptopMin > POLICY_THRESHOLDS.coffee);
    assert.ok(POLICY_THRESHOLDS.houseMin > POLICY_THRESHOLDS.laptopMax);
    const p = practiceFor(derivePracticeSeed("cap@example.com", "CD-DRIVE-STARTER"));
    const grade = (a) => gradeStepAnswer("btc-prove-finality", "policy-pick", p, a);
    assert.equal(grade({ policyCoffee: 0, policyLaptop: 3, policyHouse: 6 }), null);
    assert.ok(grade({ policyCoffee: 1, policyLaptop: 3, policyHouse: 6 }));
    assert.ok(grade({ policyCoffee: 0, policyLaptop: 6, policyHouse: 6 }));
    assert.ok(grade({ policyCoffee: 0, policyLaptop: 3, policyHouse: 3 }));
  });

  it("grades the custody, fee, and restore capstone answers", () => {
    const p = practiceFor(derivePracticeSeed("cap@example.com", "CD-DRIVE-STARTER"));
    assert.equal(
      gradeStepAnswer("btc-prove-custody", "model-compare", p, {
        comparedModels: ["exchange", "self-custody", "institutional", "multi-sig"],
        modelPick: "multi-sig",
      }),
      null,
    );
    assert.ok(
      gradeStepAnswer("btc-prove-custody", "model-compare", p, {
        comparedModels: ["exchange"],
        modelPick: "multi-sig",
      }),
    );
    assert.ok(
      gradeStepAnswer("btc-prove-custody", "model-compare", p, {
        comparedModels: ["exchange", "self-custody", "institutional", "multi-sig"],
        modelPick: "exchange",
      }),
    );
    assert.equal(
      gradeStepAnswer("btc-prove-fees", "fee-strategy", p, {
        feePayroll: "economy",
        feeSupplier: "priority",
      }),
      null,
    );
    assert.ok(
      gradeStepAnswer("btc-prove-fees", "fee-strategy", p, {
        feePayroll: "priority",
        feeSupplier: "priority",
      }),
    );
    assert.equal(
      gradeStepAnswer("btc-prove-restore", "seed-restore", p, { restoreWords: p.words }),
      null,
    );
    const wrong = [...p.words];
    wrong[4] = wrong[4] === "abandon" ? "zoo" : "abandon";
    assert.match(
      gradeStepAnswer("btc-prove-restore", "seed-restore", p, { restoreWords: wrong }) ?? "",
      /Word 5 is wrong/,
    );
  });

  it("grades the CFO free-write rubric", () => {
    const p = practiceFor(derivePracticeSeed("cap@example.com", "CD-DRIVE-STARTER"));
    const grade = (explainText) =>
      gradeStepAnswer("btc-prove-explain", "free-write-rubric", p, { explainText });
    assert.equal(
      grade(
        "Bitcoin settles payments with finality in about ten minutes. Supply is scarce with a fixed supply capped at 21 million coins. We hold the keys in multi-sig custody with a named custodian.",
      ),
      null,
    );
    assert.match(
      grade(
        "Bitcoin price will keep rising and investors will see great returns. You should invest now for guaranteed profit in the bull market.",
      ) ?? "",
      /Remove price language/,
    );
    assert.match(grade("Bitcoin is interesting technology.") ?? "", /two sentences/);
    assert.match(
      grade("Bitcoin is a new kind of money people talk about. Many firms are looking at it this year.") ?? "",
      /Mention what it is/,
    );
  });

  it("matches rubric stems without substring false positives", () => {
    const p = practiceFor(derivePracticeSeed("cap@example.com", "CD-DRIVE-STARTER"));
    const grade = (explainText) =>
      gradeStepAnswer("btc-prove-explain", "free-write-rubric", p, { explainText });
    // Each brief case, kept at the standing two-sentence minimum.
    assert.equal(
      grade("Bitcoin has scarcity. Settlement reaches finality in minutes."),
      null,
    );
    assert.equal(
      grade("Bitcoin has scarcity and settles with finality. We'll see this again next quarter."),
      null,
    );
    assert.match(
      grade("It will gain value over time. Returns look strong this year.") ?? "",
      /Remove price language/,
    );
    assert.match(
      grade("It's revolutionary technology for money. Everyone will switch to it soon.") ?? "",
      /Remove price language/,
    );
    assert.equal(
      grade("It settles instantly. The supply is capped at 21 million."),
      null,
    );
    assert.match(
      grade("Price will moon this year. Gains are guaranteed for investors.") ?? "",
      /Remove price language/,
    );
    // Boundary pair: "gain" as a word fails, "again" never triggers.
    assert.match(
      grade("The gain from adoption is unclear. Settlement still takes ten minutes.") ?? "",
      /Remove price language/,
    );
    assert.equal(
      grade("Bitcoin has scarcity and settles with finality. We'll never see that again."),
      null,
    );
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
