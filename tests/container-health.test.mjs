// Docker HEALTHCHECK coverage for the images we own: infra-api (Dockerfile),
// esplora-ui (compose block), and the crypto-drive-pg create path in boot.sh.
// Source assertions only — no docker needed — so they run anywhere. The live
// proof (docker inspect → healthy) is in the commit's manual verification.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(join(root, f), "utf8");

describe("container healthchecks", () => {
  it("api/Dockerfile probes /api/health with node-fetch, never curl", () => {
    const src = read("api/Dockerfile");
    assert.match(src, /^HEALTHCHECK /m);
    assert.match(src, /localhost:8081\/api\/health/);
    assert.match(src, /INFRA_SHARED_SECRET/);
    assert.doesNotMatch(src, /curl/);
  });

  it("compose gives esplora-ui a healthcheck using its own node", () => {
    const src = read("docker-compose.infra-api.yml");
    const block = src.slice(src.indexOf("healthcheck:", src.indexOf("esplora-ui:")));
    assert.match(block, /test: \["CMD", "node"/);
    assert.match(block, /localhost:5000/);
    assert.doesNotMatch(block, /curl/);
  });

  it("compose gives anvil a cast-based healthcheck", () => {
    const src = read("docker-compose.infra-api.yml");
    const block = src.slice(src.indexOf("\n  anvil:"), src.indexOf("\n  esplora-ui:"));
    assert.match(block, /test: \["CMD", "cast", "block-number"/);
    assert.match(block, /localhost:8545/);
  });

  it("boot.sh creates crypto-drive-pg with pg_isready health flags", () => {
    const src = read("scripts/boot.sh");
    assert.match(src, /--health-cmd="pg_isready -U postgres"/);
    assert.match(src, /--health-start-period=15s/);
  });

  it("the e2e README pg recipe carries the same health flags", () => {
    const src = read("tests/e2e/README.md");
    assert.match(src, /--health-cmd="pg_isready -U postgres"/);
  });

  it("status.sh surfaces .State.Health on the three owned containers", () => {
    const src = read("scripts/status.sh");
    assert.match(src, /\.State\.Health/);
    for (const v of ["INFRA_HEALTH", "ESPLORA_HEALTH", "PG_HEALTH"]) {
      assert.match(src, new RegExp(v), `missing ${v}`);
    }
  });
});
