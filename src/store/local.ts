import { randomCode, randomId } from "../lib/ids";
import type { Expense, ReceiptPhoto, Trip } from "../lib/types";
import type { NewTrip, Store } from "./types";

// Single-device store used when no Firebase config is set.
const TRIPS = "local:trips";
const EXP = (code: string) => `local:expenses:${code}`;
const RECEIPT = (code: string, id: string) => `local:receipt:${code}:${id}`;

function read<T>(k: string, fallback: T): T {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

const listeners = new Set<() => void>();
function write(k: string, v: unknown) {
  localStorage.setItem(k, JSON.stringify(v));
  listeners.forEach((l) => l());
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  fn();
  return () => {
    listeners.delete(fn);
  };
}

export function createLocalStore(): Store {
  let uid = localStorage.getItem("local:uid");
  if (!uid) {
    uid = randomId();
    localStorage.setItem("local:uid", uid);
  }
  const me = uid;
  const trips = () => read<Record<string, Trip>>(TRIPS, {});
  const putTrip = (t: Trip) => write(TRIPS, { ...trips(), [t.code]: t });

  return {
    mode: "local",
    uid: me,
    watchMyTrips: (cb) => subscribe(() => cb(Object.values(trips()).sort((a, b) => b.createdAt - a.createdAt))),
    watchTrip: (code, cb) => subscribe(() => cb(trips()[code] ?? null)),
    watchExpenses: (code, cb) => subscribe(() => cb(read<Expense[]>(EXP(code), []), false)),
    createTrip(t: NewTrip, myPersonId) {
      const code = randomCode();
      putTrip({ ...t, code, members: [me], memberPeople: { [me]: myPersonId }, createdAt: Date.now() });
      return code;
    },
    async joinTrip(code) {
      const t = trips()[code];
      if (!t) throw new Error("Trip not found on this device (local-only mode can't join other phones' trips)");
      return t;
    },
    updateTrip(code, patch) {
      const t = trips()[code];
      if (t) putTrip({ ...t, ...patch });
    },
    setMyPerson(code, personId, addPerson) {
      const t = trips()[code];
      if (!t) return;
      putTrip({
        ...t,
        people: addPerson ? [...t.people, addPerson] : t.people,
        memberPeople: { ...t.memberPeople, [me]: personId },
      });
    },
    saveReceipt(code, r: ReceiptPhoto) {
      try {
        write(RECEIPT(code, r.id), r);
      } catch {
        window.dispatchEvent(new CustomEvent("store-error", { detail: "Phone storage is full; photo not saved" }));
      }
    },
    watchReceipt: (code, id, cb) => subscribe(() => cb(read<ReceiptPhoto | null>(RECEIPT(code, id), null))),
    saveExpense(code, e) {
      const list = read<Expense[]>(EXP(code), []);
      const i = list.findIndex((x) => x.id === e.id);
      if (i >= 0) list[i] = e;
      else list.push(e);
      write(EXP(code), list);
    },
  };
}
