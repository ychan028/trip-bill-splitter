import { describe, expect, it } from "vitest";
import { findDate, parseNumberToken, parseReceipt } from "./receipt";

const today = new Date("2026-10-01T12:00:00Z");

describe("parseNumberToken", () => {
  it.each([
    ["12,50", 12.5],
    ["12.50", 12.5],
    ["1.234,56", 1234.56],
    ["1,234.56", 1234.56],
    ["1500", 1500],
    ["1.500", 1500],
  ])("%s", (s, n) => expect(parseNumberToken(s)).toBe(n));
});

describe("parseReceipt", () => {
  it("German supermarket receipt", () => {
    const text = `REWE Markt GmbH
Hauptstr. 12
Milch 1,19
Brot 2,49
Zwischensumme 3,68
SUMME EUR 3,68
Gegeben BAR 10,00
Rückgeld 6,32
MwSt 7% 0,24
28.09.26 14:31`;
    expect(parseReceipt(text, today)).toEqual({ total: 3.68, currency: "EUR", date: "2026-09-28", merchant: "REWE Markt GmbH" });
  });

  it("restaurant with subtotal, tax and tip lines", () => {
    const text = `Trattoria Roma
Date: 30/09/2026
Pasta 14.00
Vino 22.00
Subtotal 36.00
IVA 10% 3.60
TOTALE € 39.60
Mancia suggerita 4.00`;
    const r = parseReceipt(text, today);
    expect(r.total).toBe(39.6);
    expect(r.currency).toBe("EUR");
    expect(r.date).toBe("2026-09-30");
  });

  it("total on the following line", () => {
    const r = parseReceipt("Cafe\nTOTAL\n£7.40\nVISA 7.40", today);
    expect(r.total).toBe(7.4);
    expect(r.currency).toBe("GBP");
  });

  it("falls back to largest amount, ignores cash tendered", () => {
    const r = parseReceipt("Kiosk\nWater 2.50\nSnack 3.75\nCash 20.00\nChange 13.75", today);
    expect(r.total).toBe(3.75);
  });

  it("returns empty fields when nothing is readable", () => {
    expect(parseReceipt("~~ ### ~~", today)).toEqual({ total: undefined, currency: undefined, date: undefined, merchant: undefined });
  });
});

describe("findDate", () => {
  it("rejects dates far from today", () => {
    expect(findDate("01.01.2019", today)).toBeUndefined();
  });
  it("handles month-first when day-first is impossible", () => {
    expect(findDate("09/28/2026", today)).toBe("2026-09-28");
  });
  it("ISO", () => {
    expect(findDate("2026-09-29 18:02", today)).toBe("2026-09-29");
  });
});
