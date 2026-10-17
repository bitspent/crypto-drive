// scripts/boot.sh: help text, arg validation, and the dry-run plan —
// including the port-jump path, exercised by holding a port with a real
// listener. Dry runs probe read-only and never start, kill, or exec.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const boot = join(root, "scripts/boot.sh");

function run(args, input = undefined) {
  try {
    const stdout = execFileSync("bash", [boot, ...args], {
      cwd: root,
      input,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { status: 0, stdout };
  } catch (e) {
    return { status: e.status ?? 1, stdout: (e.stdout ?? "") + (e.stderr ?? "") };
  }
}

// Hold a port from a FOREIGN cwd (/tmp): a holder spawned with cwd == repo
// would (correctly) be classified as our own previous boot.
async function holdPort() {
  const port = await new Promise((resolve) => {
    const probe = net.createServer();
    probe.listen(0, "127.0.0.1", () => {
      const p = probe.address().port;
      probe.close(() => resolve(p));
    });
  });
  const child = spawn(
    process.execPath,
    ["-e", `require("net").createServer().listen(${port},"127.0.0.1",()=>setInterval(()=>{},1e9))`],
    { cwd: os.tmpdir(), stdio: "ignore" },
  );
  for (let i = 0; i < 50; i++) {
    const up = await new Promise((resolve) => {
      const sock = net.connect(port, "127.0.0.1");
      sock.on("connect", () => { sock.destroy(); resolve(true); });
      sock.on("error", () => resolve(false));
    });
    if (up) return { port, close: () => child.kill() };
    await new Promise((r) => setTimeout(r, 100));
  }
  child.kill();
  throw new Error(`holder never bound :${port}`);
}

describe("boot.sh", () => {
  it("--help explains every flag", () => {
    const r = run(["--help"]);
    assert.equal(r.status, 0);
    for (const flag of ["--mode", "--app-port", "--infra-port", "--with-db", "--wait", "--yes", "--kill-ours", "--dry-run"]) {
      assert.match(r.stdout, new RegExp(flag), `missing ${flag}`);
    }
  });

  it("rejects unknown args and bad modes", () => {
    assert.equal(run(["--nope"]).status, 2);
    assert.equal(run(["--mode", "mainnet"]).status, 2);
  });

  it("dry-runs a free app port end to end without side effects", async () => {
    await withNoLock(() => {
      // A high, almost surely free port keeps the plan on the happy path.
      const r = run(["--mode", "simulated", "--app-port", "43981", "--dry-run"]);
      assert.equal(r.status, 0);
      assert.match(r.stdout, /\[1\/6\] tooling/);
      assert.match(r.stdout, /:43981 \(app\) is free/);
      assert.match(r.stdout, /would exec: next dev --port 43981/);
      assert.match(r.stdout, /DRY RUN complete/);
    });
  });

  it("--yes jumps a busy app port instead of killing", async () => {
    const held = await holdPort();
    try {
      await withNoLock(() => {
        const r = run(["--mode", "simulated", "--app-port", String(held.port), "--yes", "--dry-run"]);
        assert.equal(r.status, 0);
        assert.match(r.stdout, new RegExp(`:${held.port} \\(app\\) is held by a FOREIGN process`));
        assert.match(r.stdout, /never kills foreign PIDs — jumping/);
        assert.match(r.stdout, new RegExp(`would exec: next dev --port ${held.port + 1}`));
      });
    } finally {
      held.close();
    }
  });

  it("a pipe (no TTY, no --yes) refuses to prompt and aborts", async () => {
    const held = await holdPort();
    try {
      const r = run(
        ["--mode", "simulated", "--app-port", String(held.port), "--dry-run"],
        "j\n",
      );
      assert.equal(r.status, 1);
      assert.match(r.stdout, /no TTY/);
    } finally {
      held.close();
    }
  });

  // Real interactive paths, driven through a pty via script(1). macOS and
  // Linux both ship it; the pipe stays open around the answer so the child
  // never reads EOF before the keystroke lands.
  function runPty(args, answer) {
    const port = args[args.indexOf("--app-port") + 1];
    const cmd = `{ sleep 1; printf '${answer}\\n'; sleep 2; } | script -q /dev/null bash ${boot} ${args.join(" ")}`;
    try {
      const stdout = execFileSync("bash", ["-c", cmd], {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, TERM: "xterm" },
      });
      return { status: 0, stdout: stdout.replaceAll("\r", ""), port };
    } catch (e) {
      return {
        status: e.status ?? 1,
        stdout: String(e.stdout ?? "").replaceAll("\r", ""),
        port,
      };
    }
  }

  it("answering 'j' on a TTY jumps, answering 'a' aborts", async () => {
    const held = await holdPort();
    try {
      await withNoLock(() => {
        const jump = runPty(["--mode", "simulated", "--app-port", String(held.port), "--dry-run"], "j");
        assert.equal(jump.status, 0);
        assert.match(jump.stdout, new RegExp(`jumping :${held.port} → :${held.port + 1}`));
      });
    } finally {
      held.close();
    }
    const held2 = await holdPort();
    try {
      await withNoLock(() => {
        const abort = runPty(["--mode", "simulated", "--app-port", String(held2.port), "--dry-run"], "a");
        assert.equal(abort.status, 1);
        assert.match(abort.stdout, /aborted by you/);
      });
    } finally {
      held2.close();
    }
  });

  // Neutralize any REAL dev lock (a server may be running while the suite
  // runs): happy-path tests must not see it. Saved and restored.
  async function withNoLock(fn) {
    const lockFile = join(root, ".next/dev/lock");
    const had = fs.existsSync(lockFile) ? fs.readFileSync(lockFile, "utf8") : null;
    if (had !== null) fs.rmSync(lockFile);
    try {
      return await fn();
    } finally {
      if (had !== null) fs.writeFileSync(lockFile, had);
    }
  }

  // A fake .next/dev/lock pointing at a live, repo-cwd sleeper: proves the
  // repo-lock paths without touching any real server. Saved and restored.
  async function withFakeLock(port, fn, listen = false) {
    const lockDir = join(root, ".next/dev");
    const lockFile = join(lockDir, "lock");
    const prog = listen
      ? `require("net").createServer().listen(${port},"127.0.0.1");setInterval(()=>{},1000000)`
      : "setInterval(()=>{},1000000)";
    const sleeper = spawn(process.execPath, ["-e", prog], {
      cwd: root,
      stdio: "ignore",
    });
    await new Promise((r) => setTimeout(r, 300));
    fs.mkdirSync(lockDir, { recursive: true });
    const had = fs.existsSync(lockFile) ? fs.readFileSync(lockFile, "utf8") : null;
    fs.writeFileSync(lockFile, JSON.stringify({ pid: sleeper.pid, port }));
    try {
      return await fn();
    } finally {
      if (had === null) fs.rmSync(lockFile, { force: true });
      else fs.writeFileSync(lockFile, had);
      sleeper.kill();
    }
  }

  it("a live dev lock on another port blocks --yes without --kill-ours", async () => {
    await withFakeLock(43990, () => {
      const blocked = run(["--mode", "simulated", "--app-port", "43991", "--yes", "--dry-run"]);
      assert.equal(blocked.status, 1);
      assert.match(blocked.stdout, /repo lock/);
      const restart = run([
        "--mode", "simulated", "--app-port", "43991",
        "--yes", "--kill-ours", "--dry-run",
      ]);
      assert.equal(restart.status, 0);
      assert.match(restart.stdout, /would kill pid \d+ \(dev server :43990\)/);
    });
  });

  it("a live dev lock on the same port is restart-or-abort, never jump", async () => {
    const probe = await new Promise((resolve) => {
      const s = net.createServer();
      s.listen(0, "127.0.0.1", () => {
        const p = s.address().port;
        s.close(() => resolve(p));
      });
    });
    await withFakeLock(
      probe,
      () => {
        const r = run(["--mode", "simulated", "--app-port", String(probe), "--yes", "--dry-run"]);
        assert.equal(r.status, 1);
        assert.match(r.stdout, /OUR OWN dev server/);
        assert.doesNotMatch(r.stdout, /jumping/);
      },
      true,
    );
  });

  it("dry-run regtest narrates the full stack", async () => {
    await withNoLock(() => {
      const r = run(["regtest", "--app-port", "43982", "--infra-port", "43983", "--dry-run"]);
      assert.equal(r.status, 0);
      assert.match(r.stdout, /\[3\/6\] nigiri/);
      assert.match(r.stdout, /\[4\/6\] infra-api/);
      assert.match(r.stdout, /:5000 \(Esplora UI\) is skipped by design/);
      assert.match(r.stdout, /INFRA_BASE_URL=http:\/\/localhost:43983/);
    });
  });
});
