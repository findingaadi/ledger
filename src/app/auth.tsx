import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { completeLogin } from "@/lib/monzo";

/** Where the browser lands after Monzo login. Finishes sign-in, then goes home. */
export default function AuthReturn() {
  const url = Linking.useURL();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!url) return;
    completeLogin(url)
      .then(() => router.replace("/"))
      .catch((e: Error) => setError(e.message));
  }, [url]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Text>{error || "Signing you in…"}</Text>
      {error ? <Text onPress={() => router.replace("/")} style={{ marginTop: 16, color: "#185fa5" }}>Back to Ledger</Text> : null}
    </View>
  );
}
