import { useEffect, useMemo, useRef, useState } from "react";
import { CURRENCIES, go, hashQuery, useStore } from "../app-context";
import { describeClaudeError, getApiKey, parseReceiptWithClaude } from "../lib/claude-receipt";
import { rateToBase, todayIso, type RateResult } from "../lib/fx";
import { compressForStorage, prepareImage, recognizeText } from "../lib/ocr";
import { parseReceipt } from "../lib/receipt";
import { randomId } from "../lib/ids";
import { currencyDecimals, formatMoney, minorToInput, owedShares, parseAmount, validateSplit } from "../lib/money";
import type { Expense, ReceiptPhoto, SplitMode, Trip } from "../lib/types";
import { useTrip } from "./useTrip";

interface Props {
  code: string;
  expenseId?: string;
  settlement?: boolean;
}

export function ExpenseForm({ code, expenseId, settlement }: Props) {
  const { trip, expenses, me, nameOf } = useTrip(code);
  const existing = expenseId ? expenses.find((e) => e.id === expenseId) : undefined;
  if (!trip || !me || (expenseId && !existing)) return <main className="page muted">Loading…</main>;
  const isSettlement = settlement || existing?.isSettlement;
  return <Form key={existing?.id ?? "new"} trip={trip} me={me} existing={existing} isSettlement={!!isSettlement} nameOf={nameOf} />;
}

function Form({ trip, me, existing, isSettlement, nameOf }: {
  trip: Trip;
  me: string;
  existing?: Expense;
  isSettlement: boolean;
  nameOf: (id: string) => string;
}) {
  const store = useStore();
  const q = hashQuery();
  const base = trip.baseCurrency;
  const ids = trip.people.map((p) => p.id);
  const lastCurKey = `lastCurrency:${trip.code}`;

  const init = useMemo(() => {
    const e = existing;
    const cur = e?.currency ?? q.get("currency") ?? localStorage.getItem(lastCurKey) ?? base;
    const owed = e ? owedShares(e) : {};
    const mode: SplitMode = e?.split.mode ?? "equal";
    const parts: Record<string, string> = {};
    for (const id of ids) {
      const v = e?.split.parts[id];
      parts[id] = v == null ? "" : mode === "exact" ? minorToInput(v, cur) : String(v);
    }
    const paid: Record<string, string> = {};
    for (const id of ids) paid[id] = e?.paidBy[id] ? minorToInput(e.paidBy[id], cur) : "";
    const payers = Object.keys(e?.paidBy ?? {}).filter((k) => e!.paidBy[k]);
    return {
      amount: e ? minorToInput(e.amountMinor, cur) : q.get("amount") ? minorToInput(Number(q.get("amount")), cur) : "",
      currency: cur,
      description: e?.description ?? "",
      category: e?.category ?? (isSettlement ? "Settlement" : ""),
      date: e?.date ?? todayIso(),
      notes: e?.notes ?? "",
      payer: payers[0] ?? q.get("from") ?? me,
      multiPay: payers.length > 1,
      paid,
      mode,
      included: Object.fromEntries(ids.map((id) => [id, e ? !!owed[id] : true])) as Record<string, boolean>,
      parts,
      to: (e && Object.keys(e.split.parts)[0]) ?? q.get("to") ?? ids.find((i) => i !== me) ?? me,
      manualRate: e?.rateSource === "manual" && e.rateToBase ? String(e.rateToBase) : "",
    };
  }, []);

  const [amount, setAmount] = useState(init.amount);
  const [currency, setCurrency] = useState(init.currency);
  const [description, setDescription] = useState(init.description);
  const [category, setCategory] = useState(init.category);
  const [date, setDate] = useState(init.date);
  const [notes, setNotes] = useState(init.notes);
  const [payer, setPayer] = useState(init.payer);
  const [multiPay, setMultiPay] = useState(init.multiPay);
  const [paid, setPaid] = useState(init.paid);
  const [mode, setMode] = useState<SplitMode>(init.mode);
  const [included, setIncluded] = useState(init.included);
  const [parts, setParts] = useState(init.parts);
  const [to, setTo] = useState(init.to);
  const [manualRate, setManualRate] = useState(init.manualRate);
  const [useManual, setUseManual] = useState(!!init.manualRate);
  const [rate, setRate] = useState<RateResult | null | "loading">(null);
  const [error, setError] = useState<string | null>(null);
  const [receiptText, setReceiptText] = useState(existing?.receiptText);
  const [scan, setScan] = useState<{ busy: boolean; msg: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const photoUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  function knownCurrency(c?: string | null) {
    if (!c || !/^[A-Z]{3}$/.test(c)) return undefined;
    try {
      new Intl.NumberFormat("en", { style: "currency", currency: c });
      return c;
    } catch {
      return undefined;
    }
  }

  function applyScan(f: { total?: number | null; currency?: string | null; date?: string | null; merchant?: string | null; category?: string | null }) {
    const filled: string[] = [];
    const cur = knownCurrency(f.currency) ?? currency;
    if (f.currency && cur === f.currency) {
      setCurrency(cur);
      filled.push(cur);
    }
    if (f.total && f.total > 0) {
      setAmount(minorToInput(Math.round(f.total * 10 ** currencyDecimals(cur)), cur));
      filled.push("total");
    }
    if (f.date && /^\d{4}-\d{2}-\d{2}$/.test(f.date)) {
      setDate(f.date);
      filled.push("date");
    }
    if (f.merchant && !description.trim()) {
      setDescription(f.merchant);
      filled.push("description");
    }
    const cat = f.category && trip.categories.find((c) => c.toLowerCase() === f.category!.toLowerCase());
    if (cat && !category) {
      setCategory(cat);
      filled.push("category");
    }
    return filled;
  }

  async function onReceipt(file: File) {
    setScan({ busy: true, msg: "Preparing photo…" });
    setPhoto(file);
    try {
      const img = await prepareImage(file);
      if (getApiKey() && navigator.onLine) {
        try {
          setScan({ busy: true, msg: "Reading receipt with Claude…" });
          const r = await parseReceiptWithClaude(img, { categories: trip.categories });
          const filled = applyScan(r);
          if (r.items.length) {
            const lines = r.items.map((i) => `${i.name}: ${i.amount}`).join("\n");
            setNotes((n) => (n ? `${n}\n${lines}` : lines));
          }
          setReceiptText(JSON.stringify(r).slice(0, 4000));
          setScan({ busy: false, msg: filled.length ? `Filled ${filled.join(", ")}. Check before saving.` : "Couldn't read this receipt; enter it manually." });
          return;
        } catch (e) {
          setScan({ busy: true, msg: `${describeClaudeError(e)} Trying on-device…` });
        }
      }
      const text = await recognizeText(img, (pct) => setScan({ busy: true, msg: `Reading receipt on this phone… ${pct}%` }));
      const filled = applyScan(parseReceipt(text));
      setReceiptText(text.slice(0, 4000));
      setScan({
        busy: false,
        msg: filled.length
          ? `Filled ${filled.join(", ")}. On-device reading makes mistakes: check before saving.`
          : "Couldn't find a total; enter it manually.",
      });
    } catch (e) {
      setScan({ busy: false, msg: `Scan failed: ${(e as Error).message}` });
    }
  }

  useEffect(() => {
    let live = true;
    setRate("loading");
    rateToBase(currency, base, date, trip).then((r) => live && setRate(r));
    return () => {
      live = false;
    };
  }, [currency, base, date, trip]);

  const amountMinor = parseAmount(amount, currency) ?? 0;

  function build(): Expense | string {
    if (amountMinor <= 0) return "Enter an amount";
    let paidBy: Record<string, number>;
    let split: Expense["split"];
    if (isSettlement) {
      if (payer === to) return "Pick two different people";
      paidBy = { [payer]: amountMinor };
      split = { mode: "exact", parts: { [to]: amountMinor } };
    } else {
      if (multiPay) {
        paidBy = {};
        for (const id of ids) {
          const v = parseAmount(paid[id] ?? "", currency);
          if (v) paidBy[id] = v;
        }
      } else {
        paidBy = { [payer]: amountMinor };
      }
      const p: Record<string, number> = {};
      for (const id of ids) {
        if (mode === "equal") {
          if (included[id]) p[id] = 1;
        } else if (mode === "exact") {
          const v = parseAmount(parts[id] ?? "", currency);
          if (v) p[id] = v;
        } else {
          const v = Number((parts[id] ?? "").replace(",", "."));
          if (v > 0) p[id] = v;
        }
      }
      split = { mode, parts: p };
    }
    const check = validateSplit({ amountMinor, currency, paidBy, split });
    if (!check.ok) return check.message!;

    let rateToBaseVal: number | null = null;
    let rateSource: Expense["rateSource"] = "pending";
    if (currency === base) {
      rateToBaseVal = 1;
      rateSource = "same";
    } else if (useManual) {
      const r = Number(manualRate.replace(",", "."));
      if (!(r > 0)) return "Enter a valid exchange rate";
      rateToBaseVal = r;
      rateSource = "manual";
    } else if (rate && rate !== "loading") {
      rateToBaseVal = rate.rate;
      rateSource = rate.source;
    } else if (existing && existing.currency === currency && existing.date === date && existing.rateSource !== "manual") {
      rateToBaseVal = existing.rateToBase;
      rateSource = existing.rateSource;
    }

    const now = Date.now();
    return {
      id: existing?.id ?? randomId(),
      description: isSettlement ? "Payment" : description.trim(),
      notes: notes.trim(),
      category: isSettlement ? "Settlement" : category || "Other",
      date,
      amountMinor,
      currency,
      rateToBase: rateToBaseVal,
      rateSource,
      paidBy,
      split,
      isSettlement,
      receiptText,
      hasReceipt: photo ? true : existing?.hasReceipt,
      createdBy: existing?.createdBy ?? me,
      createdAt: existing?.createdAt ?? now,
      updatedBy: me,
      updatedAt: now,
      deleted: existing?.deleted ?? false,
      deletedBy: existing?.deletedBy,
    };
  }

  async function save() {
    const e = build();
    if (typeof e === "string") {
      setError(e);
      return;
    }
    if (photo) {
      setSaving(true);
      try {
        const dataUrl = await compressForStorage(photo);
        store.saveReceipt(trip.code, { id: e.id, dataUrl, createdBy: me, createdAt: Date.now() });
      } catch (err) {
        setSaving(false);
        setError(`Couldn't save the photo: ${(err as Error).message}. Remove it or try another.`);
        return;
      }
    }
    localStorage.setItem(lastCurKey, currency);
    store.saveExpense(trip.code, e);
    go(`/trip/${trip.code}`);
  }

  function setDeleted(deleted: boolean) {
    if (!existing) return;
    store.saveExpense(trip.code, {
      ...existing,
      deleted,
      deletedBy: deleted ? me : undefined,
      updatedBy: me,
      updatedAt: Date.now(),
    });
    go(`/trip/${trip.code}`);
  }

  const sumParts = ids.reduce((a, id) => {
    if (mode === "exact") return a + (parseAmount(parts[id] ?? "", currency) ?? 0);
    return a + (Number((parts[id] ?? "").replace(",", ".")) || 0);
  }, 0);
  const sumPaid = ids.reduce((a, id) => a + (parseAmount(paid[id] ?? "", currency) ?? 0), 0);

  const rateLine = (() => {
    if (currency === base) return null;
    if (rate === "loading") return "Looking up rate…";
    if (!rate) return "No rate available offline. It will be filled in when you're online, or enter one below.";
    const conv = formatMoney(Math.round(amountMinor * rate.rate * 10 ** (currencyDecimals(base) - currencyDecimals(currency))), base);
    const src = rate.source === "fixed" ? "trip rate" : `${rate.source === "ecb" ? "ECB" : "market"} ${rate.rateDate ?? ""}`;
    return `1 ${currency} = ${rate.rate.toPrecision(5)} ${base} (${src}) · ≈ ${conv}`;
  })();

  return (
    <main className="page">
      <a href={`#/trip/${trip.code}`} className="back">‹ {trip.name}</a>
      <h1>{isSettlement ? "Record payment" : existing ? "Edit expense" : "Add expense"}</h1>
      {existing && (
        <p className="muted small">
          Added by {nameOf(existing.createdBy)} {new Date(existing.createdAt).toLocaleString()}
          {existing.updatedAt !== existing.createdAt && ` · last edited by ${nameOf(existing.updatedBy)} ${new Date(existing.updatedAt).toLocaleString()}`}
          {existing.deleted && ` · deleted by ${nameOf(existing.deletedBy ?? "")}`}
        </p>
      )}

      {!isSettlement && (
        <div className="scan">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) onReceipt(f);
            }}
          />
          <input
            ref={photoInput}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) setPhoto(f);
            }}
          />
          <button type="button" disabled={scan?.busy} onClick={() => fileInput.current?.click()}>
            {scan?.busy ? "Scanning…" : "Scan receipt"}
          </button>
          <button type="button" disabled={scan?.busy} onClick={() => photoInput.current?.click()}>
            {photo || existing?.hasReceipt ? "Replace photo" : "Add photo"}
          </button>
          {scan && <small className="muted">{scan.msg}</small>}
        </div>
      )}
      {photoUrl && (
        <div className="photo">
          <img src={photoUrl} alt="Receipt photo to be saved" />
          <button type="button" className="link" onClick={() => setPhoto(null)}>Remove photo</button>
        </div>
      )}
      {!photo && existing?.hasReceipt && (
        <div className="photo">
          <button type="button" className="link" onClick={() => setShowSaved((v) => !v)}>
            {showSaved ? "Hide receipt photo" : "View receipt photo"}
          </button>
          {showSaved && <SavedReceipt code={trip.code} id={existing.id} />}
        </div>
      )}

      <div className="amount-row">
        <input
          className="big"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-label="Amount"
          autoFocus={!existing}
        />
        <select value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="Currency">
          {[...new Set([base, currency, ...CURRENCIES])].map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      {rateLine && <p className="muted small">{rateLine}</p>}

      {isSettlement ? (
        <div className="two">
          <label>
            From
            <select value={payer} onChange={(e) => setPayer(e.target.value)}>
              {trip.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label>
            To
            <select value={to} onChange={(e) => setTo(e.target.value)}>
              {trip.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        </div>
      ) : (
        <>
          <label>
            Description
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Dinner, train, museum…" />
          </label>
          <div className="chips" role="radiogroup" aria-label="Category">
            {trip.categories.map((c) => (
              <button key={c} type="button" className={category === c ? "chip on" : "chip"} onClick={() => setCategory(c)}>
                {c}
              </button>
            ))}
          </div>

          <label>
            Paid by
            <select value={multiPay ? "__multi" : payer} onChange={(e) => {
              if (e.target.value === "__multi") setMultiPay(true);
              else {
                setMultiPay(false);
                setPayer(e.target.value);
              }
            }}>
              {trip.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value="__multi">Several people…</option>
            </select>
          </label>
          {multiPay && (
            <div className="parts">
              {trip.people.map((p) => (
                <label key={p.id} className="part">
                  <span>{p.name}</span>
                  <input inputMode="decimal" value={paid[p.id]} onChange={(e) => setPaid({ ...paid, [p.id]: e.target.value })} />
                </label>
              ))}
              <small className={sumPaid === amountMinor ? "muted" : "error"}>
                {formatMoney(sumPaid, currency)} of {formatMoney(amountMinor, currency)}
              </small>
            </div>
          )}

          <fieldset>
            <legend>Split</legend>
            <div className="seg">
              {(["equal", "shares", "percent", "exact"] as const).map((m) => (
                <button key={m} type="button" className={mode === m ? "on" : ""} onClick={() => setMode(m)}>
                  {m === "equal" ? "Equally" : m === "shares" ? "Shares" : m === "percent" ? "%" : "Amounts"}
                </button>
              ))}
            </div>
            <div className="parts">
              {trip.people.map((p) =>
                mode === "equal" ? (
                  <label key={p.id} className="part">
                    <span>{p.name}</span>
                    <input type="checkbox" checked={!!included[p.id]} onChange={(e) => setIncluded({ ...included, [p.id]: e.target.checked })} />
                  </label>
                ) : (
                  <label key={p.id} className="part">
                    <span>{p.name}</span>
                    <input
                      inputMode="decimal"
                      value={parts[p.id]}
                      placeholder={mode === "shares" ? "0" : mode === "percent" ? "0 %" : "0.00"}
                      onChange={(e) => setParts({ ...parts, [p.id]: e.target.value })}
                    />
                  </label>
                ),
              )}
              {mode === "percent" && <small className={sumParts === 100 ? "muted" : "error"}>{sumParts}% of 100%</small>}
              {mode === "exact" && (
                <small className={sumParts === amountMinor ? "muted" : "error"}>
                  {formatMoney(sumParts, currency)} of {formatMoney(amountMinor, currency)}
                </small>
              )}
            </div>
          </fieldset>
        </>
      )}

      <label>
        Date
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      {!isSettlement && (
        <label>
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </label>
      )}
      {currency !== base && (
        <label className="inline">
          <input type="checkbox" checked={useManual} onChange={(e) => setUseManual(e.target.checked)} /> Use my own exchange rate
        </label>
      )}
      {currency !== base && useManual && (
        <label>
          1 {currency} = ? {base}
          <input inputMode="decimal" value={manualRate} onChange={(e) => setManualRate(e.target.value)} />
        </label>
      )}

      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button className="primary" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save"}</button>
        {existing && !existing.deleted && <button className="danger" onClick={() => setDeleted(true)}>Delete</button>}
        {existing?.deleted && <button onClick={() => setDeleted(false)}>Restore</button>}
      </div>
    </main>
  );
}


function SavedReceipt({ code, id }: { code: string; id: string }) {
  const store = useStore();
  const [r, setR] = useState<ReceiptPhoto | null | undefined>(undefined);
  useEffect(() => store.watchReceipt(code, id, setR), [store, code, id]);
  if (r === undefined) return <p className="muted small">Loading photo…</p>;
  if (r === null) return <p className="muted small">Photo hasn't synced to this phone yet. It will appear once the phone that took it is online.</p>;
  // Rendered as a link target, so never trust anything but an inline image.
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(r.dataUrl)) return <p className="muted small">This photo can't be shown.</p>;
  return (
    <a href={r.dataUrl} target="_blank" rel="noreferrer">
      <img src={r.dataUrl} alt="Receipt" />
    </a>
  );
}
