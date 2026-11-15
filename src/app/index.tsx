import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { AppState, View } from "react-native";

import { Locker, type LockerPhase } from "@/components/locker";
import { Shelf } from "@/components/shelf";
import { getStatus, startLogin, type MonzoStatus } from "@/lib/monzo";
import { supabase } from "@/lib/supabase";

/** Home: the locked cabinet until Monzo access is approved, then the bookshelf behind it. */
export default function Index() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [status, setStatus] = useState<MonzoStatus | null>(null);
  const [error, setError] = useState("");
  const [lockerGone, setLockerGone] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // Once signed in, ask the server every few seconds until access is approved in the Monzo app.
  // Approving means leaving Ledger for the Monzo app, where a request in flight can fail, so a
  // failed check is retried, and coming back to Ledger checks straight away.
  useEffect(() => {
    if (!session) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      clearTimeout(timer);
      const s = await getStatus().catch(() => null);
      if (stop) return;
      if (s) setStatus(s);
      if (!s || s.error) timer = setTimeout(check, 5000);
      else if (s.connected && !s.approved) timer = setTimeout(check, 3000);
    };
    check();
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => {
      stop = true;
      clearTimeout(timer);
      appState.remove();
    };
  }, [session]);

  const connect = () => {
    setError("");
    startLogin().catch((e: Error) => setError(e.message));
  };
  const signOut = () => {
    setStatus(null);
    setLockerGone(false);
    supabase.auth.signOut();
  };

  const approved = Boolean(session && status?.approved);
  let phase: LockerPhase;
  if (approved) phase = "unlock";
  else if (session === undefined || (session && !status)) phase = "intro";
  else if (!session || status?.connected === false) phase = "login";
  else phase = "waiting";

  return (
    <View style={{ flex: 1, alignSelf: "stretch", backgroundColor: "#140b04" }}>
      {approved ? <Shelf onSignOut={signOut} /> : null}
      {!lockerGone ? (
        <Locker
          phase={phase}
          error={error || status?.error}
          onLogin={connect}
          onSignOut={signOut}
          onUnlocked={() => setLockerGone(true)}
        />
      ) : null}
    </View>
  );
}
