import type { RateSource, Trip } from "./types";

// ECB reference rates (~30 currencies), free, no key.
const FRANKFURTER = "https://api.frankfurter.dev/v1";
// Community-maintained daily rates for ~200 currencies, used when ECB lacks one.
const ALT = (date: string, base: string) =>
  `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/${base.toLowerCase()}.json`;

interface RateTable {
  date: string;
  /** 1 unit of base = rates[X] units of X */
  rates: Record<string, number>;
}

const key = (src: string, base: string, date: string) => `fx:${src}:${base}:${date}`;

function readCache(k: string): RateTable | null {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as RateTable) : null;
  } catch {
    return null;
  }
}

function writeCache(k: string, t: RateTable) {
  try {
    localStorage.setItem(k, JSON.stringify(t));
  } catch {
    // storage full; rates are a convenience
  }
}

async function getJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function loadTable(src: "ecb" | "alt", base: string, date: string): Promise<RateTable | null> {
  const k = key(src, base, date);
  // A dated table never changes; "latest" is refreshed whenever we're online.
  const cached = readCache(k);
  if (cached && date !== "latest") return cached;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return cached;
  try {
    let table: RateTable;
    if (src === "ecb") {
      const j = (await getJson(`${FRANKFURTER}/${date}?base=${base}`)) as RateTable;
      table = { date: j.date, rates: j.rates };
    } else {
      const j = (await getJson(ALT(date, base))) as Record<string, unknown>;
      const raw = j[base.toLowerCase()] as Record<string, number>;
      const rates: Record<string, number> = {};
      for (const [c, v] of Object.entries(raw)) rates[c.toUpperCase()] = v;
      table = { date: String(j.date), rates };
    }
    writeCache(k, table);
    if (date === "latest") writeCache(key(src, base, table.date), table);
    return table;
  } catch {
    return cached;
  }
}

export function todayIso(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export interface RateResult {
  rate: number;
  source: RateSource;
  /** Date the rate was published for (may be earlier than the expense: weekends, offline). */
  rateDate?: string;
}

/**
 * Rate to convert 1 unit of `currency` into `base`, for the expense date.
 * Returns null when no rate is available (offline with nothing cached).
 */
export async function rateToBase(
  currency: string,
  base: string,
  date: string,
  trip?: Pick<Trip, "fixedRates" | "sharedRates">,
): Promise<RateResult | null> {
  if (currency === base) return { rate: 1, source: "same" };
  const fixed = trip?.fixedRates?.[currency];
  if (fixed && fixed > 0) return { rate: fixed, source: "fixed" };
  const d = date >= todayIso() ? "latest" : date;
  for (const src of ["ecb", "alt"] as const) {
    for (const when of d === "latest" ? ["latest"] : [d, "latest"]) {
      const t = await loadTable(src, base, when);
      const r = t?.rates[currency];
      if (r && r > 0) return { rate: 1 / r, source: src === "ecb" ? "ecb" : "alt", rateDate: t!.date };
    }
  }
  const shared = trip?.sharedRates?.rates[currency];
  if (shared && shared > 0) return { rate: 1 / shared, source: "ecb", rateDate: trip!.sharedRates!.date };
  return null;
}

/**
 * Warm the offline cache for the trip's base currency. Call when the app opens online.
 * Returns the ECB table (plus common non-ECB currencies) for sharing via the trip doc.
 */
export async function prefetchRates(base: string): Promise<RateTable | null> {
  const [ecb, alt] = await Promise.all([loadTable("ecb", base, "latest"), loadTable("alt", base, "latest")]);
  if (!ecb && !alt) return null;
  const rates: Record<string, number> = { ...(ecb?.rates ?? {}) };
  for (const c of SHARED_EXTRA) if (!rates[c] && alt?.rates[c]) rates[c] = alt.rates[c];
  return { date: ecb?.date ?? alt!.date, rates };
}

// Travel currencies ECB doesn't publish; kept small so the trip doc stays small.
const SHARED_EXTRA = ["VND", "TWD", "AED", "MAD", "EGP", "ARS", "CLP", "COP", "PEN", "QAR", "SAR", "KZT", "GEL", "RSD", "UAH"];
