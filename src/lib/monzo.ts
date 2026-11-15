import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase";

const NONCE_KEY = "ledger.login_nonce";
const fn = (name: string) => `${SUPABASE_URL}/functions/v1/${name}`;

export type MonzoStatus = {
  connected?: boolean;
  approved?: boolean;
  accounts?: { id: string; type: string; name: string }[];
  error?: string;
};

/**
 * Where the browser should send the user after login. In Expo Go the app's own
 * scheme (ledger://) isn't registered on the phone, so use the exp:// address
 * of the dev server that Expo Go does handle.
 */
function appReturnUrl() {
  const host = Constants.expoGoConfig ? Constants.expoConfig?.hostUri : null;
  return host ? `exp://${host}/--/auth` : Linking.createURL("auth");
}

/** Sends the user to Monzo to log in. They come back through completeLogin. */
export async function startLogin() {
  const nonce = Crypto.randomUUID();
  await AsyncStorage.setItem(NONCE_KEY, nonce);
  const returnTo = appReturnUrl();
  const url = `${fn("monzo-start")}?${new URLSearchParams({ nonce, return_to: returnTo })}`;
  if (Platform.OS === "web") {
    window.location.assign(url);
    return;
  }
  const result = await WebBrowser.openAuthSessionAsync(url, returnTo);
  if (result.type === "success") await completeLogin(result.url);
}

/** Turns the URL Monzo login returned to into a signed-in session. Safe to call twice. */
export async function completeLogin(url: string) {
  // The web app gets its values after "#"; the phone app gets them after "?", which survives a deep link.
  const params = new URLSearchParams(url.split("#")[1] ?? url.split("?")[1] ?? "");
  const expected = await AsyncStorage.getItem(NONCE_KEY);
  if (!expected || !params.get("nonce")) return;
  if (params.get("nonce") !== expected) throw new Error("This login didn't start on this device. Try again.");
  await AsyncStorage.removeItem(NONCE_KEY);
  const error = params.get("error");
  if (error) throw new Error(error);
  const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: params.get("token_hash") ?? "", type: "email" });
  if (otpError) throw new Error("Couldn't sign you in. Try again.");
}

async function call(name: string) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  const res = await fetch(fn(name), {
    method: "POST",
    headers: { authorization: `Bearer ${data.session.access_token}`, apikey: SUPABASE_ANON_KEY },
  });
  return res.json();
}

export async function getStatus(): Promise<MonzoStatus> {
  return (await call("monzo-status")) ?? { connected: false };
}

/** Pulls new transactions from Monzo, calling the server repeatedly until it has caught up. */
export async function syncTransactions(onProgress?: (savedSoFar: number) => void) {
  let total = 0;
  for (;;) {
    const r: { done?: boolean; saved?: number; error?: string } | null = await call("monzo-sync");
    if (!r || r.error) throw new Error(r?.error ?? "Not signed in");
    total += r.saved ?? 0;
    onProgress?.(total);
    if (r.done) return total;
  }
}
