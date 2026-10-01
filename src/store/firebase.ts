import { initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";
import {
  arrayUnion,
  collection,
  doc,
  getDocFromServer,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { randomCode } from "../lib/ids";
import type { Expense, Trip } from "../lib/types";
import type { NewTrip, Store } from "./types";

function report(err: unknown) {
  console.error(err);
  window.dispatchEvent(new CustomEvent("store-error", { detail: String((err as Error)?.message ?? err) }));
}

function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);
}

export async function createFirebaseStore(config: FirebaseOptions): Promise<Store> {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    ignoreUndefinedProperties: true,
  });

  // The anonymous session is persisted in IndexedDB, so this only hits the
  // network the very first time the app is opened on a device.
  const user = await new Promise<User>((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        unsub();
        resolve(u);
      }
    });
    auth.authStateReady().then(() => {
      if (!auth.currentUser) {
        signInAnonymously(auth).catch((e) => {
          unsub();
          reject(new Error(`First launch needs internet to set up this device (${e.code ?? e.message})`));
        });
      }
    });
  });
  const uid = user.uid;
  const tripRef = (code: string) => doc(db, "trips", code);
  const expCol = (code: string) => collection(db, "trips", code, "expenses");

  return {
    mode: "firebase",
    uid,
    watchMyTrips(cb) {
      return onSnapshot(
        query(collection(db, "trips"), where("members", "array-contains", uid)),
        (snap) => cb(snap.docs.map((d) => d.data() as Trip).sort((a, b) => b.createdAt - a.createdAt)),
        report,
      );
    },
    watchTrip(code, cb) {
      return onSnapshot(tripRef(code), (snap) => cb(snap.exists() ? (snap.data() as Trip) : null), report);
    },
    watchExpenses(code, cb) {
      return onSnapshot(
        expCol(code),
        { includeMetadataChanges: true },
        (snap) => cb(snap.docs.map((d) => d.data() as Expense), snap.metadata.hasPendingWrites),
        report,
      );
    },
    createTrip(t: NewTrip, myPersonId) {
      const code = randomCode();
      const trip: Trip = { ...t, code, members: [uid], memberPeople: { [uid]: myPersonId }, createdAt: Date.now() };
      // Not awaited: resolves only once the server acknowledges, which never happens offline.
      setDoc(tripRef(code), trip).catch(report);
      return code;
    },
    async joinTrip(code) {
      const snap = await withTimeout(
        getDocFromServer(tripRef(code)),
        10000,
        "Couldn't reach the server. Joining a trip needs internet once.",
      ).catch((e) => {
        throw new Error(e.code === "unavailable" ? "Joining a trip needs internet once." : e.message);
      });
      if (!snap.exists()) throw new Error("No trip with that code");
      const trip = snap.data() as Trip;
      if (!trip.members.includes(uid)) {
        await withTimeout(updateDoc(tripRef(code), { members: arrayUnion(uid) }), 10000, "Join timed out");
        trip.members = [...trip.members, uid];
      }
      return trip;
    },
    updateTrip(code, patch) {
      updateDoc(tripRef(code), patch).catch(report);
    },
    setMyPerson(code, personId, addPerson) {
      const patch: Record<string, unknown> = { [`memberPeople.${uid}`]: personId };
      if (addPerson) patch.people = arrayUnion(addPerson);
      updateDoc(tripRef(code), patch).catch(report);
    },
    saveExpense(code, e) {
      setDoc(doc(expCol(code), e.id), e).catch(report);
    },
  };
}
