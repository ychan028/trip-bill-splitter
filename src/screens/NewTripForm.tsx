import { useState } from "react";
import { CURRENCIES, go, useStore } from "../app-context";
import { randomId } from "../lib/ids";
import { DEFAULT_CATEGORIES } from "../lib/types";

export function NewTripForm() {
  const store = useStore();
  const [name, setName] = useState("");
  const [base, setBase] = useState("USD");
  const [me, setMe] = useState("");
  const [others, setOthers] = useState("");

  const othersList = others.split(",").map((s) => s.trim()).filter(Boolean);
  const valid = name.trim() && me.trim();

  function create() {
    const myId = randomId();
    const people = [{ id: myId, name: me.trim() }, ...othersList.map((n) => ({ id: randomId(), name: n }))];
    const code = store.createTrip(
      { name: name.trim(), baseCurrency: base, people, categories: DEFAULT_CATEGORIES },
      myId,
    );
    go(`/trip/${code}/settings`);
  }

  return (
    <main className="page">
      <a href="#/" className="back">‹ Trips</a>
      <h1>New trip</h1>
      <label>
        Trip name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Europe 2026" />
      </label>
      <label>
        Your name
        <input value={me} onChange={(e) => setMe(e.target.value)} />
      </label>
      <label>
        Other people (comma separated, more can be added later)
        <input value={others} onChange={(e) => setOthers(e.target.value)} placeholder="Sam, Alex" />
      </label>
      <label>
        Home currency (balances are shown in this)
        <select value={base} onChange={(e) => setBase(e.target.value)}>
          {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <button className="primary" disabled={!valid} onClick={create}>Create trip</button>
    </main>
  );
}
