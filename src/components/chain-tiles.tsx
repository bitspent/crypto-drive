import { BtcMark, EthMark, SolMark, TrxMark } from "@/components/crypto-marks";

type Chain = "btc" | "eth" | "sol" | "trx" | "usdt";

const tiles: { chain: Chain; texture: string; ticker: string; name: string }[] = [
  { chain: "btc", texture: "tile-btc-circuit", ticker: "BTC", name: "Bitcoin" },
  { chain: "eth", texture: "tile-eth", ticker: "ETH", name: "Ethereum" },
  { chain: "btc", texture: "tile-btc-hash", ticker: "BTC", name: "Bitcoin" },
  { chain: "sol", texture: "tile-sol", ticker: "SOL", name: "Solana" },
  { chain: "btc", texture: "tile-btc-coin", ticker: "BTC", name: "Bitcoin" },
  { chain: "trx", texture: "tile-trx", ticker: "TRX", name: "Tron" },
  { chain: "btc", texture: "tile-btc-circuit", ticker: "BTC", name: "Bitcoin" },
  { chain: "usdt", texture: "tile-usdt", ticker: "USDT", name: "USDT" },
  { chain: "eth", texture: "tile-eth", ticker: "ETH", name: "Ethereum" },
  { chain: "btc", texture: "tile-btc-hash", ticker: "BTC", name: "Bitcoin" },
  { chain: "trx", texture: "tile-trx", ticker: "TRX", name: "Tron" },
  { chain: "btc", texture: "tile-btc-coin", ticker: "BTC", name: "Bitcoin" },
];

function TileMark({ chain }: { chain: Chain }) {
  if (chain === "btc") return <BtcMark className="h-8 w-8 drop-shadow-sm" />;
  if (chain === "eth") return <EthMark className="h-8 w-8 text-[#c9d4ff]" />;
  if (chain === "sol") return <SolMark className="h-8 w-8" />;
  if (chain === "trx") return <TrxMark className="h-8 w-8" />;
  return (
    <span className="font-[family-name:var(--font-display)] text-lg font-bold text-[#9cf0d2]">
      ₮
    </span>
  );
}

export function ChainTiles() {
  return (
    <div aria-hidden className="w-full max-w-md lg:max-w-none">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-2.5">
        {tiles.map((tile, index) => (
          <div
            key={`${tile.chain}-${index}`}
            className={`chain-tile tile-pop relative aspect-square overflow-hidden rounded-xl ${tile.texture}`}
            style={{ ["--i" as string]: index }}
          >
            <span className="absolute left-2 top-2 font-[family-name:var(--font-display)] text-[10px] tracking-[0.16em] text-white/80">
              {tile.ticker}
            </span>
            <span className="absolute inset-0 flex items-center justify-center">
              <TileMark chain={tile.chain} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
