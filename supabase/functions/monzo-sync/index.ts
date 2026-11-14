// Copies Monzo transactions into the database. Does a bounded amount of work
// per call and reports done:false when the app should call again.
import { accessTokenFor, admin, cors, json, userFrom } from "../_shared/monzo.ts";

const PAGE = 100;
const MAX_PAGES_PER_CALL = 15;
const DAY = 86_400_000;
const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

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
    const live = (await accRes.json()).accounts.filter((a: Tx) => !a.closed);
    await admin.from("accounts").upsert(
      live.map((a: Tx) => ({ id: a.id, user_id: user.id, type: a.type, name: a.owners?.[0]?.preferred_name ?? a.description })),
    );
    const { data: accounts } = await admin.from("accounts").select("*").eq("user_id", user.id)
      .in("id", live.map((a: Tx) => a.id));

    let pages = 0, saved = 0, done = true;
    for (const acc of accounts ?? []) {
      // First sync: walk forward from the beginning. Later syncs: re-read the last
      // 30 days so settlements and category changes on recent transactions are picked up.
      let since: string = acc.backfilled ? iso(30 * DAY) : acc.backfill_cursor ?? "2015-01-01T00:00:00Z";
      let fullHistory: boolean = acc.backfilled || acc.backfill_cursor ? acc.full_history : true;
      let fellBack = false;
      let finished = false;

      while (pages < MAX_PAGES_PER_CALL) {
        const q = new URLSearchParams({ account_id: acc.id, limit: String(PAGE), since });
        let res = await monzo(`/transactions?${q}&expand[]=merchant`);
        if (res.status === 403 && !acc.backfilled && !fellBack) {
          // More than five minutes since login: Monzo now only allows the last 90 days.
          fellBack = true;
          fullHistory = false;
          since = iso(89 * DAY);
          q.set("since", since);
          res = await monzo(`/transactions?${q}&expand[]=merchant`);
        }
        if (!res.ok) throw new Error(`Monzo transactions returned ${res.status}`);
        pages++;
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
          since = txs[txs.length - 1].id;
          if (!acc.backfilled) {
            await admin.from("accounts").update({ backfill_cursor: since, full_history: fullHistory }).eq("id", acc.id);
          }
        }
        if (txs.length < PAGE) {
          finished = true;
          break;
        }
      }

      if (finished) {
        await admin.from("accounts")
          .update({ backfilled: true, backfill_cursor: null, full_history: fullHistory, synced_at: new Date().toISOString() })
          .eq("id", acc.id);
      } else {
        done = false;
        break;
      }
    }
    return json({ done, saved });
  } catch (e) {
    console.error(e);
    return json({ error: "Sync failed" }, 502);
  }
});
