// Copies Monzo transactions into the database. Does a bounded amount of work
// per call and reports done:false when the app should call again.
import { accessTokenFor, admin, cors, json, userFrom } from "../_shared/monzo.ts";

const PAGE = 100;
const MAX_PAGES_PER_CALL = 15;
const DAY = 86_400_000;
const WINDOW = 360 * DAY; // Monzo rejects ranges over one year (bad_request.invalid_time_range)
const iso = (ms: number) => new Date(ms).toISOString();

// deno-lint-ignore no-explicit-any
type Tx = any;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const user = await userFrom(req);
  if (!user) return json({ error: "Not signed in" }, 401);

  try {
    const token = await accessTokenFor(user.id);
    if (!token) return json({ error: "Monzo is not connected" }, 409);
    const monzo = (path: string) => fetch(`https://api.monzo.com${path}`, { headers: { authorization: `Bearer ${token}` } });

    const accRes = await monzo("/accounts");
    if (!accRes.ok) return json({ error: `Monzo returned ${accRes.status}` }, 502);
    const live: Tx[] = (await accRes.json()).accounts.filter((a: Tx) => !a.closed);
    await admin.from("accounts").upsert(
      live.map((a) => ({ id: a.id, user_id: user.id, type: a.type, name: a.owners?.[0]?.preferred_name ?? a.description })),
    );
    const { data: accounts } = await admin.from("accounts").select("*").eq("user_id", user.id).in("id", live.map((a) => a.id));

    const now = Date.now();
    let pages = 0, saved = 0, done = true;
    const skipped: string[] = [];

    accountLoop: for (const acc of accounts ?? []) {
      // Later syncs re-read the last 30 days so settlements and category changes are picked up.
      // The first sync walks forward from when the account was opened, one window at a time.
      const opened = new Date(live.find((a) => a.id === acc.id)?.created ?? "2015-01-01T00:00:00Z").getTime();
      let from = acc.backfilled ? now - 30 * DAY : acc.backfill_from ? new Date(acc.backfill_from).getTime() : opened;
      let cursor: string | null = acc.backfilled ? null : acc.backfill_cursor;
      let fullHistory: boolean = acc.backfilled || acc.backfill_from ? acc.full_history : true;

      for (;;) {
        if (pages >= MAX_PAGES_PER_CALL) {
          done = false;
          break accountLoop;
        }
        const to = Math.min(from + WINDOW, now);
        const q = new URLSearchParams({ account_id: acc.id, limit: String(PAGE), since: cursor ?? iso(from) });
        if (to < now) q.set("before", iso(to));
        const res = await monzo(`/transactions?${q}&expand[]=merchant`);
        pages++;

        if (res.status === 403 && !acc.backfilled && fullHistory) {
          // More than five minutes since login: Monzo now only allows the last 90 days.
          fullHistory = false;
          from = now - 89 * DAY;
          cursor = null;
          continue;
        }
        if (!res.ok) {
          // Don't let one account block the others.
          console.error(`${acc.type}: skipped (${res.status}) ${await res.text()}`);
          skipped.push(acc.type);
          continue accountLoop;
        }

        const txs: Tx[] = (await res.json()).transactions;
        if (txs.length) {
          const { error } = await admin.from("transactions").upsert(txs.map((t) => ({
            id: t.id,
            user_id: user.id,
            account_id: acc.id,
            amount: t.amount,
            currency: t.currency,
            created: t.created,
            settled: t.settled || null,
            description: t.description,
            merchant_name: t.merchant?.name ?? null,
            category: t.category,
            declined: Boolean(t.decline_reason),
            raw: t,
          })));
          if (error) throw error;
          saved += txs.length;
        }

        if (txs.length === PAGE) {
          cursor = txs[txs.length - 1].id; // more in this window
        } else if (to < now) {
          from = to; // window finished, move to the next
          cursor = null;
        } else {
          await admin.from("accounts")
            .update({ backfilled: true, backfill_cursor: null, backfill_from: null, full_history: fullHistory, synced_at: iso(now) })
            .eq("id", acc.id);
          break;
        }
        if (!acc.backfilled) {
          await admin.from("accounts")
            .update({ backfill_from: iso(from), backfill_cursor: cursor, full_history: fullHistory })
            .eq("id", acc.id);
        }
      }
    }
    if (done) {
      await admin.rpc("seed_defaults", { p_user: user.id });
      const { error } = await admin.rpc("classify_transactions", { p_user: user.id });
      if (error) throw error;
    }
    return json({ done, saved, skipped });
  } catch (e) {
    console.error(e);
    return json({ error: "Sync failed" }, 502);
  }
});
