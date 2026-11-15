import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { TransactionList } from "@/components/transaction-list";

/** Every stored transaction, newest first, with a filter for the ones still to file. */
export default function AllTransactions() {
  const [onlyUnfiled, setOnlyUnfiled] = useState(false);
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Pressable onPress={() => setOnlyUnfiled(!onlyUnfiled)}>
        <Text style={styles.link}>{onlyUnfiled ? "Show all" : "Show only those needing an envelope"}</Text>
      </Pressable>
      <TransactionList status={onlyUnfiled ? "unassigned" : undefined} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 24, gap: 8, maxWidth: 520, width: "100%", marginHorizontal: "auto" },
  link: { color: "#185fa5" },
});
