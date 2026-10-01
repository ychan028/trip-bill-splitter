import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";
import type { Expense, Trip } from "./types";

const trip = {
  code: "ABCDEFGHJK",
  name: "t",
  baseCurrency: "USD",
  members: [],
  memberPeople: {},
  people: [{ id: "a", name: "Ann" }],
  categories: [],
  createdAt: 0,
} as Trip;

function exp(p: Partial<Expense>): Expense {
  return {
    id: "1",
    description: "x",
    notes: "",
    category: "Food",
    date: "2026-10-01",
    amountMinor: 1250,
    currency: "USD",
    rateToBase: 1,
    rateSource: "same",
    paidBy: { a: 1250 },
    split: { mode: "equal", parts: { a: 1 } },
    isSettlement: false,
    createdBy: "a",
    createdAt: 0,
    updatedBy: "a",
    updatedAt: 0,
    ...p,
  };
}

describe("toCsv", () => {
  it("neutralises formula-looking text", () => {
    const row = toCsv([exp({ description: '=HYPERLINK("http://x","y")', notes: "@SUM(A1)" })], trip).split("\n")[1];
    expect(row).toContain(`"'=HYPERLINK(""http://x"",""y"")"`);
    expect(row).toContain("'@SUM(A1)");
  });

  it("leaves plain numbers alone", () => {
    const row = toCsv([exp({ description: "-5.00" })], trip).split("\n")[1];
    expect(row).toMatch(/^2026-10-01,-5\.00,Food,12\.50,USD,/);
  });
});
