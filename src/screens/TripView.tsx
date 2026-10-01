import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { CURRENCIES, go, useStore } from "../app-context";
import { computeBalances, settleUp } from "../lib/balances";
import { toCsv } from "../lib/csv";
import { formatCode, randomId } from "../lib/ids";
import { currencyDecimals, formatMoney, owedShares } from "../lib/money";
import type { Expense, Trip } from "../lib/types";
import { WhoAreYou } from "./JoinTrip";
import { useTrip, type TripData } from "./useTrip";

export function TripView({ code, tab = "expenses" }: { code: string; tab?: string }) {
  const data = useTrip(code);
  const { trip, me, pending } = data;

  if (trip === undefined) return <main className="page muted">Loading…</main>;
  if (trip === null || !data.isMember) {
    return (
      <main className="page">
        <a href="#/" className="back">‹ Trips</a>
        <h1>Trip not available</h1>
        <p>This device isn't in that trip yet, or it hasn't synced.</p>
        <button className="primary" onClick={() => go(`/join/${code}`)}>Join with this code</button>
      </main>
    );
  }
  if (!me) return <WhoAreYou trip={trip} />;

  return (
    <main className="page has-fab">
      <a href="#/" className="back">‹ Trips</a>
      <header className="trip-head">
        <h1>{trip.name}</h1>
        <small className="muted">
          You are {data.nameOf(me)} · {pending ? "syncing…" : "saved"}
        </small>
      </header>
      <nav className="tabs">
        {[
          ["expenses", "Expenses"],
          ["balances", "Balances"],
          ["settings", "Trip"],
        ].map(([id, label]) => (
          <a key={id} href={`#/trip/${code}/${id}`} className={tab === id ? "active" : ""}>
            {label}
          </a>
        ))}
      </nav>
      {tab === "balances" ? <BalancesTab data={data} trip={trip} /> : null}
      {tab === "settings" ? <SettingsTab data={data} trip={trip} /> : null}
      {tab !== "balances" && tab !== "settings" ? <ExpensesTab data={data} trip={trip} /> : null}
      <a className="fab" href={`#/trip/${code}/add`}>+ Add expense</a>
    </main>
  );
}

function ExpensesTab({ data, trip }: { data: TripData; trip: Trip }) {
  const { expenses, nameOf } = data;
  const [person, setPerson] = useState("");
  const [category, setCategory] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);

  const shown = useMemo(
    () =>
      expenses
        .filter((e) => showDeleted || !e.deleted)
        .filter((e) => !category || e.category === category)
        .filter((e) => !person || e.paidBy[person] || owedShares(e)[person])
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    [expenses, person, category, showDeleted],
  );

  const days = new Map<string, Expense[]>();
  for (const e of shown) days.set(e.date, [...(days.get(e.date) ?? []), e]);

  return (
    <>
      <div className="filters">
        <select value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Filter by person">
          <option value="">Everyone</option>
          {trip.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
          <option value="">All categories</option>
          {[...trip.categories, "Settlement"].map((c) => <option key={c}>{c}</option>)}
        </select>
        <label className="inline">
          <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} /> Deleted
        </label>
      </div>
      {!shown.length && <p className="muted">No expenses yet.</p>}
      {[...days].map(([day, list]) => (
        <section key={day}>
          <h3 className="day">{new Date(day + "T12:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</h3>
          <ul className="list">
            {list.map((e) => (
              <li key={e.id}>
                <a className={`row expense ${e.deleted ? "deleted" : ""} ${e.isSettlement ? "settlement" : ""}`} href={`#/trip/${trip.code}/edit/${e.id}`}>
                  <span>
                    <strong>{e.isSettlement ? `${payers(e, nameOf)} paid ${Object.keys(e.split.parts).map(nameOf).join(", ")}` : e.description || e.category}</strong>
                    <br />
                    <small className="muted">
                      {e.isSettlement ? "Payment" : `${e.category} · paid by ${payers(e, nameOf)}`} · added by {nameOf(e.createdBy)}
                      {e.updatedBy !== e.createdBy || e.updatedAt - e.createdAt > 60000 ? ` · edited by ${nameOf(e.updatedBy)}` : ""}
                      {e.deleted ? ` · deleted by ${nameOf(e.deletedBy ?? "")}` : ""}
                    </small>
                  </span>
                  <span className="amount">
                    {formatMoney(e.amountMinor, e.currency)}
                    {e.currency !== trip.baseCurrency && (
                      <small className="muted">
                        {e.rateToBase ? `≈ ${formatMoney(Math.round(baseAmount(e, trip.baseCurrency)), trip.baseCurrency)}` : "rate pending"}
                      </small>
                    )}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function payers(e: Expense, nameOf: (id: string) => string) {
  return Object.keys(e.paidBy).filter((k) => e.paidBy[k]).map(nameOf).join(" + ");
}

function baseAmount(e: Expense, base: string) {
  return (e.amountMinor / 10 ** currencyDecimals(e.currency)) * (e.rateToBase ?? 0) * 10 ** currencyDecimals(base);
}

function BalancesTab({ data, trip }: { data: TripData; trip: Trip }) {
  const { expenses, nameOf } = data;
  const base = trip.baseCurrency;
  const ids = trip.people.map((p) => p.id);
  const b = useMemo(() => computeBalances(expenses, ids, base), [expenses, ids.join(), base]);
  const transfers = settleUp(b.net);
  const currencies = Object.keys(b.byCurrency);

  function exportCsv() {
    const blob = new Blob([toCsv(expenses, trip)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${trip.name.replace(/\W+/g, "-")}-expenses.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <>
      {b.pendingRate.length > 0 && (
        <p className="warn">
          {b.pendingRate.length} expense(s) have no exchange rate yet and are left out of the {base} totals.
          They'll be filled in automatically when online, or set a rate manually on the expense.
        </p>
      )}
      <h2>Who owes whom ({base})</h2>
      {transfers.length === 0 && <p className="muted">All settled up.</p>}
      <ul className="list">
        {transfers.map((t) => (
          <li key={t.from + t.to} className="row">
            <span>
              <strong>{nameOf(t.from)}</strong> → <strong>{nameOf(t.to)}</strong>
              <br />
              <small className="muted">{formatMoney(t.amount, base)}</small>
            </span>
            <button onClick={() => go(`/trip/${trip.code}/pay?from=${t.from}&to=${t.to}&amount=${t.amount}&currency=${base}`)}>
              Record payment
            </button>
          </li>
        ))}
      </ul>
      <button onClick={() => go(`/trip/${trip.code}/pay`)}>Record another payment</button>

      <h2>Net balance</h2>
      <table>
        <tbody>
          {trip.people.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td className={`num ${b.net[p.id] > 0 ? "pos" : b.net[p.id] < 0 ? "neg" : ""}`}>
                {b.net[p.id] > 0 ? "is owed " : b.net[p.id] < 0 ? "owes " : ""}
                {formatMoney(Math.abs(b.net[p.id] ?? 0), base)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {currencies.length > 1 && (
        <>
          <h2>By currency (no conversion)</h2>
          <p className="muted small">Useful if you settle in cash locally. Positive means they paid more than their share.</p>
          <table>
            <thead>
              <tr>
                <th />
                {currencies.map((c) => <th key={c} className="num">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {trip.people.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  {currencies.map((c) => (
                    <td key={c} className="num">{formatMoney(b.byCurrency[c][p.id] ?? 0, c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2>Spending ({base})</h2>
      <table>
        <tbody>
          {Object.entries(b.byCategory)
            .sort((x, y) => y[1] - x[1])
            .map(([c, v]) => (
              <tr key={c}>
                <td>{c}</td>
                <td className="num">{formatMoney(v, base)}</td>
              </tr>
            ))}
          <tr className="total">
            <td>Total</td>
            <td className="num">{formatMoney(b.totalSpent, base)}</td>
          </tr>
        </tbody>
      </table>
      <h3>Each person's share</h3>
      <table>
        <tbody>
          {trip.people.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td className="num">{formatMoney(b.spentBy[p.id] ?? 0, base)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={exportCsv}>Export CSV</button>
    </>
  );
}

function SettingsTab({ data, trip }: { data: TripData; trip: Trip }) {
  const store = useStore();
  const [qr, setQr] = useState("");
  const [newPerson, setNewPerson] = useState("");
  const [newCat, setNewCat] = useState("");
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}${location.pathname}#/join/${trip.code}`;
  const hasExpenses = data.expenses.some((e) => !e.deleted && e.currency !== trip.baseCurrency);

  useEffect(() => {
    QRCode.toDataURL(link, { margin: 1, width: 220 }).then(setQr, () => setQr(""));
  }, [link]);

  async function share() {
    const text = `Join "${trip.name}" in the trip splitter. Code: ${formatCode(trip.code)}`;
    if (navigator.share) {
      await navigator.share({ title: trip.name, text, url: link }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(`${text}\n${link}`);
      setCopied(true);
    }
  }

  return (
    <>
      <h2>Invite</h2>
      <p>
        On the other phone: install the app, tap <em>Join with code</em>, and enter:
      </p>
      <p className="code">{formatCode(trip.code)}</p>
      {qr && <img className="qr" src={qr} alt="QR code with the join link" />}
      <button onClick={share}>{copied ? "Copied" : "Share link"}</button>
      <p className="muted small">Anyone with this code can see and edit the trip.</p>

      <h2>People</h2>
      <ul className="list">
        {trip.people.map((p) => (
          <li key={p.id} className="row">
            <input
              defaultValue={p.name}
              aria-label="Name"
              onBlur={(e) => {
                const name = e.target.value.trim();
                if (name && name !== p.name) {
                  store.updateTrip(trip.code, { people: trip.people.map((x) => (x.id === p.id ? { ...x, name } : x)) });
                }
              }}
            />
            {p.id === data.me && <small className="muted">you</small>}
          </li>
        ))}
      </ul>
      <div className="inline-form">
        <input value={newPerson} onChange={(e) => setNewPerson(e.target.value)} placeholder="Add person" />
        <button
          disabled={!newPerson.trim()}
          onClick={() => {
            store.updateTrip(trip.code, { people: [...trip.people, { id: randomId(), name: newPerson.trim() }] });
            setNewPerson("");
          }}
        >
          Add
        </button>
      </div>
      <button
        className="link"
        onClick={() => {
          store.setMyPerson(trip.code, "");
        }}
      >
        I'm not {data.nameOf(data.me ?? "")}: pick again
      </button>

      <h2>Categories</h2>
      <p>{trip.categories.join(", ")}</p>
      <div className="inline-form">
        <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Add category" />
        <button
          disabled={!newCat.trim() || trip.categories.includes(newCat.trim())}
          onClick={() => {
            store.updateTrip(trip.code, { categories: [...trip.categories, newCat.trim()] });
            setNewCat("");
          }}
        >
          Add
        </button>
      </div>

      <FixedRates data={data} trip={trip} />

      <h2>Home currency</h2>
      {hasExpenses ? (
        <p>
          {trip.baseCurrency} <small className="muted">(locked once foreign-currency expenses exist, since their rates are stored against it)</small>
        </p>
      ) : (
        <select value={trip.baseCurrency} onChange={(e) => store.updateTrip(trip.code, { baseCurrency: e.target.value })}>
          {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      )}
    </>
  );
}

function FixedRates({ data, trip }: { data: TripData; trip: Trip }) {
  const store = useStore();
  const base = trip.baseCurrency;
  const fixed = trip.fixedRates ?? {};
  const used = new Set([...Object.keys(fixed), ...data.expenses.map((e) => e.currency)]);
  used.delete(base);
  const [adding, setAdding] = useState("");
  const list = [...used, ...(adding && !used.has(adding) ? [adding] : [])].sort();
  const market = (c: string) => {
    const r = trip.sharedRates?.rates[c];
    return r ? 1 / r : undefined;
  };

  function set(c: string, value: string) {
    const v = Number(value.replace(",", "."));
    const next = { ...fixed };
    if (v > 0) next[c] = v;
    else delete next[c];
    store.updateTrip(trip.code, { fixedRates: next });
  }

  return (
    <>
      <h2>Exchange rates</h2>
      <p className="muted small">
        By default each expense uses the official rate for its date (shared between your phones, so it works
        offline too). To keep it simple, you can instead agree one fixed rate per currency for the whole trip.
        It applies to expenses added after you set it; existing ones keep their rate.
        {trip.sharedRates && ` Latest official rates: ${trip.sharedRates.date}.`}
      </p>
      {list.map((c) => (
        <label key={c} className="part">
          <span>1 {c} = ? {base}</span>
          <input
            key={fixed[c] ?? "none"}
            inputMode="decimal"
            defaultValue={fixed[c] ? String(fixed[c]) : ""}
            placeholder={market(c) ? `${market(c)!.toPrecision(5)} (official)` : "official rate"}
            onBlur={(e) => set(c, e.target.value)}
          />
        </label>
      ))}
      <div className="inline-form">
        <select value="" onChange={(e) => setAdding(e.target.value)} aria-label="Add a fixed rate for">
          <option value="">Add a currency…</option>
          {CURRENCIES.filter((c) => c !== base && !list.includes(c)).map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
    </>
  );
}
