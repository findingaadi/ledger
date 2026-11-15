import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from "react-native";

import { Shelf } from "@/components/shelf";
import { getStatus, startLogin, type MonzoStatus } from "@/lib/monzo";
import { supabase } from "@/lib/supabase";

export default function Index() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [status, setStatus] = useState<MonzoStatus | null>(null);
  const [error, setError] = useState("");

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
    supabase.auth.signOut();
  };

  if (session && status?.approved) return <Shelf onSignOut={signOut} />;

  let body;
  if (session === undefined || (session && !status)) {
    body = <ActivityIndicator />;
  } else if (!session || status?.connected === false) {
    body = (
      <>
        <Text>Monzo is not connected yet.</Text>
        <Pressable style={styles.button} onPress={connect}>
          <Text style={styles.buttonText}>Connect Monzo</Text>
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </>
    );
  } else if (status?.error) {
    body = <Text style={styles.error}>{status.error}</Text>;
  } else {
    body = (
      <>
        <ActivityIndicator />
        <Text style={styles.center}>Open your Monzo app and approve access for Ledger.</Text>
      </>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ledger</Text>
      {body}
      {session ? (
        <Pressable onPress={signOut}>
          <Text style={styles.link}>Sign out</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", gap: 12, padding: 24, paddingTop: 48 },
  title: { fontSize: 28, fontWeight: "bold" },
  center: { textAlign: "center" },
  button: { backgroundColor: "#14233c", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  buttonText: { color: "#fff", fontWeight: "600" },
  link: { color: "#185fa5" },
  error: { color: "#a12a22", textAlign: "center" },
});
