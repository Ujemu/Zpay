// zip321.js — build ZIP-321 Zcash payment request URIs (shielded only)
// Spec: https://zips.z.cash/zip-0321

const MAX_MEMO_BYTES = 512;
const MAX_ZEC = 21_000_000;

// Shielded address prefixes. Transparent (t1, t3) and TEX (tex1) are rejected.
const SHIELDED_PREFIXES = {
  mainnet: ["u1", "zs1"],
  testnet: ["utest1", "ztestsapling1"],
};

export function isShieldedAddress(address, network = "mainnet") {
  if (typeof address !== "string") return false;
  const a = address.trim();
  if (!/^[a-z0-9]+$/.test(a)) return false; // bech32/bech32m are lowercase alphanumeric
  return SHIELDED_PREFIXES[network].some((p) => a.startsWith(p) && a.length > p.length + 20);
}

// Validates a ZEC amount given as a string, e.g. "0.5" or "12.12345678".
// Returns the normalised string (no trailing zeros), or throws.
export function formatAmount(input) {
  const s = String(input).trim();
  if (!/^\d+(\.\d{1,8})?$/.test(s)) {
    throw new Error("Amount must be a number with up to 8 decimal places.");
  }
  let [whole, frac = ""] = s.split(".");
  whole = whole.replace(/^0+(?=\d)/, "");
  frac = frac.replace(/0+$/, "");
  if (Number(whole) > MAX_ZEC) throw new Error("Amount is too large.");
  const out = frac ? `${whole}.${frac}` : whole;
  if (Number(out) === 0) throw new Error("Amount must be greater than zero.");
  return out;
}

// Memo is UTF-8 text, max 512 bytes, encoded as base64url without padding.
export function encodeMemo(text) {
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > MAX_MEMO_BYTES) {
    throw new Error(`Memo is too long (${bytes.length}/${MAX_MEMO_BYTES} bytes).`);
  }
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Builds a single-payment ZIP-321 URI.
export function buildPaymentUri({ address, amount, memo, message, network = "mainnet" }) {
  if (!isShieldedAddress(address, network)) {
    throw new Error("Please use a shielded (u1… or zs1…) Zcash address.");
  }
  const params = [];
  if (amount !== undefined && amount !== "") params.push(`amount=${formatAmount(amount)}`);
  if (memo) params.push(`memo=${encodeMemo(memo)}`);
  if (message) params.push(`message=${encodeURIComponent(message)}`);
  return `zcash:${address.trim()}${params.length ? "?" + params.join("&") : ""}`;
}
