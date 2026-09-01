const TRADING_BASE = "https://paper-api.alpaca.markets";
const DATA_BASE = "https://data.alpaca.markets";

function headers(): HeadersInit {
  const keyId = process.env.ALPACA_API_KEY_ID;
  const secretKey = process.env.ALPACA_API_SECRET_KEY;
  if (!keyId || !secretKey) {
    throw new Error("ALPACA_API_KEY_ID / ALPACA_API_SECRET_KEY not set");
  }
  return {
    "APCA-API-KEY-ID": keyId,
    "APCA-API-SECRET-KEY": secretKey,
    "Content-Type": "application/json",
  };
}

export function isAlpacaConfigured(): boolean {
  return !!process.env.ALPACA_API_KEY_ID && !!process.env.ALPACA_API_SECRET_KEY;
}

async function request<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Alpaca ${path} failed: ${res.status} ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Trading API (account, positions, orders) -- paper-api.alpaca.markets */
export function tradingRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(TRADING_BASE, path, init);
}

/** Market Data API (bars, clock) -- data.alpaca.markets. Paper and live
 * accounts share the same market data; this base URL is not the paper one. */
export function dataRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(DATA_BASE, path, init);
}
