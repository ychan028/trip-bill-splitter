import type { Expense } from "./types";

const decimalsCache = new Map<string, number>();

export function currencyDecimals(currency: string): number {
  let d = decimalsCache.get(currency);
  if (d === undefined) {
    try {
      d = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2;
    } catch {
      d = 2;
    }
    decimalsCache.set(currency, d);
  }
  return d;
}

/** Parse user input like "12.50", "12,50" or "1,234.5" into minor units. Returns null if invalid. */
export function parseAmount(input: string, currency: string): number | null {
  let s = input.trim().replace(/\s/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // Whichever separator comes last is the decimal separator.
    const dec = lastComma > lastDot ? "," : ".";
    const thou = dec === "," ? "." : ",";
    s = s.split(thou).join("").replace(dec, ".");
  } else if (lastComma > -1) {
    // "1,234" (thousands) vs "12,5" / "12,50" (decimal)
    const after = s.length - lastComma - 1;
    s = after === 3 && s.indexOf(",") === lastComma && currencyDecimals(currency) !== 3
      ? s.replace(",", "")
      : s.split(",").join(".");
  }
  if (!/^\d*\.?\d*$/.test(s) || s === ".") return null;
  const value = Number(s);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 10 ** currencyDecimals(currency));
}

export function toMajor(minor: number, currency: string): number {
  return minor / 10 ** currencyDecimals(currency);
}

export function minorToInput(minor: number, currency: string): string {
  return toMajor(minor, currency).toFixed(currencyDecimals(currency));
}

export function formatMoney(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
      toMajor(minor, currency),
    );
  } catch {
    return `${toMajor(minor, currency).toFixed(2)} ${currency}`;
  }
}

/**
 * Split `total` minor units proportionally to `weights`, using largest-remainder
 * so the parts always sum exactly to `total`. Ties go to keys in insertion order.
 */
export function allocate(total: number, weights: Record<string, number>): Record<string, number> {
  const keys = Object.keys(weights).filter((k) => weights[k] > 0);
  const out: Record<string, number> = {};
  const sum = keys.reduce((a, k) => a + weights[k], 0);
  if (!keys.length || sum <= 0) return out;
  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);
  const raw = keys.map((k) => (abs * weights[k]) / sum);
  const floors = raw.map(Math.floor);
  let rest = abs - floors.reduce((a, b) => a + b, 0);
  const order = keys
    .map((_, i) => i)
    .sort((a, b) => raw[b] - floors[b] - (raw[a] - floors[a]) || a - b);
  for (const i of order) {
    if (rest <= 0) break;
    floors[i] += 1;
    rest -= 1;
  }
  keys.forEach((k, i) => (out[k] = sign * floors[i]));
  return out;
}

/** What each person owes for this expense, in minor units of the expense currency. */
export function owedShares(e: Pick<Expense, "amountMinor" | "split">): Record<string, number> {
  const { mode, parts } = e.split;
  if (mode === "exact") {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parts)) if (v) out[k] = v;
    return out;
  }
  // equal: parts are 1/0 flags; shares and percent: parts are weights.
  return allocate(e.amountMinor, parts);
}

export interface SplitCheck {
  ok: boolean;
  message?: string;
}

export function validateSplit(e: Pick<Expense, "amountMinor" | "split" | "paidBy" | "currency">): SplitCheck {
  const { mode, parts } = e.split;
  const paid = Object.values(e.paidBy).reduce((a, b) => a + b, 0);
  if (e.amountMinor <= 0) return { ok: false, message: "Enter an amount" };
  if (paid !== e.amountMinor) {
    return {
      ok: false,
      message: `Payers add up to ${formatMoney(paid, e.currency)}, not ${formatMoney(e.amountMinor, e.currency)}`,
    };
  }
  const positive = Object.values(parts).filter((v) => v > 0);
  if (!positive.length) return { ok: false, message: "Pick at least one person to split with" };
  if (mode === "exact") {
    const s = positive.reduce((a, b) => a + b, 0);
    if (s !== e.amountMinor) {
      return {
        ok: false,
        message: `Split adds up to ${formatMoney(s, e.currency)}, not ${formatMoney(e.amountMinor, e.currency)}`,
      };
    }
  }
  if (mode === "percent") {
    const s = positive.reduce((a, b) => a + b, 0);
    if (Math.abs(s - 100) > 1e-9) return { ok: false, message: `Percentages add up to ${s}%, not 100%` };
  }
  return { ok: true };
}
