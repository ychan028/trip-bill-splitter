import { useEffect, useState } from "react";
import { go, useStore } from "../app-context";
import { formatCode, normalizeCode, randomId } from "../lib/ids";
import type { Trip } from "../lib/types";

export function JoinTrip({ initialCode }: { initialCode: string }) {
  const store = useStore();
  const [code, setCode] = useState(initialCode ? formatCode(normalizeCode(initialCode)) : "");
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const t = await store.joinTrip(normalizeCode(code));
      const mine = t.memberPeople[store.uid];
      if (mine) go(`/trip/${t.code}`);
      else setTrip(t);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (initialCode) join();
  }, []);

  if (trip) return <WhoAreYou trip={trip} />;

  return (
    <main className="page">
      <a href="#/" className="back">‹ Trips</a>
      <h1>Join a trip</h1>
      <label>
        Trip code
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABCDE-FGHJK"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="primary" disabled={busy || normalizeCode(code).length < 10} onClick={join}>
        {busy ? "Joining…" : "Join"}
      </button>
    </main>
  );
}

export function WhoAreYou({ trip }: { trip: Trip }) {
  const store = useStore();
  const [newName, setNewName] = useState("");
  const claimed = new Set(Object.values(trip.memberPeople));

  function pick(personId: string, add?: { id: string; name: string }) {
    store.setMyPerson(trip.code, personId, add);
    go(`/trip/${trip.code}`);
  }

  return (
    <main className="page">
      <h1>{trip.name}</h1>
      <p>Which one is you? Entries you add will show your name.</p>
      <ul className="list">
        {trip.people.map((p) => (
          <li key={p.id}>
            <button className="row" onClick={() => pick(p.id)}>
              <span>{p.name}</span>
              {claimed.has(p.id) && <small className="muted">already on another device</small>}
            </button>
          </li>
        ))}
      </ul>
      <label>
        Not listed? Add yourself
        <input value={newName} onChange={(e) => setNewName(e.target.value)} />
      </label>
      <button
        disabled={!newName.trim()}
        onClick={() => {
          const id = randomId();
          pick(id, { id, name: newName.trim() });
        }}
      >
        Add me
      </button>
    </main>
  );
}
