import { NextResponse } from "next/server";
import { getBitcoinProvider, providerFailure } from "@/lib/bitcoin";

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Regtest only (404 otherwise): mine blocks on the infra chain so funded
 * txs confirm. Requires the X-Admin-Token header. Test/enterprise hook.
 */
export async function POST(req: Request) {
  let provider;
  try {
    provider = getBitcoinProvider();
  } catch (e) {
    const { message, status } = providerFailure(e, "Could not mine.");
    return err(message, status);
  }
  if (provider.network !== "regtest") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const token = req.headers.get("X-Admin-Token")?.trim();
  const expected = process.env.ADMIN_MINE_TOKEN?.trim();
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { blocks?: unknown };
  const blocks = body.blocks === undefined ? 1 : body.blocks;
  if (typeof blocks !== "number" || !Number.isInteger(blocks) || blocks < 1 || blocks > 10) {
    return err("Blocks out of range.", 400);
  }
  try {
    const { height } = await provider.mineBlocks(blocks);
    return NextResponse.json({ height });
  } catch (e) {
    const { message, status } = providerFailure(e, "Could not mine.");
    return err(message, status);
  }
}
