// scripts/status.sh: help text, arg validation, JSON shape (live values vary
// so only structure is asserted), the deterministic down-path, and the
// --watch loop (spawned + killed, never left running).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const status = join(root, "scripts/status.sh");

function run(args) {
  try {
    const stdout = execFileSync("bash", [status, ...args], {
      cwd: root,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { status: 0, stdout };
  } catch (e) {
    return { status: e.status ?? 1, stdout: (e.stdout ?? "") + (e.stderr ?? "") };
  }
}

describe("status.sh", () => {
  it("--help explains every flag", () => {
    const r = run(["--help"]);
    assert.equal(r.status, 0);
    for (const flag of ["--app-port", "--infra-port", "--json", "--watch"]) {
      assert.match(r.stdout, new RegExp(flag), `missing ${flag}`);
    }
  });

  it("rejects unknown args and bad --watch values", () => {
    assert.equal(run(["--nope"]).status, 2);
    assert.equal(run(["--watch", "soon"]).status, 2);
  });

  it("--json always parses and carries the full shape", () => {
    const r = run(["--json"]);
    assert.equal(r.status, 0);
    const j = JSON.parse(r.stdout);
    for (const k of ["time", "app", "bitcoind", "electrs", "chopsticks", "esplora", "infraApi", "postgres", "filestore", "errors10m", "warnings"]) {
      assert.ok(k in j, `missing ${k}`);
    }
    assert.equal(typeof j.app.up, "boolean");
    assert.equal(typeof j.app.port, "number");
    assert.ok("url" in j.esplora && "up" in j.esplora && "nigiri" in j.esplora);
    for (const section of [j.esplora, j.infraApi, j.postgres]) {
      assert.ok("health" in section);
      assert.ok(
        section.health === null ||
          ["healthy", "unhealthy", "starting", "none", "unknown", "missing"].includes(section.health),
        `unexpected health value ${section.health}`,
      );
    }
    assert.ok(Array.isArray(j.warnings));
  });

  it("dead ports report down with nulls, still exit 0", () => {
    const r = run(["--json", "--app-port", "43999", "--infra-port", "43998"]);
    assert.equal(r.status, 0);
    const j = JSON.parse(r.stdout);
    assert.equal(j.app.up, false);
    assert.equal(j.app.pid, null);
    assert.equal(j.app.port, 43999);
    assert.equal(j.infraApi.up, false);
    assert.equal(j.infraApi.faucetSats, null);
    assert.match(j.warnings[0], /DOWN on :43999/);
  });

  it("human mode narrates every section", () => {
    const r = run([]);
    assert.equal(r.status, 0);
    for (const s of ["crypto-drive status", "bitcoind", "electrs", "infra-api", "postgres", "filestore", "errors-10m", "warnings"]) {
      assert.match(r.stdout, new RegExp(s), `missing ${s}`);
    }
    assert.match(r.stdout, /health=(healthy|unhealthy|starting|none|unknown|missing|\?)/);
  });

  it("--watch re-reports until killed", async () => {
    const child = spawn("bash", [status, "--watch", "1"], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout.on("data", (d) => { out += d; });
    await new Promise((r) => setTimeout(r, 3500));
    child.kill();
    await new Promise((r) => child.on("exit", r));
    const headers = out.split("crypto-drive status").length - 1;
    assert.ok(headers >= 2, `expected 2+ reports, saw ${headers}`);
  });
});
