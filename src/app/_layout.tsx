import { router, Stack } from "expo-router";
import { Text } from "react-native";
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
        // Every screen opened on top of the shelf has a way straight back to it.
        headerRight: () => (
          <Text onPress={() => (router.canDismiss() ? router.dismissAll() : router.replace("/"))} style={{ fontFamily: serif, fontWeight: "bold", color: wood.ink, paddingHorizontal: 8 }}>
            Shelf
          </Text>
        ),
      }}
    >
      <Stack.Screen name="index" options={{ title: "Ledger", headerShown: false }} />
      <Stack.Screen name="envelopes" options={{ title: "Envelopes" }} />
      <Stack.Screen name="envelope/[id]" options={{ title: "Envelope" }} />
      <Stack.Screen name="transactions" options={{ title: "All transactions" }} />
      <Stack.Screen name="cycle/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="preview-book" options={{ headerShown: false }} />
      <Stack.Screen name="preview-locker" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="preview" options={{ headerShown: false }} />
    </Stack>
    </GestureHandlerRootView>
  );
}
