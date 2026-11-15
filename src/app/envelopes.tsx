import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { gbp } from "@/lib/format";
import { supabase } from "@/lib/supabase";

type Kind = "bill" | "flexible" | "variable" | "guilt_free";
type Envelope = { id: string; name: string; kind: Kind; default_amount: number; sort: number };
type Draft = { id?: string; name: string; kind: Kind; amount: string };

const KINDS: { kind: Kind; label: string }[] = [
  { kind: "bill", label: "Regular bill" },
  { kind: "flexible", label: "Flexible" },
  { kind: "variable", label: "Variable" },
  { kind: "guilt_free", label: "Guilt-free" },
];
const kindLabel = (k: Kind) => KINDS.find((x) => x.kind === k)!.label;
const DAY = 86_400_000;

/** Lists envelopes with what was spent from each in the last 30 days, and lets you add, edit or delete them. */
export default function Envelopes() {
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [spent, setSpent] = useState<Record<string, number>>({});
  const [unfiled, setUnfiled] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 30 * DAY).toISOString();
    const [env, tx, un] = await Promise.all([
      supabase.from("envelopes").select("id,name,kind,default_amount,sort").order("sort").order("name"),
      supabase.from("transactions").select("envelope_id,amount").eq("status", "envelope").gte("created", since).limit(5000),
      supabase.from("transactions").select("id", { count: "exact", head: true }).eq("status", "unassigned").gte("created", since),
    ]);
    setEnvelopes((env.data as Envelope[]) ?? []);
    const totals: Record<string, number> = {};
    for (const t of tx.data ?? []) if (t.envelope_id) totals[t.envelope_id] = (totals[t.envelope_id] ?? 0) - t.amount;
    setSpent(totals);
    setUnfiled(un.count ?? 0);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading data on mount; state is set after the request
    load();
  }, [load]);

  const save = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    const pence = Math.round(Number(draft.amount || "0") * 100);
    if (!name) return setError("Enter a name");
    if (!Number.isFinite(pence) || pence < 0) return setError("Enter an amount like 150 or 23.50");
    const row = { name, kind: draft.kind, default_amount: pence };
    const { error: e } = draft.id
      ? await supabase.from("envelopes").update(row).eq("id", draft.id)
      : await supabase.from("envelopes").insert({ ...row, sort: 500 });
    if (e) return setError(e.code === "23505" ? "You already have an envelope with that name." : "Couldn't save. Try again.");
    setDraft(null);
    setError("");
    load();
  };

  const remove = async () => {
    if (!draft?.id) return;
    await supabase.from("envelopes").delete().eq("id", draft.id);
    await supabase.rpc("classify_transactions"); // its transactions go back to being sorted by the remaining rules
    setDraft(null);
    load();
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.note}>Spent is the last 30 days. {unfiled ? `${unfiled} transactions need an envelope.` : ""}</Text>

      {envelopes.map((e) => (
        <Pressable
          key={e.id}
          style={styles.row}
          onPress={() => {
            setError("");
            setDraft({ id: e.id, name: e.name, kind: e.kind, amount: String(e.default_amount / 100) });
          }}
        >
          <View style={styles.grow}>
            <Text style={styles.name}>{e.name}</Text>
            <Text style={styles.meta}>
              {kindLabel(e.kind)}
              {e.default_amount ? ` · ${gbp(e.default_amount)} each payday` : ""}
            </Text>
          </View>
          <Text>{gbp(spent[e.id] ?? 0)} spent</Text>
        </Pressable>
      ))}

      {draft ? (
        <View style={styles.form}>
          <Text style={styles.name}>{draft.id ? "Edit envelope" : "New envelope"}</Text>
          <TextInput style={styles.input} placeholder="Council tax" value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} />
          <View style={styles.chips}>
            {KINDS.map((k) => (
              <Pressable key={k.kind} style={[styles.chip, draft.kind === k.kind && styles.chipOn]} onPress={() => setDraft({ ...draft, kind: k.kind })}>
                <Text style={draft.kind === k.kind ? styles.chipOnText : undefined}>{k.label}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.input}
            placeholder="Amount each payday, in pounds"
            keyboardType="decimal-pad"
            value={draft.amount}
            onChangeText={(amount) => setDraft({ ...draft, amount })}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Pressable style={styles.button} onPress={save}>
              <Text style={styles.buttonText}>Save</Text>
            </Pressable>
            <Pressable onPress={() => setDraft(null)}>
              <Text style={styles.link}>Cancel</Text>
            </Pressable>
            {draft.id ? (
              <Pressable onPress={remove}>
                <Text style={styles.error}>Delete envelope</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => {
            setError("");
            setDraft({ name: "", kind: "flexible", amount: "" });
          }}
        >
          <Text style={styles.link}>Add envelope</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 24, gap: 4, maxWidth: 520, width: "100%", marginHorizontal: "auto" },
  note: { color: "#666", marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#bbb" },
  grow: { flex: 1 },
  name: { fontWeight: "600" },
  meta: { fontSize: 12, color: "#666" },
  form: { gap: 10, marginTop: 16, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: "#999", borderRadius: 8 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderColor: "#999", borderRadius: 6, padding: 10, backgroundColor: "#fff" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: "#999" },
  chipOn: { backgroundColor: "#14233c", borderColor: "#14233c" },
  chipOnText: { color: "#fff" },
  actions: { flexDirection: "row", alignItems: "center", gap: 16 },
  button: { backgroundColor: "#14233c", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  buttonText: { color: "#fff", fontWeight: "600" },
  link: { color: "#185fa5", marginTop: 12 },
  error: { color: "#a12a22" },
});
