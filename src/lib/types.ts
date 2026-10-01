export type SplitMode = "equal" | "exact" | "shares" | "percent";

export interface Person {
  id: string;
  name: string;
}

export interface Trip {
  code: string;
  name: string;
  baseCurrency: string;
  members: string[];
  memberPeople: Record<string, string>;
  people: Person[];
  categories: string[];
  createdAt: number;
  /** Agreed rates (1 unit of currency = n base). When set, used for new expenses in that currency. */
  fixedRates?: Record<string, number>;
  /** Last rate table any member fetched, synced so offline phones can still convert. */
  sharedRates?: { date: string; rates: Record<string, number> };
}

export type RateSource = "ecb" | "alt" | "fixed" | "manual" | "pending" | "same";

export interface Expense {
  id: string;
  description: string;
  notes: string;
  category: string;
  date: string; // YYYY-MM-DD
  amountMinor: number;
  currency: string;
  rateToBase: number | null; // base units per 1 unit of `currency`
  rateSource: RateSource;
  paidBy: Record<string, number>; // personId -> minor units of `currency`
  split: { mode: SplitMode; parts: Record<string, number> };
  isSettlement: boolean;
  receiptText?: string;
  createdBy: string;
  createdAt: number;
  updatedBy: string;
  updatedAt: number;
  deleted?: boolean;
  deletedBy?: string;
}

export const DEFAULT_CATEGORIES = [
  "Food",
  "Drinks",
  "Lodging",
  "Transport",
  "Activities",
  "Groceries",
  "Shopping",
  "Fees",
  "Other",
];
