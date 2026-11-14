import { createClient } from "npm:@supabase/supabase-js@2";

export const env = (k: string) => {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`Missing secret ${k}`);
  return v;
};

export const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

/** The signed-in Ledger user making this request, or null. */
export async function userFrom(req: Request) {
  const jwt = req.headers.get("authorization")?.replace(/^Bearer /i, "") ?? "";
  const { data } = await admin.auth.getUser(jwt);
  return data.user;
}

const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const key = () =>
  crypto.subtle.importKey("raw", unb64(env("TOKEN_ENCRYPTION_KEY")), "AES-GCM", false, ["encrypt", "decrypt"]);

export async function encrypt(plain: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), new TextEncoder().encode(plain));
  return `${b64(iv)}.${b64(new Uint8Array(ct))}`;
}

export async function decrypt(stored: string) {
  const [iv, ct] = stored.split(".").map(unb64);
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await key(), ct));
}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number; user_id: string };

export async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://api.monzo.com/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: env("MONZO_CLIENT_ID"),
      client_secret: env("MONZO_CLIENT_SECRET"),
      ...params,
    }),
  });
  if (!res.ok) throw new Error(`Monzo token request failed (${res.status})`);
  return res.json();
}

export async function saveTokens(userId: string, t: TokenResponse) {
  const { error } = await admin.from("monzo_connections").upsert({
    user_id: userId,
    monzo_user_id: t.user_id,
    access_token: await encrypt(t.access_token),
    refresh_token: t.refresh_token ? await encrypt(t.refresh_token) : null,
    expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/** A usable Monzo access token for this user, refreshed if it is about to expire. Null if not connected. */
export async function accessTokenFor(userId: string): Promise<string | null> {
  const { data } = await admin.from("monzo_connections").select("*").eq("user_id", userId).maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() - Date.now() > 60_000) return decrypt(data.access_token);
  if (!data.refresh_token) return null;
  // shortcut: two simultaneous refreshes would race (Monzo refresh tokens are single-use);
  // add a lock once background sync exists in step 2.
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: await decrypt(data.refresh_token) });
  await saveTokens(userId, t);
  return t.access_token;
}
