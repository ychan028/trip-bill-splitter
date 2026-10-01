import { currencyDecimals, owedShares } from "./money";
import type { Expense } from "./types";

export interface Balances {
  /** Net per person in base-currency minor units. Positive = is owed money. Sums to 0. */
  net: Record<string, number>;
  /** Net per currency per person, in that currency's minor units (exact, no FX). */
  byCurrency: Record<string, Record<string, number>>;
  /** Spending per category in base minor units (settlements excluded). */
  byCategory: Record<string, number>;
  /** Each person's share of consumption in base minor units (settlements excluded). */
  spentBy: Record<string, number>;
  totalSpent: number;
  /** Expenses left out of base totals because they have no exchange rate yet. */
  pendingRate: Expense[];
}

function convert(minor: number, from: string, rate: number, base: string): number {
  return (minor / 10 ** currencyDecimals(from)) * rate * 10 ** currencyDecimals(base);
}

/** Round floats to integers while keeping the total at exactly 0. */
function roundZeroSum(values: Record<string, number>): Record<string, number> {
  const keys = Object.keys(values);
  const out: Record<string, number> = {};
  for (const k of keys) out[k] = Math.round(values[k]);
  let drift = keys.reduce((a, k) => a + out[k], 0);
  // Push rounding drift onto whoever's rounding error was largest in that direction.
  while (drift !== 0) {
    const dir = drift > 0 ? -1 : 1;
    let best = keys[0];
    let bestErr = -Infinity;
    for (const k of keys) {
      const err = dir * (values[k] - out[k]);
      if (err > bestErr) {
        bestErr = err;
        best = k;
      }
    }
    out[best] += dir;
    drift += dir;
  }
  return out;
}

export function computeBalances(expenses: Expense[], personIds: string[], base: string): Balances {
  const net: Record<string, number> = {};
  const spentBy: Record<string, number> = {};
  for (const p of personIds) {
    net[p] = 0;
    spentBy[p] = 0;
  }
  const byCurrency: Record<string, Record<string, number>> = {};
  const byCategory: Record<string, number> = {};
  const pendingRate: Expense[] = [];
  let totalSpent = 0;

  for (const e of expenses) {
    if (e.deleted) continue;
    const owed = owedShares(e);
    const cur = (byCurrency[e.currency] ??= {});
    const ids = new Set([...Object.keys(e.paidBy), ...Object.keys(owed)]);
    for (const p of ids) {
      cur[p] = (cur[p] ?? 0) + (e.paidBy[p] ?? 0) - (owed[p] ?? 0);
    }
    const rate = e.currency === base ? 1 : e.rateToBase;
    if (rate == null || !(rate > 0)) {
      pendingRate.push(e);
      continue;
    }
    for (const p of ids) {
      net[p] = (net[p] ?? 0) + convert((e.paidBy[p] ?? 0) - (owed[p] ?? 0), e.currency, rate, base);
    }
    if (!e.isSettlement) {
      const amt = convert(e.amountMinor, e.currency, rate, base);
      byCategory[e.category] = (byCategory[e.category] ?? 0) + amt;
      totalSpent += amt;
      for (const [p, v] of Object.entries(owed)) {
        spentBy[p] = (spentBy[p] ?? 0) + convert(v, e.currency, rate, base);
      }
    }
  }

  for (const k of Object.keys(byCategory)) byCategory[k] = Math.round(byCategory[k]);
  for (const k of Object.keys(spentBy)) spentBy[k] = Math.round(spentBy[k]);
  return {
    net: roundZeroSum(net),
    byCurrency,
    byCategory,
    spentBy,
    totalSpent: Math.round(totalSpent),
    pendingRate,
  };
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

/** Greedy settle-up: repeatedly match the largest debtor with the largest creditor. */
export function settleUp(net: Record<string, number>): Transfer[] {
  const debtors = Object.entries(net)
    .filter(([, v]) => v < 0)
    .map(([id, v]) => ({ id, amt: -v }));
  const creditors = Object.entries(net)
    .filter(([, v]) => v > 0)
    .map(([id, v]) => ({ id, amt: v }));
  const out: Transfer[] = [];
  const byAmt = (a: { amt: number }, b: { amt: number }) => b.amt - a.amt;
  while (debtors.length && creditors.length) {
    debtors.sort(byAmt);
    creditors.sort(byAmt);
    const d = debtors[0];
    const c = creditors[0];
    const amt = Math.min(d.amt, c.amt);
    out.push({ from: d.id, to: c.id, amount: amt });
    d.amt -= amt;
    c.amt -= amt;
    if (d.amt === 0) debtors.shift();
    if (c.amt === 0) creditors.shift();
  }
  return out;
}
