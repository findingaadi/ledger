import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { gbp } from "@/lib/format";
import { supabase } from "@/lib/supabase";

export type Filable = { id: string; label: string; amount: number };
export type EnvelopeOption = { id: string; name: string };

type Props = {
  tx: Filable;
  envelopes: EnvelopeOption[];
  /** False for payees that must always ask, such as a money-transfer service used for several purposes. */
  canRemember: boolean;
  onClose: (changed: boolean) => void;
};

/** Sheet for choosing where one transaction belongs. */
export function FilePicker({ tx, envelopes, canRemember, onClose }: Props) {
  const [remember, setRemember] = useState(canRemember);
  const [error, setError] = useState("");

  const file = async (treatment: "envelope" | "neutral" | "income", envelope?: string) => {
    const { error: e } = await supabase.rpc("file_transaction", {
      p_tx: tx.id,
      p_envelope: envelope ?? null,
      p_treatment: treatment,
      p_remember: remember && treatment !== "income",
    });
    if (e) return setError("Couldn't save. Try again.");
    onClose(true);
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={() => onClose(false)}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>
            {tx.label} · {gbp(tx.amount, true)}
          </Text>
          <ScrollView contentContainerStyle={styles.options}>
            {envelopes.map((e) => (
              <Pressable key={e.id} style={styles.option} onPress={() => file("envelope", e.id)}>
                <Text>{e.name}</Text>
              </Pressable>
            ))}
            <Pressable style={[styles.option, styles.other]} onPress={() => file("neutral")}>
              <Text>Not spending</Text>
            </Pressable>
            {tx.amount > 0 ? (
              <Pressable style={[styles.option, styles.other]} onPress={() => file("income")}>
                <Text>Income</Text>
              </Pressable>
            ) : null}
          </ScrollView>
          {canRemember ? (
            <Pressable style={styles.remember} onPress={() => setRemember(!remember)}>
              <Text style={styles.box}>{remember ? "☑" : "☐"}</Text>
              <Text style={styles.grow}>Always file {tx.label} this way</Text>
            </Pressable>
          ) : (
            <Text style={styles.note}>{tx.label} is used for more than one thing, so it asks every time.</Text>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable onPress={() => onClose(false)}>
            <Text style={styles.link}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 16 },
  sheet: { backgroundColor: "#fff", borderRadius: 12, padding: 20, gap: 12, width: "100%", maxWidth: 440, maxHeight: "85%" },
  title: { fontWeight: "600", fontSize: 16 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: "#999" },
  other: { borderStyle: "dashed" },
  remember: { flexDirection: "row", alignItems: "center", gap: 8 },
  box: { fontSize: 18 },
  grow: { flex: 1 },
  note: { fontSize: 12, color: "#666" },
  link: { color: "#185fa5" },
  error: { color: "#a12a22" },
});
