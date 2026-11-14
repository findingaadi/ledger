// Step 2 of login: Monzo sends the browser back here with a code. Swap it for
// tokens, store them, and hand the app a one-time sign-in token.
import { admin, env, saveTokens, tokenRequest } from "../_shared/monzo.ts";

Deno.serve(async (req) => {
  const q = new URL(req.url).searchParams;
  const { data: st } = await admin.from("oauth_states").delete().eq("state", q.get("state") ?? "").select().maybeSingle();
  if (!st || Date.now() - new Date(st.created_at).getTime() > 10 * 60_000) {
    return new Response("This login link has expired. Go back to Ledger and try again.", { status: 400 });
  }
  const back = (params: Record<string, string>) =>
    Response.redirect(`${st.return_to}#${new URLSearchParams({ nonce: st.nonce, ...params })}`, 302);

  try {
    const code = q.get("code");
    if (!code) return back({ error: "Monzo login was cancelled" });
    const tokens = await tokenRequest({
      grant_type: "authorization_code",
      redirect_uri: env("MONZO_REDIRECT_URI"),
      code,
    });

    // One Ledger account per Monzo user; the email is a placeholder that is never mailed.
    const email = `${tokens.user_id.toLowerCase()}@monzo.ledger.invalid`;
    const { data: existing } = await admin.from("monzo_connections")
      .select("user_id").eq("monzo_user_id", tokens.user_id).maybeSingle();
    let userId = existing?.user_id;
    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
      if (error) throw error;
      userId = data.user.id;
    }
    await saveTokens(userId, tokens);

    const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (error) throw error;
    return back({ token_hash: link.properties.hashed_token });
  } catch (e) {
    console.error(e);
    return back({ error: "Could not connect to Monzo" });
  }
});
