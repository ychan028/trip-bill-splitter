import { useEffect, useMemo, useRef, useState } from "react";
import { useOnline, useStore } from "../app-context";
import { prefetchRates, rateToBase } from "../lib/fx";
import type { Expense, Trip } from "../lib/types";

export interface TripData {
  trip: Trip | null | undefined; // undefined = loading
  expenses: Expense[];
  pending: boolean;
  me: string | undefined;
  isMember: boolean;
  nameOf: (personId: string) => string;
}

export function useTrip(code: string): TripData {
  const store = useStore();
  const online = useOnline();
  const [trip, setTrip] = useState<Trip | null | undefined>(undefined);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [pending, setPending] = useState(false);

  useEffect(() => store.watchTrip(code, setTrip), [store, code]);
  // Firestore rules only allow members to read expenses, so wait until joined.
  const isMember = !!trip?.members.includes(store.uid);
  useEffect(() => {
    if (!isMember) return;
    return store.watchExpenses(code, (list, p) => {
      setExpenses(list);
      setPending(p);
    });
  }, [store, code, isMember]);

  const base = trip?.baseCurrency;
  // Refresh rates once per day per device and share them through the trip doc.
  const sharedDate = trip?.sharedRates?.date;
  useEffect(() => {
    if (!online || !base) return;
    prefetchRates(base).then((t) => {
      if (t && (!sharedDate || t.date > sharedDate)) store.updateTrip(code, { sharedRates: t });
    });
  }, [online, base, sharedDate, store, code]);

  // Fill in exchange rates for anything entered offline without one.
  const inFlight = useRef(new Set<string>());
  useEffect(() => {
    if (!online || !base) return;
    for (const e of expenses) {
      if (e.rateSource !== "pending" || e.deleted || inFlight.current.has(e.id)) continue;
      inFlight.current.add(e.id);
      rateToBase(e.currency, base, e.date, trip ?? undefined)
        .then((r) => {
          if (r) store.saveExpense(code, { ...e, rateToBase: r.rate, rateSource: r.source });
        })
        .finally(() => inFlight.current.delete(e.id));
    }
  }, [online, base, expenses, store, code, trip]);

  const names = useMemo(() => new Map(trip?.people.map((p) => [p.id, p.name]) ?? []), [trip]);
  return {
    trip,
    expenses,
    pending,
    me: isMember ? trip?.memberPeople[store.uid] || undefined : undefined,
    isMember,
    nameOf: (id) => names.get(id) ?? "?",
  };
}
