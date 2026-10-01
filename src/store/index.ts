import { firebaseConfig } from "../firebase-config";
import { createLocalStore } from "./local";
import type { Store } from "./types";

export type { Store } from "./types";

export async function createStore(): Promise<Store> {
  const forceLocal = new URLSearchParams(location.search).has("local");
  if (firebaseConfig && !forceLocal) {
    const { createFirebaseStore } = await import("./firebase");
    return createFirebaseStore(firebaseConfig);
  }
  return createLocalStore();
}
