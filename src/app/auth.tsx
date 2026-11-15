import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Text, View } from "react-native";

import { completeLogin } from "@/lib/monzo";

/** Where the browser lands after Monzo login. Finishes sign-in, then goes home. */
export default function AuthReturn() {
  // The phone app receives the sign-in values as route params; the web app reads them from the address bar.
  const params = useLocalSearchParams<Record<string, string>>();
  const [error, setError] = useState("");

  useEffect(() => {
    const url = Platform.OS === "web" ? window.location.href : `ledger://auth?${new URLSearchParams(params)}`;
    completeLogin(url)
      .then(() => router.replace("/"))
      .catch((e: Error) => setError(e.message));
    // Run once: the values are present on first render and must not be replayed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Text>{error || "Signing you in…"}</Text>
      {error ? <Text onPress={() => router.replace("/")} style={{ marginTop: 16, color: "#185fa5" }}>Back to Ledger</Text> : null}
    </View>
  );
}
