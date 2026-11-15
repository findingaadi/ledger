import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Home } from "@/components/home";
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
  useEffect(() => {
    if (!session) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      const s = await getStatus().catch(() => ({ error: "Couldn't reach the server" }) as MonzoStatus);
      if (stop) return;
      setStatus(s);
      if (s.connected && !s.approved && !s.error) timer = setTimeout(check, 3000);
    };
    check();
    return () => {
      stop = true;
      clearTimeout(timer);
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
  } else if (!status?.approved) {
    body = (
      <>
        <ActivityIndicator />
        <Text style={styles.center}>Open your Monzo app and approve access for Ledger.</Text>
      </>
    );
  } else {
    body = (
      <>
        <Text>Connected to Monzo</Text>
        <Home />
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
