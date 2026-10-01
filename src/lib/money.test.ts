import { describe, expect, it } from "vitest";
import { allocate, currencyDecimals, owedShares, parseAmount, validateSplit } from "./money";

describe("currencyDecimals", () => {
  it("knows zero- and two-decimal currencies", () => {
    expect(currencyDecimals("USD")).toBe(2);
    expect(currencyDecimals("EUR")).toBe(2);
    expect(currencyDecimals("JPY")).toBe(0);
  });
});

describe("parseAmount", () => {
  it.each([
    ["12.50", "EUR", 1250],
    ["12,50", "EUR", 1250],
    ["12,5", "EUR", 1250],
    ["1,234.56", "USD", 123456],
    ["1.234,56", "EUR", 123456],
    ["1,234", "USD", 123400],
    ["1500", "JPY", 1500],
    ["0.1", "USD", 10],
    [" 7 ", "USD", 700],
  ])("%s %s -> %d", (input, cur, expected) => {
    expect(parseAmount(input, cur)).toBe(expected);
  });

  it.each(["", "abc", ".", "1.2.3x", "-5"])("rejects %j", (input) => {
    expect(parseAmount(input, "USD")).toBeNull();
  });
});

describe("allocate", () => {
  it("splits 10.00 three ways without losing a cent", () => {
    const r = allocate(1000, { a: 1, b: 1, c: 1 });
    expect(Object.values(r).reduce((x, y) => x + y)).toBe(1000);
    expect(r).toEqual({ a: 334, b: 333, c: 333 });
  });

  it("respects weights", () => {
    expect(allocate(1000, { a: 2, b: 1, c: 1 })).toEqual({ a: 500, b: 250, c: 250 });
  });

  it("ignores zero weights", () => {
    expect(allocate(1000, { a: 1, b: 0 })).toEqual({ a: 1000 });
  });

  it("handles negative totals", () => {
    const r = allocate(-1000, { a: 1, b: 1, c: 1 });
    expect(Object.values(r).reduce((x, y) => x + y)).toBe(-1000);
  });
});

describe("owedShares", () => {
  it("percent mode", () => {
    expect(owedShares({ amountMinor: 999, split: { mode: "percent", parts: { a: 50, b: 50 } } })).toEqual({
      a: 500,
      b: 499,
    });
  });
  it("exact mode passes through", () => {
    expect(owedShares({ amountMinor: 1000, split: { mode: "exact", parts: { a: 700, b: 300 } } })).toEqual({
      a: 700,
      b: 300,
    });
  });
});

describe("validateSplit", () => {
  const base = { amountMinor: 1000, currency: "USD", paidBy: { a: 1000 } };
  it("accepts a normal equal split", () => {
    expect(validateSplit({ ...base, split: { mode: "equal", parts: { a: 1, b: 1 } } }).ok).toBe(true);
  });
  it("rejects payer mismatch", () => {
    expect(validateSplit({ ...base, paidBy: { a: 900 }, split: { mode: "equal", parts: { a: 1 } } }).ok).toBe(false);
  });
  it("rejects exact split mismatch", () => {
    expect(validateSplit({ ...base, split: { mode: "exact", parts: { a: 500, b: 400 } } }).ok).toBe(false);
  });
  it("rejects percent not summing to 100", () => {
    expect(validateSplit({ ...base, split: { mode: "percent", parts: { a: 50, b: 40 } } }).ok).toBe(false);
  });
});
