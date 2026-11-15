# Ledger

A personal budgeting app for people who bank with Monzo. Every pay cycle is a leather-bound book on a wooden shelf. When your salary lands, you give every pound a job by assigning it to an envelope; after that, Ledger reads your Monzo transactions and tells you what is left in each envelope and how much you can spend freely.

It runs on Android, iOS and the web from one codebase. It is built for one person and a few family members, not for the public: Monzo's developer API only allows a small set of users you explicitly approve.

## What it does

- **Connects to Monzo.** You sign in with Monzo itself, so there is no separate password. Transactions sync on their own.
- **Sorts every transaction into an envelope.** Rules match a payee (your council, your energy supplier) or a Monzo category (groceries, eating out). Correct one and it remembers.
- **Knows what isn't spending.** Pot transfers, transfers between your own accounts, declined payments and purchases on Monzo Flex are never counted. Flex and credit card repayments count as bills.
- **Asks when only you can know.** Money received from a person might be income or a friend paying you back, so it always asks. So does any payee you use for more than one thing.
- **Runs on pay cycles, not calendar months.** A cycle starts when your salary arrives. On payday you tick the envelopes you need this month and assign the money until nothing is left unassigned. Whatever you save for an envelope becomes its amount next payday.
- **Shows who a bank transfer was with.** Transfers are listed by the person or company, with the payment reference underneath.
- **Shows guilt-free money.** Overspending in any envelope comes out of your guilt-free amount. If a cycle still ends short, the shortfall comes off the top of the next payday.
- **Handles what Monzo can't see.** Add side income by hand, or record a payment made from another bank against an envelope.

## How it looks

- **The locked cabinet.** Opening the app shows an antique cabinet: the doors close in, a brass lock drops into place and a "Login to Monzo" button rises. Once Monzo access is approved the key turns, the lock falls away and the doors swing open onto the shelf.
- **The shelf.** One book per pay cycle, newest first. A book glows and carries a "To do" ribbon when money is unassigned or transactions need an envelope.
- **Opening a book.** The cover lifts off the shelf, grows to fill the screen and swings open.
- **Four pages.** Drag sideways and the page bends over like paper on a phone (a hinged turn in a browser), or tap the page names in the footer. "Back to shelf" is in every footer.
  1. **To do:** money in, what is left to assign, an amount per envelope, and transactions that need an envelope.
  2. **Dashboard:** guilt-free left, and a meter for each envelope.
  3. **Transactions:** everything in the cycle. Tap one to move it.
  4. **Bills:** each regular bill, paid or due.

## Architecture

```
┌──────────────────────────┐        ┌───────────────────────────────────────┐        ┌────────────┐
│  Ledger app              │        │  Supabase                             │        │  Monzo     │
│  Expo / React Native     │──────▶ │                                       │        │            │
│  Android · iOS · web     │        │  Auth        one account per Monzo    │        │  API       │
│                          │        │              user                     │        │  (read     │
│  shelf, book, pages      │        │  Functions   monzo-start              │──────▶ │   only)    │
│  no secrets, no tokens   │ ◀───── │              monzo-callback           │        │            │
│                          │        │              monzo-status             │        │  Monzo app │
└──────────────────────────┘        │              monzo-sync               │        │  approves  │
                                    │  Postgres    transactions, envelopes, │        │  access    │
                                    │              rules, cycles, budgets   │        └────────────┘
                                    └───────────────────────────────────────┘
```

- **The app never talks to Monzo.** It talks to Supabase. Only the server functions hold the Monzo client secret and each person's tokens, and tokens are encrypted before they are stored.
- **Each person sees only their own data.** Every table has row level security, and the token table can't be read by the app at all.
- **The budgeting maths lives in the database** (`cycle_summary` and friends), so the phone and the web always agree.
- **The page curl is a shader.** When a turn starts, the page is photographed and drawn by a Skia shader that wraps it round a cylinder, so it bends, shows its back and shadows the page beneath.
- **Sync is incremental.** The first sync walks your whole history in windows of under a year, inside the few minutes after login when Monzo allows it. Later syncs re-read the last 30 days so settlements and category changes are picked up.

### Where things are

| Path | What is there |
|---|---|
| `src/app/` | Screens. Every file is a route. `preview`, `preview-book` and `preview-locker` are development-only pages with sample data. |
| `src/components/` | The locker, the shelf, the open book and its pages, ledger-paper and wood building blocks, the transaction list and the envelope picker. `book-pages.native.tsx` is the paper curl used on phones; `book-pages.tsx` is the hinged turn used on the web. |
| `src/lib/` | Supabase client, Monzo login and sync calls, pay cycle loading, the `useCycle` hook, theme and formatting. |
| `supabase/functions/` | The four server functions and their shared Monzo helpers. |
| `supabase/migrations/` | The database: tables, security policies, sorting and budgeting functions. |
| `scripts/make-textures.py` | Generates the leather and wood grain images in `assets/textures/`. |
| `scripts/make-icons.py` | Draws the app icon, Android icon layers, splash image and favicon. Needs `rsvg-convert` (`brew install librsvg`). |
| `design/mockup/` | The original clickable mockup. |

## Install on an Android phone

Ledger isn't on the Play Store. You install it from an APK file.

1. On your phone, open the [Releases page](https://github.com/findingaadi/ledger/releases) and download the newest `ledger.apk`. The repository is private, so you need to be signed in to GitHub with access to it.
2. Open the downloaded file. Android will say your browser isn't allowed to install apps: tap **Settings**, turn on **Allow from this source**, and go back.
3. Tap **Install**. If Play Protect asks, choose **Install anyway**; it asks because the app didn't come from the Play Store.
4. Open Ledger, tap **Connect Monzo**, enter your Monzo email, and tap the link Monzo emails you.
5. Approve the request in your Monzo app. Ledger then syncs your history, which takes a minute or two the first time.

To update, download and install the newer APK over the top. Your data is kept on the server, so nothing is lost.

Only Monzo accounts that have been approved on the Monzo developer client can connect.

## Run it yourself

You need Node.js 24, a Supabase project and a Monzo developer client.

```bash
npm install
cp .env.example .env    # then fill in the values
npm run web             # browser
npm start               # scan the QR code with Expo Go on a phone
```

Deploy the server side with the Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push --remote
supabase secrets set --env-file .env
supabase functions deploy
```

Checks before every commit: `npm run typecheck` and `npm run lint`.

### Build the APK

Builds run on Expo's build service, so no Android tooling is needed locally.

```bash
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

The two `EXPO_PUBLIC_` values must exist as EAS environment variables for the `preview` environment, because `.env` is never uploaded.

## Secrets

- Real values live only in `.env` (gitignored), in Supabase function secrets, and in EAS environment variables.
- `.env.example` lists the variable names with no values.
- The Monzo client secret and tokens never go in the app, only in server functions.
- A pre-commit hook in `.githooks/` blocks env files and credential-looking strings. `npm install` enables it.

## How we work

1. One small step per branch.
2. Build it, test it, then merge into `main`. `main` always runs.
3. Commit messages say what changed and why.

## Known limits

- Payday is detected from Monzo's own payday flag. Someone whose employer Monzo doesn't recognise needs a "this is my salary" option, which isn't built yet.
- The login still accepts Expo Go return addresses for testing. Remove `exp://` from `APP_RETURN_PREFIXES` before sharing widely.
- In a browser the page turn is a hinged leaf, because Skia can't photograph views there.
