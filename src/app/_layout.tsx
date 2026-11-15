import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Ledger", headerShown: false }} />
      <Stack.Screen name="envelopes" options={{ title: "Envelopes" }} />
      <Stack.Screen name="envelope/[id]" options={{ title: "Envelope" }} />
      <Stack.Screen name="transactions" options={{ title: "All transactions" }} />
      <Stack.Screen name="cycle/[id]" options={{ title: "Pay cycle" }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
    </Stack>
  );
}
