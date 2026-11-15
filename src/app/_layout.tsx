import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { paper, serif, wood } from "@/lib/theme";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: wood.bar[1] },
        headerTintColor: wood.ink,
        headerTitleStyle: { fontFamily: serif, fontWeight: "bold" },
        contentStyle: { backgroundColor: paper.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Kharcha", headerShown: false }} />
      <Stack.Screen name="envelopes" options={{ title: "Envelopes" }} />
      <Stack.Screen name="envelope/[id]" options={{ title: "Envelope" }} />
      <Stack.Screen name="transactions" options={{ title: "Transactions" }} />
      <Stack.Screen name="cycle/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="preview-book" options={{ headerShown: false }} />
      <Stack.Screen name="preview-locker" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="preview" options={{ headerShown: false }} />
    </Stack>
    </GestureHandlerRootView>
  );
}
