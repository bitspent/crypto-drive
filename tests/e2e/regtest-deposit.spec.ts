// Regtest deposit: against a stub infra-api, a faucet deposit lands on-chain
// (onChain: true) and tx details links it to the Esplora UI. Runs under the
// regtest project only (playwright.regtest.config.ts) — simulated mode can
// never produce an explorer link, by design.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { expect, test } from "@playwright/test";
import { uniqueEmail, unlock } from "./helpers";

const STUB_PORT = 43981;
const STUB_SECRET = "test-stub";
const STUB_TXID = "deadbeef".repeat(8);
const STUB_HEIGHT = 101;

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let s = "";
    req.on("data", (c) => (s += c));
    req.on("end", () => resolve(s));
    req.on("error", reject);
  });
}

async function startStub(): Promise<Server> {
  const server = createServer(async (req, res) => {
    try {
      if (req.headers.authorization !== `Bearer ${STUB_SECRET}`) {
        json(res, 403, { error: "forbidden" });
        return;
      }
      const url = new URL(req.url ?? "/", "http://stub/");
      if (req.method === "GET" && url.pathname === "/api/health") {
        json(res, 200, {
          ok: true,
          bitcoind_ready: true,
          electrs_ready: true,
          faucet_balance: 50_000_000,
        });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/address/fund") {
        const body = JSON.parse((await readBody(req)) || "{}") as {
          address?: unknown;
          amountSats?: unknown;
        };
        if (typeof body.address !== "string" || !body.address.startsWith("bcrt1")) {
          json(res, 400, { error: "invalid address" });
          return;
        }
        if (typeof body.amountSats !== "number" || body.amountSats > 1_000_000) {
          json(res, 400, { error: "amount out of range" });
          return;
        }
        json(res, 200, { txid: STUB_TXID });
        return;
      }
      if (req.method === "GET" && url.pathname.startsWith("/api/tx/")) {
        json(res, 200, { confirmed: true, confirmations: 3, blockHeight: STUB_HEIGHT });
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/fees") {
        json(res, 200, { fastest: 5, halfHour: 3, hour: 2, economy: 1, minimum: 1 });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/mine") {
        if (req.headers["x-admin-token"] !== STUB_SECRET) {
          json(res, 403, { error: "forbidden" });
          return;
        }
        json(res, 200, { height: STUB_HEIGHT });
        return;
      }
      json(res, 404, { error: "not found" });
    } catch {
      json(res, 500, { error: "stub error" });
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", (e: NodeJS.ErrnoException) => {
      reject(
        e.code === "EADDRINUSE"
          ? new Error(
              `stub infra port ${STUB_PORT} is taken — stop the squatter and re-run (lsof -iTCP:${STUB_PORT} -sTCP:LISTEN)`,
            )
          : e,
      );
    });
    server.listen(STUB_PORT, "127.0.0.1", () => resolve());
  });
  return server;
}

let stub: Server | null = null;

test.beforeAll(async () => {
  stub = await startStub();
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => (stub ? stub.close(() => resolve()) : resolve()));
  stub = null;
});

test("regtest faucet deposit links to the explorer in tx details", async ({ page }) => {
  await unlock(page, uniqueEmail("reglink"));
  const created = await page.request.post("/api/wallet");
  expect(created.ok()).toBe(true);
  const funded = await page.request.post("/api/wallet/deposit");
  expect(funded.ok()).toBe(true);
  const { tx } = (await funded.json()) as { tx: { id: string; onChain: boolean } };
  expect(tx.id).toBe(STUB_TXID);
  expect(tx.onChain).toBe(true);

  await page.goto("/wallet");
  await page.getByRole("button", { name: /Show details/ }).click();
  const dialog = page.getByRole("dialog", { name: "Transaction details" });
  await expect(dialog).toBeVisible();
  const link = dialog.getByRole("link", { name: /in the explorer/ });
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute("href", `http://localhost:5000/tx/${STUB_TXID}`);
  await expect(link).toHaveAttribute("target", "_blank");
});
