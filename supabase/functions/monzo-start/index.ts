// Step 1 of login: remember who asked, then send the browser to Monzo.
import { admin, env } from "../_shared/monzo.ts";

Deno.serve(async (req) => {
  const q = new URL(req.url).searchParams;
  const nonce = q.get("nonce") ?? "";
  const returnTo = q.get("return_to") ?? "";
  const allowed = env("APP_RETURN_PREFIXES").split(",").some((p) => p && returnTo.startsWith(p.trim()));
  if (nonce.length < 16 || !allowed) return new Response("Bad login request", { status: 400 });

  const state = crypto.randomUUID() + crypto.randomUUID();
  const { error } = await admin.from("oauth_states").insert({ state, nonce, return_to: returnTo });
  if (error) return new Response("Could not start login", { status: 500 });

  const url = new URL("https://auth.monzo.com/");
  url.search = new URLSearchParams({
    client_id: env("MONZO_CLIENT_ID"),
    redirect_uri: env("MONZO_REDIRECT_URI"),
    response_type: "code",
    state,
  }).toString();
  return Response.redirect(url.toString(), 302);
});
