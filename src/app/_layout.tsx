import { Stack } from "expo-router";

import { paper, serif, wood } from "@/lib/theme";

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: wood.bar[1] },
        headerTintColor: wood.ink,
        headerTitleStyle: { fontFamily: serif, fontWeight: "bold" },
        contentStyle: { backgroundColor: paper.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Ledger", headerShown: false }} />
      <Stack.Screen name="envelopes" options={{ title: "Envelopes" }} />
      <Stack.Screen name="envelope/[id]" options={{ title: "Envelope" }} />
      <Stack.Screen name="transactions" options={{ title: "All transactions" }} />
      <Stack.Screen name="cycle/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="preview-book" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="preview" options={{ headerShown: false }} />
    </Stack>
  );
}
