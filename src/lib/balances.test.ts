import { describe, expect, it } from "vitest";
import { computeBalances, settleUp } from "./balances";
import type { Expense } from "./types";

let n = 0;
function exp(p: Partial<Expense>): Expense {
  return {
    id: String(n++),
    description: "x",
    notes: "",
    category: "Food",
    date: "2026-10-01",
    amountMinor: 0,
    currency: "USD",
    rateToBase: 1,
    rateSource: "same",
    paidBy: {},
    split: { mode: "equal", parts: {} },
    isSettlement: false,
    createdBy: "a",
    createdAt: 0,
    updatedBy: "a",
    updatedAt: 0,
    ...p,
  };
}

const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

describe("computeBalances", () => {
  it("single currency equal split", () => {
    const b = computeBalances(
      [exp({ amountMinor: 3000, paidBy: { a: 3000 }, split: { mode: "equal", parts: { a: 1, b: 1, c: 1 } } })],
      ["a", "b", "c"],
      "USD",
    );
    expect(b.net).toEqual({ a: 2000, b: -1000, c: -1000 });
    expect(b.totalSpent).toBe(3000);
  });

  it("mixes currencies via stored rate and stays zero-sum", () => {
    const b = computeBalances(
      [
        exp({ amountMinor: 1000, currency: "EUR", rateToBase: 1.0937, paidBy: { a: 1000 }, split: { mode: "equal", parts: { a: 1, b: 1, c: 1 } } }),
        exp({ amountMinor: 5000, currency: "USD", paidBy: { b: 5000 }, split: { mode: "equal", parts: { a: 1, b: 1 } } }),
        exp({ amountMinor: 3333, currency: "JPY", rateToBase: 0.0067, paidBy: { c: 3333 }, split: { mode: "shares", parts: { a: 2, c: 1 } } }),
      ],
      ["a", "b", "c"],
      "USD",
    );
    expect(sum(b.net)).toBe(0);
    expect(b.byCurrency.EUR).toEqual({ a: 666, b: -333, c: -333 });
    expect(sum(b.byCurrency.JPY)).toBe(0);
    expect(b.pendingRate).toHaveLength(0);
  });

  it("multiple payers", () => {
    const b = computeBalances(
      [exp({ amountMinor: 1000, paidBy: { a: 600, b: 400 }, split: { mode: "equal", parts: { a: 1, b: 1 } } })],
      ["a", "b"],
      "USD",
    );
    expect(b.net).toEqual({ a: 100, b: -100 });
  });

  it("settlements move balances but not spending", () => {
    const b = computeBalances(
      [
        exp({ amountMinor: 2000, paidBy: { a: 2000 }, split: { mode: "equal", parts: { a: 1, b: 1 } } }),
        exp({ amountMinor: 1000, isSettlement: true, paidBy: { b: 1000 }, split: { mode: "exact", parts: { a: 1000 } } }),
      ],
      ["a", "b"],
      "USD",
    );
    expect(b.net).toEqual({ a: 0, b: 0 });
    expect(b.totalSpent).toBe(2000);
  });

  it("skips deleted and reports pending-rate expenses", () => {
    const b = computeBalances(
      [
        exp({ amountMinor: 2000, deleted: true, paidBy: { a: 2000 }, split: { mode: "equal", parts: { b: 1 } } }),
        exp({ amountMinor: 900, currency: "CHF", rateToBase: null, rateSource: "pending", paidBy: { a: 900 }, split: { mode: "equal", parts: { b: 1 } } }),
      ],
      ["a", "b"],
      "USD",
    );
    expect(b.net).toEqual({ a: 0, b: 0 });
    expect(b.pendingRate).toHaveLength(1);
    expect(b.byCurrency.CHF).toEqual({ a: 900, b: -900 });
  });
});

describe("settleUp", () => {
  it("produces transfers that zero everyone out", () => {
    const net = { a: 5000, b: -2000, c: -2500, d: -500 };
    const t = settleUp(net);
    const after = { ...net };
    for (const { from, to, amount } of t) {
      after[from as keyof typeof after] += amount;
      after[to as keyof typeof after] -= amount;
    }
    expect(Object.values(after).every((v) => v === 0)).toBe(true);
    expect(t.length).toBeLessThanOrEqual(3);
  });
  it("nothing to do when settled", () => {
    expect(settleUp({ a: 0, b: 0 })).toEqual([]);
  });
});
