import { router, useLocalSearchParams } from "expo-router";
import { Text } from "react-native";

import { BookView } from "@/components/book-view";
import { paper, serif } from "@/lib/theme";
import { useCycle } from "@/lib/use-cycle";

/** One pay cycle, opened as a book. */
export default function CyclePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useCycle(id);
  if (!state) return <Text style={{ flex: 1, padding: 48, textAlign: "center", fontFamily: serif, color: paper.faint, backgroundColor: paper.bg }}>Opening…</Text>;
  return <BookView state={state} onClose={() => (router.canGoBack() ? router.back() : router.replace("/"))} />;
}
