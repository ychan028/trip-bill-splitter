import { createContext, useContext, useEffect, useState } from "react";
import type { Store } from "./store";

export const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error("Store not ready");
  return s;
}

export function useRoute(): string[] {
  const parse = () => location.hash.replace(/^#\/?/, "").split("?")[0].split("/").filter(Boolean);
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export function hashQuery(): URLSearchParams {
  return new URLSearchParams(location.hash.split("?")[1] ?? "");
}

export function go(path: string) {
  location.hash = path;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, []);
  return online;
}

export const CURRENCIES = [
  "USD", "EUR", "GBP", "CHF", "CZK", "DKK", "HUF", "ISK", "NOK", "PLN", "RON", "SEK", "TRY",
  "JPY", "KRW", "CNY", "HKD", "TWD", "SGD", "THB", "MYR", "IDR", "PHP", "VND", "INR",
  "AUD", "NZD", "CAD", "MXN", "BRL", "ZAR", "ILS", "AED", "MAD", "EGP",
];
