import type { Expense, Person, ReceiptPhoto, Trip } from "../lib/types";

export type Unsub = () => void;

export interface NewTrip {
  name: string;
  baseCurrency: string;
  people: Person[];
  categories: string[];
}

export interface Store {
  mode: "firebase" | "local";
  uid: string;
  watchMyTrips(cb: (trips: Trip[]) => void): Unsub;
  watchTrip(code: string, cb: (trip: Trip | null) => void): Unsub;
  /** `pending` is true while some local writes have not reached the server. */
  watchExpenses(code: string, cb: (expenses: Expense[], pending: boolean) => void): Unsub;
  /** Synchronous: works offline. `myPersonId` must be one of `t.people`. */
  createTrip(t: NewTrip, myPersonId: string): string;
  /** Needs a connection in firebase mode. Throws with a readable message on failure. */
  joinTrip(code: string): Promise<Trip>;
  updateTrip(code: string, patch: Partial<Pick<Trip, "name" | "people" | "categories" | "baseCurrency" | "fixedRates" | "sharedRates">>): void;
  setMyPerson(code: string, personId: string, addPerson?: Person): void;
  /** Writes the full expense document. Fire-and-forget: queued while offline. */
  saveExpense(code: string, e: Expense): void;
  /** Fire-and-forget like saveExpense; syncs when back online. */
  saveReceipt(code: string, r: ReceiptPhoto): void;
  watchReceipt(code: string, expenseId: string, cb: (r: ReceiptPhoto | null) => void): Unsub;
}
