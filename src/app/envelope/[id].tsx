import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { TransactionList } from "@/components/transaction-list";
import { gbp } from "@/lib/format";
import { supabase } from "@/lib/supabase";

type Elsewhere = { id: string; label: string; amount: number };

/**
 * One envelope's transactions. Tap any of them to move it somewhere else.
 * Opened from a pay cycle (cycle/from/to set), it shows only that cycle and
 * lets you record payments made outside Monzo.
 */
export default function EnvelopeDetail() {
  const { id, cycle, from, to } = useLocalSearchParams<{ id: string; cycle?: string; from?: string; to?: string }>();
  const [name, setName] = useState("Envelope");
  const [elsewhere, setElsewhere] = useState<Elsewhere[]>([]);
  const [draft, setDraft] = useState<{ label: string; amount: string } | null>(null);
  const [error, setError] = useState("");

  const loadElsewhere = useCallback(async () => {
    if (!cycle) return;
    const { data } = await supabase.from("manual_spend").select("id,label,amount").eq("cycle_id", cycle).eq("envelope_id", id);
    setElsewhere(data ?? []);
  }, [cycle, id]);

  useEffect(() => {
    supabase.from("envelopes").select("name").eq("id", id).maybeSingle().then(({ data }) => data && setName(data.name));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading data; state is set after the request
    loadElsewhere();
  }, [id, loadElsewhere]);

  const add = async () => {
    if (!draft || !cycle) return;
    const amount = Math.round(Number(draft.amount.trim() || "0") * 100);
    if (!draft.label.trim() || !Number.isFinite(amount) || amount <= 0) return setError("Enter what it was and an amount.");
    const { error: e } = await supabase.from("manual_spend").insert({ cycle_id: cycle, envelope_id: id, label: draft.label.trim(), amount });
    if (e) return setError("Couldn't save. Try again.");
    setDraft(null);
    setError("");
    loadElsewhere();
  };
  const remove = async (row: Elsewhere) => {
    await supabase.from("manual_spend").delete().eq("id", row.id);
    loadElsewhere();
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: name }} />
      <Text style={styles.note}>
        {from ? "This pay cycle only. " : "Most recent first. "}Tap a transaction to move it to a different envelope.
      </Text>

      {elsewhere.map((row) => (
        <View key={row.id} style={styles.row}>
          <Text style={styles.grow}>{row.label} (paid elsewhere)</Text>
          <Text>{gbp(-row.amount, true)}</Text>
          <Pressable onPress={() => remove(row)}>
            <Text style={styles.remove}>Remove</Text>
          </Pressable>
        </View>
      ))}
      {cycle && draft ? (
        <View style={styles.form}>
          <TextInput style={styles.input} placeholder="Sent from my other bank" value={draft.label} onChangeText={(label) => setDraft({ ...draft, label })} />
          <TextInput style={styles.input} placeholder="Amount in pounds" keyboardType="decimal-pad" value={draft.amount} onChangeText={(amount) => setDraft({ ...draft, amount })} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Pressable style={styles.button} onPress={add}>
              <Text style={styles.buttonText}>Add</Text>
            </Pressable>
            <Pressable onPress={() => setDraft(null)}>
              <Text style={styles.link}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : cycle ? (
        <Pressable onPress={() => setDraft({ label: "", amount: "" })}>
          <Text style={styles.link}>Add a payment made elsewhere</Text>
        </Pressable>
      ) : null}

      <TransactionList envelopeId={id} from={from || undefined} to={to || undefined} empty="No Monzo transactions filed here." />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 24, gap: 8, maxWidth: 520, width: "100%", marginHorizontal: "auto" },
  note: { color: "#666" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#bbb" },
  grow: { flex: 1 },
  remove: { color: "#a12a22", fontSize: 12 },
  form: { gap: 8 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderColor: "#999", borderRadius: 6, padding: 10, backgroundColor: "#fff" },
  actions: { flexDirection: "row", alignItems: "center", gap: 16 },
  button: { backgroundColor: "#14233c", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  buttonText: { color: "#fff", fontWeight: "600" },
  link: { color: "#185fa5" },
  error: { color: "#a12a22" },
});
