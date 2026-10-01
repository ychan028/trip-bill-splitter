import { minorToInput, owedShares } from "./money";
import type { Expense, Trip } from "./types";

function cell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(expenses: Expense[], trip: Trip): string {
  const name = new Map(trip.people.map((p) => [p.id, p.name]));
  const people = trip.people;
  const header = [
    "date", "description", "category", "amount", "currency", `rate_to_${trip.baseCurrency}`, "rate_source",
    ...people.map((p) => `paid_${p.name}`), ...people.map((p) => `share_${p.name}`),
    "settlement", "added_by", "edited_by", "deleted", "notes",
  ];
  const rows = [...expenses]
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
    .map((e) => {
      const owed = owedShares(e);
      return [
        e.date, e.description, e.category, minorToInput(e.amountMinor, e.currency), e.currency,
        e.rateToBase ?? "", e.rateSource,
        ...people.map((p) => (e.paidBy[p.id] ? minorToInput(e.paidBy[p.id], e.currency) : "")),
        ...people.map((p) => (owed[p.id] ? minorToInput(owed[p.id], e.currency) : "")),
        e.isSettlement ? "yes" : "", name.get(e.createdBy) ?? "", name.get(e.updatedBy) ?? "",
        e.deleted ? "yes" : "", e.notes,
      ];
    });
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\n");
}
