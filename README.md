# Trip Splitter

Shared trip expense tracker: log expenses, split them several ways, see balances
across currencies, settle up. Installable on phones (PWA) and works offline;
syncs between phones through Firebase Firestore when online.

## One-time setup

1. **Firebase** (project `trip-bill-splitter`, config in `src/firebase-config.ts`):
   - Build → Authentication → Get started → Sign-in method → enable **Anonymous**.
   - Build → Firestore Database → Create database (production mode, any region).
   - Firestore → Rules → replace with the contents of `firestore.rules` → Publish.
2. **GitHub Pages**: rename the repo first if you want (Settings → General), then
   Settings → Pages → Source: **GitHub Actions**. Every push to `main` deploys to
   `https://<user>.github.io/<repo>/`.
3. **Each phone**: open the URL once while online.
   - iPhone: Safari → Share → Add to Home Screen.
   - Android: Chrome → menu → Install app.
   Then open the *installed* app, create a trip (or **Join with code**), and pick your name.
   Test with airplane mode on.

## How it works

- No accounts: each device gets an anonymous Firebase identity on first launch
  (needs internet once). The 10-character trip code is the invite; anyone with it
  can read and edit that trip.
- Every expense records who added it and who last edited it. Deletes are soft
  (toggle "Deleted" in the list to see and restore them).
- Amounts are stored in the original currency. Each expense stores the rate to the
  trip's home currency: the ECB rate for that date (via frankfurter.dev), a fixed
  trip rate if you set one under Trip → Exchange rates, or your own rate on the
  expense. Entered offline with no rate known? It's marked pending and filled in
  when a phone is next online.
- Receipt scanning: "Scan receipt" on the expense form reads the photo on the
  phone (Tesseract, works offline) and pre-fills total, currency, date and shop.
  Optionally paste an Anthropic API key under Trip → Receipt scanning to have
  Claude read receipts when online (better accuracy, line items into notes).
  The key is stored only in that phone's browser storage, never in the repo or
  Firebase.
- Receipt photos: scanned photos (or ones added with "Add photo") are compressed
  to roughly 1000 px / under 250 KB and stored in Firestore next to the expense,
  so both phones can view them; they sync like everything else. After pulling
  this change, re-publish `firestore.rules` in the Firebase console (it adds the
  `receipts` collection).
- Balances tab: who owes whom (fewest transfers), net per person, raw per-currency
  balances, spending by category, CSV export.

## Development

```sh
npm install
npm test        # unit tests for splitting, rounding, balances, settle-up
npm run dev     # http://localhost:5173  (append ?local to skip Firebase)
npm run build
```
