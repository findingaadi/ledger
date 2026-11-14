// Tells the signed-in app whether Monzo access has been approved, and lists accounts.
import { accessTokenFor, cors, json, userFrom } from "../_shared/monzo.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const user = await userFrom(req);
  if (!user) return json({ error: "Not signed in" }, 401);

  try {
    const token = await accessTokenFor(user.id);
    if (!token) return json({ connected: false });
    const res = await fetch("https://api.monzo.com/accounts", { headers: { authorization: `Bearer ${token}` } });
    if (res.status === 403) return json({ connected: true, approved: false });
    if (res.status === 401) return json({ connected: false });
    if (!res.ok) return json({ error: `Monzo returned ${res.status}` }, 502);
    const { accounts } = await res.json();
    return json({
      connected: true,
      approved: true,
      // deno-lint-ignore no-explicit-any
      accounts: accounts.filter((a: any) => !a.closed).map((a: any) => ({
        id: a.id,
        type: a.type,
        name: a.owners?.[0]?.preferred_name ?? a.description,
      })),
    });
  } catch (e) {
    console.error(e);
    return json({ error: "Could not reach Monzo" }, 502);
  }
});
