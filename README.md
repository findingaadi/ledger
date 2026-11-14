# Ledger

A personal budgeting app for Monzo accounts. Each pay cycle is a book on a shelf: when salary lands, every pound is assigned to an envelope, and spending is tracked automatically from Monzo.

- **App:** Expo (React Native) for Android, iOS and web, in `src/`
- **Backend:** Supabase (accounts, database, server functions), in `supabase/` once added
- **Design reference:** `design/mockup/index.html` (open in a browser)

## Running it

```bash
npm install
npm run web        # browser
npm start          # scan the QR code with Expo Go on a phone
```

Checks before every commit: `npm run typecheck` and `npm run lint`.

## How we work

1. One small step per branch, named `step-N-short-name`.
2. Build it, test it, then merge into `main`. `main` always runs.
3. Commit messages say what changed and why.

## Secrets

- Real values live only in `.env` (gitignored) and in Supabase function secrets.
- `.env.example` lists the variable names with no values.
- The Monzo client secret and tokens never go in the app, only in server functions.
- A pre-commit hook in `.githooks/` blocks env files and credential-looking strings. `npm install` enables it.

## Build order

| Step | What | Done when |
|---|---|---|
| 0 | Project foundation | App runs, secret guard works |
| 1 | Connect Monzo | Log in on the phone and see your account name |
| 2 | Sync transactions | Full history stored, new ones arrive on refresh |
| 3 | Envelopes and rules | Every transaction lands in an envelope |
| 4 | Pay cycles and payday | Salary detected, every pound assigned |
| 5 | Dashboard | Left-per-envelope and guilt-free are correct |
| 6 | Bookshelf interface | Shelf, book opening, realistic page turn |
| 7 | Share with family | Android build installed on a second phone |
