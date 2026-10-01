import { useEffect, useState } from "react";
import { StoreContext, useOnline, useRoute } from "./app-context";
import { createStore, type Store } from "./store";
import { ExpenseForm } from "./screens/ExpenseForm";
import { Home } from "./screens/Home";
import { JoinTrip } from "./screens/JoinTrip";
import { NewTripForm } from "./screens/NewTripForm";
import { TripView } from "./screens/TripView";

export function App() {
  const [store, setStore] = useState<Store | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const online = useOnline();
  const route = useRoute();

  useEffect(() => {
    createStore().then(setStore, (e) => setFatal(String(e.message ?? e)));
    const onErr = (e: Event) => setToast((e as CustomEvent).detail);
    window.addEventListener("store-error", onErr);
    return () => window.removeEventListener("store-error", onErr);
  }, []);

  if (fatal) {
    return (
      <main className="page">
        <h1>Can't start</h1>
        <p className="error">{fatal}</p>
        <button onClick={() => location.reload()}>Retry</button>
      </main>
    );
  }
  if (!store) return <main className="page muted">Loading…</main>;

  const [section, code, sub, id] = route;
  let screen;
  if (section === "new") screen = <NewTripForm />;
  else if (section === "join") screen = <JoinTrip initialCode={code ?? ""} />;
  else if (section === "trip" && code && sub === "add") screen = <ExpenseForm code={code} />;
  else if (section === "trip" && code && sub === "pay") screen = <ExpenseForm code={code} settlement />;
  else if (section === "trip" && code && sub === "edit" && id) screen = <ExpenseForm code={code} expenseId={id} />;
  else if (section === "trip" && code) screen = <TripView code={code} tab={sub} />;
  else screen = <Home />;

  return (
    <StoreContext.Provider value={store}>
      {!online && <div className="banner offline">Offline: changes are saved and will sync later</div>}
      {store.mode === "local" && (
        <div className="banner local">Local-only mode: data stays on this device</div>
      )}
      {toast && (
        <div className="toast" onClick={() => setToast(null)}>
          {toast} <span className="muted">(tap to dismiss)</span>
        </div>
      )}
      {screen}
    </StoreContext.Provider>
  );
}
