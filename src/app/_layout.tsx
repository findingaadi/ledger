import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Ledger", headerShown: false }} />
      <Stack.Screen name="envelopes" options={{ title: "Envelopes" }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
    </Stack>
  );
}
