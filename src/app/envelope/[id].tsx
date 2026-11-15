import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";

import { TransactionList } from "@/components/transaction-list";
import { supabase } from "@/lib/supabase";

/** One envelope's transactions. Tap any of them to move it somewhere else. */
export default function EnvelopeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [name, setName] = useState("Envelope");

  useEffect(() => {
    supabase.from("envelopes").select("name").eq("id", id).maybeSingle().then(({ data }) => data && setName(data.name));
  }, [id]);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: name }} />
      <Text style={styles.note}>Most recent first. Tap a transaction to move it to a different envelope.</Text>
      <TransactionList envelopeId={id} empty="Nothing has been filed here yet." />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 24, gap: 8, maxWidth: 520, width: "100%", marginHorizontal: "auto" },
  note: { color: "#666" },
});
