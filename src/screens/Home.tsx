import { useEffect, useState } from "react";
import { go, useStore } from "../app-context";
import { formatCode } from "../lib/ids";
import type { Trip } from "../lib/types";
import { OfflineStatus } from "./OfflineStatus";

export function Home() {
  const store = useStore();
  const [trips, setTrips] = useState<Trip[] | null>(null);
  useEffect(() => store.watchMyTrips(setTrips), [store]);

  return (
    <main className="page">
      <h1>Trips</h1>
      <OfflineStatus />
      {trips === null && <p className="muted">Loading…</p>}
      {trips?.length === 0 && <p className="muted">No trips yet. Create one, or join with a code from a friend.</p>}
      <ul className="list">
        {trips?.map((t) => (
          <li key={t.code}>
            <a className="row" href={`#/trip/${t.code}`}>
              <span>
                <strong>{t.name}</strong>
                <br />
                <small className="muted">
                  {t.people.map((p) => p.name).join(", ")} · {t.baseCurrency} · {formatCode(t.code)}
                </small>
              </span>
              <span aria-hidden>›</span>
            </a>
          </li>
        ))}
      </ul>
      <div className="actions">
        <button className="primary" onClick={() => go("/new")}>New trip</button>
        <button onClick={() => go("/join")}>Join with code</button>
      </div>
    </main>
  );
}
