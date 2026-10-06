// Heuristic extraction from raw OCR text. Deliberately conservative: when
// unsure, leave a field empty so the user types it instead of trusting a guess.

export interface ReceiptGuess {
  total?: number; // major units, e.g. 23.5
  currency?: string;
  date?: string; // YYYY-MM-DD
  merchant?: string;
}

// Words that mean "the final total". Compared without accents, so "kopā" matches
// "kopa" and OCR that drops diacritics still works.
const TOTAL_WORDS = [
  "grand total", "total", "totale", "totaal", "totalt", "gesamt", "gesamtbetrag", "zu zahlen", "ttc",
  "a payer", "a pagar", "amount due", "balance due", "to pay", "celkem", "razem", "osszesen", "yhteensa",
  "kopa", "kopsumma", "kokku", "is viso", "ukupno", "spolu", "skupaj", "toplam", "i alt", "συνολο",
  "общо", "итого", "合計", "합계",
];
// Words that are often the bill *before* service or tip, so only used when no
// explicit total word is found (e.g. Latvian SUMMA → service → KOPĀ).
const SUM_WORDS = ["summe", "summa", "suma", "sum", "betrag", "montant", "importe"];
const NOT_TOTAL_WORDS = [
  "subtotal", "sub total", "sub-total", "zwischensumme", "sous-total", "subtotale", "tax", "vat", "mwst",
  "ust", "iva", "tva", "btw", "dph", "pvn", "change", "cash", "tendered", "ruckgeld", "wechselgeld", "rendu",
  "cambio", "tip", "trinkgeld", "pourboire", "tejas nauda", "dzeramnauda", "card", "karte", "visa",
  "mastercard", "given", "gegeben",
];

function fold(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

const SYMBOLS: [RegExp, string][] = [
  [/€|\bEUR\b|\bEURO\b/i, "EUR"],
  [/£|\bGBP\b/i, "GBP"],
  [/\bCHF\b|\bFr\.\s/i, "CHF"],
  [/\bKč\b|\bCZK\b/i, "CZK"],
  [/\bzł\b|\bPLN\b/i, "PLN"],
  [/\bFt\b|\bHUF\b/i, "HUF"],
  [/\bDKK\b|\bkr\.\s/i, "DKK"],
  [/\bSEK\b/i, "SEK"],
  [/\bNOK\b/i, "NOK"],
  [/\bJPY\b|円/i, "JPY"],
  [/\bKRW\b|₩/i, "KRW"],
  [/\bTHB\b|฿/i, "THB"],
  [/\bTRY\b|₺/i, "TRY"],
  [/\bINR\b|₹/i, "INR"],
  [/\bUSD\b|US\$/i, "USD"],
  [/\bCAD\b|C\$/i, "CAD"],
  [/\bAUD\b|A\$/i, "AUD"],
];

/** Parse "1.234,56", "1,234.56", "12,50", "12.50", "1500" into a number. */
export function parseNumberToken(tok: string): number | null {
  let s = tok.replace(/[\s']/g, "");
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const lastSep = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
  if (lastSep >= 0 && s.length - lastSep - 1 === 2) {
    s = s.slice(0, lastSep).replace(/[.,]/g, "") + "." + s.slice(lastSep + 1);
  } else {
    s = s.replace(/[.,]/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function numbersIn(line: string): number[] {
  // Amounts with optional thousands groups; keep decimals so 12,50 isn't read as 1250.
  const re = /\d{1,3}(?:[.,' ]\d{3})*(?:[.,]\d{2})(?!\d)|\d+(?:[.,]\d{2})(?!\d)|\d+/g;
  const out: number[] = [];
  for (const m of line.match(re) ?? []) {
    const n = parseNumberToken(m);
    if (n != null) out.push(n);
  }
  return out;
}

function hasDecimals(line: string) {
  return /\d[.,]\d{2}(?!\d)/.test(line);
}

function findTotal(lines: string[]): number | undefined {
  const lower = lines.map(fold);
  const amountNear = (i: number): number | undefined => {
    // The amount is usually on the same line, sometimes on the next one.
    for (const src of [lines[i], lines[i + 1] ?? ""]) {
      if (!hasDecimals(src)) continue;
      const nums = numbersIn(src);
      if (nums.length) return nums[nums.length - 1];
    }
    return undefined;
  };
  const tier = (words: string[]) => {
    const found: number[] = [];
    lower.forEach((l, i) => {
      if (!words.some((w) => l.includes(w)) || NOT_TOTAL_WORDS.some((w) => l.includes(w))) return;
      const n = amountNear(i);
      if (n != null) found.push(n);
    });
    return found;
  };
  let candidates = tier(TOTAL_WORDS);
  if (!candidates.length) {
    // A "sum" line may be the bill before service/tip. If a later amount equals
    // the sum plus the amounts in between (111.00 + 11.10 = 122.10), that later
    // amount is the real total even when OCR garbled its label.
    lower.forEach((l, i) => {
      if (!SUM_WORDS.some((w) => l.includes(w)) || NOT_TOTAL_WORDS.some((w) => l.includes(w))) return;
      const s = amountNear(i);
      if (s == null) return;
      let running = s;
      let total = s;
      for (let j = i + 1; j < Math.min(lines.length, i + 9); j++) {
        if (!hasDecimals(lines[j])) continue;
        const nums = numbersIn(lines[j]);
        const a = nums[nums.length - 1];
        if (a > s && Math.abs(a - running) < 0.011) total = a;
        running += a;
      }
      candidates.push(total);
    });
  }
  if (candidates.length) return Math.max(...candidates);
  // Fallback: largest decimal amount on a line that isn't payment/change/tax.
  const all: number[] = [];
  lower.forEach((l, i) => {
    if (NOT_TOTAL_WORDS.some((w) => l.includes(w)) || !hasDecimals(lines[i])) return;
    all.push(...numbersIn(lines[i]).filter((n) => n % 1 !== 0 || /[.,]00/.test(lines[i])));
  });
  return all.length ? Math.max(...all) : undefined;
}

function findCurrency(text: string): string | undefined {
  for (const [re, code] of SYMBOLS) if (re.test(text)) return code;
  return undefined;
}

function iso(y: number, m: number, d: number): string | undefined {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return undefined;
  return dt.toISOString().slice(0, 10);
}

/** Dates are only accepted within the last 60 days, so a misread doesn't land in another year. */
export function findDate(text: string, today = new Date()): string | undefined {
  const ok = (s?: string) => {
    if (!s) return false;
    const diff = (today.getTime() - new Date(s + "T12:00:00Z").getTime()) / 86400000;
    return diff > -2 && diff < 60;
  };
  for (const m of text.matchAll(/\b(20\d{2})[-./](\d{1,2})[-./](\d{1,2})\b/g)) {
    const d = iso(+m[1], +m[2], +m[3]);
    if (ok(d)) return d;
  }
  for (const m of text.matchAll(/\b(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})\b/g)) {
    const a = +m[1];
    const b = +m[2];
    const y = +m[3];
    // Day-first unless that's impossible; try both and keep whichever is plausible.
    for (const d of [iso(y, b, a), iso(y, a, b)]) if (ok(d)) return d;
  }
  return undefined;
}

function findMerchant(lines: string[]): string | undefined {
  for (const l of lines.slice(0, 6)) {
    const t = l.trim();
    const letters = (t.match(/\p{L}/gu) ?? []).length;
    if (letters >= 3 && letters / t.length > 0.6 && t.length <= 40) return t;
  }
  return undefined;
}

export function parseReceipt(text: string, today = new Date()): ReceiptGuess {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return {
    total: findTotal(lines),
    currency: findCurrency(text),
    date: findDate(text, today),
    merchant: findMerchant(lines),
  };
}
