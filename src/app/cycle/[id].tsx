import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { TransactionList } from "@/components/transaction-list";
import { loadCycles, loadSummary, type Cycle, type CycleSummary } from "@/lib/cycles";
import { day, gbp } from "@/lib/format";
import { supabase } from "@/lib/supabase";

type Envelope = { id: string; name: string; kind: string; default_amount: number };
type ManualIncome = { id: string; label: string; amount: number };

const toPence = (pounds: string) => Math.round(Number(pounds.trim() || "0") * 100);
const toPounds = (pence: number) => String(pence / 100);

/** A pay cycle's to-do page: assign the money that came in, and file what still needs an envelope. */
export default function CyclePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [summary, setSummary] = useState<CycleSummary | null>(null);
  const [manual, setManual] = useState<ManualIncome[]>([]);
  const [side, setSide] = useState<{ label: string; amount: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [message, setMessage] = useState("");

  // The numbers change when a transaction is filed, so they reload on their own without touching typed amounts.
  const loadIncome = useCallback(async (c: Cycle) => {
    const [sum, m] = await Promise.all([loadSummary(c.id), supabase.from("manual_income").select("id,label,amount").eq("cycle_id", c.id)]);
    setSummary(sum);
    setManual(m.data ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      const cycles = await loadCycles();
      const index = cycles.findIndex((c) => c.id === id);
      if (index < 0) return;
      const c = cycles[index];
      const previous = cycles[index + 1];
      const [env, mine, last] = await Promise.all([
        supabase.from("envelopes").select("id,name,kind,default_amount").order("sort").order("name"),
        supabase.from("allocations").select("envelope_id,amount").eq("cycle_id", c.id),
        previous
          ? supabase.from("allocations").select("envelope_id,amount").eq("cycle_id", previous.id)
          : Promise.resolve({ data: [] as { envelope_id: string; amount: number }[] }),
      ]);
      const byEnvelope = (rows: { envelope_id: string; amount: number }[] | null) =>
        Object.fromEntries((rows ?? []).map((r) => [r.envelope_id, r.amount]));
      const own = byEnvelope(mine.data);
      const before = byEnvelope(last.data);
      const hasOwn = (mine.data ?? []).length > 0;
      // Saved amounts win; otherwise start from last cycle's, then the envelope's default.
      setAmounts(Object.fromEntries((env.data ?? []).map((e) =>
        [e.id, toPounds(hasOwn ? (own[e.id] ?? 0) : (before[e.id] ?? e.default_amount))])));
      setEnvelopes(env.data ?? []);
      setSaved(hasOwn);
      setCycle(c);
      loadIncome(c);
    })();
  }, [id, loadIncome]);

  if (!cycle || !summary) return <Text style={styles.loading}>Loading…</Text>;

  const income = summary.income;
  const carried = summary.carried_in;
  const allocated = envelopes.reduce((sum, e) => sum + (toPence(amounts[e.id] ?? "") || 0), 0);
  const left = income - carried - allocated;
  const guiltFree = summary.guilt_free_left;
  const changed = () => {
    setReloadKey((k) => k + 1);
    loadIncome(cycle);
  };

  const sendRest = () => {
    const guiltFree = envelopes.find((e) => e.kind === "guilt_free");
    if (!guiltFree || left <= 0) return;
    setAmounts({ ...amounts, [guiltFree.id]: toPounds(toPence(amounts[guiltFree.id] ?? "") + left) });
    setMessage("");
  };

  const save = async () => {
    const rows = envelopes.map((e) => ({ cycle_id: cycle.id, envelope_id: e.id, amount: toPence(amounts[e.id] ?? "") }));
    if (rows.some((r) => !Number.isFinite(r.amount) || r.amount < 0)) return setMessage("Amounts must be numbers like 150 or 23.50.");
    if (left > 0) return setMessage(`Assign the remaining ${gbp(left)} first.`);
    if (left < 0) return setMessage(`You've assigned ${gbp(-left)} more than came in.`);
    const { error } = await supabase.from("allocations").upsert(rows, { onConflict: "cycle_id,envelope_id" });
    if (error) return setMessage("Couldn't save. Try again.");
    setSaved(true);
    setMessage("Saved. Every pound is assigned.");
    loadIncome(cycle);
  };

  const addSide = async () => {
    if (!side) return;
    const amount = toPence(side.amount);
    if (!side.label.trim() || !Number.isFinite(amount) || amount === 0) return setMessage("Enter what it was and an amount.");
    const { error } = await supabase.from("manual_income").insert({ cycle_id: cycle.id, label: side.label.trim(), amount });
    if (error) return setMessage("Couldn't save. Try again.");
    setSide(null);
    setMessage("");
    loadIncome(cycle);
  };
  const removeSide = async (m: ManualIncome) => {
    await supabase.from("manual_income").delete().eq("id", m.id);
    loadIncome(cycle);
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: cycle.name }} />
      <Text style={styles.meta}>
        {day(cycle.starts_at)} to {cycle.ends_at ? day(cycle.ends_at) : "next payday"}
      </Text>

      {summary.assigned && guiltFree !== null ? (
        <>
          <View style={[styles.banner, guiltFree >= 0 ? styles.ok : styles.over]}>
            <Text>{summary.closed ? "Guilt-free at the end" : "Guilt-free left"}</Text>
            <Text style={styles.big}>{gbp(guiltFree)}</Text>
            <Text style={styles.meta}>
              {summary.closed ? "includes money left unspent in flexible envelopes" : "after overspending in other envelopes"}
            </Text>
          </View>
          {summary.envelopes.filter((e) => e.kind !== "guilt_free").map((e) => {
            const remaining = e.allocated - e.spent;
            return (
              <Pressable
                key={e.id}
                style={styles.row}
                onPress={() =>
                  router.push({ pathname: "/envelope/[id]", params: { id: e.id, from: cycle.starts_at, to: cycle.ends_at ?? "" } })
                }
              >
                <View style={styles.grow}>
                  <Text>{e.name}</Text>
                  <Text style={styles.meta}>
                    {gbp(e.spent)} spent of {gbp(e.allocated)}
                  </Text>
                </View>
                <Text style={remaining < 0 ? styles.error : undefined}>
                  {remaining < 0 ? `${gbp(-remaining)} over` : `${gbp(remaining)} left`}
                </Text>
              </Pressable>
            );
          })}
        </>
      ) : (
        <Text style={styles.meta}>Assign this cycle&apos;s money below to see what is left in each envelope.</Text>
      )}

      <Text style={styles.heading}>Money in</Text>
      <TransactionList status="income" from={cycle.starts_at} to={cycle.ends_at} reloadKey={reloadKey} onChanged={changed} empty="No income found in this cycle." />
      {manual.map((m) => (
        <View key={m.id} style={styles.row}>
          <Text style={styles.grow}>{m.label} (entered by you)</Text>
          <Text style={styles.credit}>{gbp(m.amount, true)}</Text>
          <Pressable onPress={() => removeSide(m)}>
            <Text style={styles.remove}>Remove</Text>
          </Pressable>
        </View>
      ))}
      {carried > 0 ? (
        <View style={styles.row}>
          <Text style={styles.grow}>Shortfall carried from last cycle</Text>
          <Text style={styles.error}>{gbp(-carried, true)}</Text>
        </View>
      ) : null}
      {side ? (
        <View style={styles.form}>
          <TextInput style={styles.input} placeholder="Weekend shift" value={side.label} onChangeText={(label) => setSide({ ...side, label })} />
          <TextInput style={styles.input} placeholder="Amount in pounds" keyboardType="decimal-pad" value={side.amount} onChangeText={(amount) => setSide({ ...side, amount })} />
          <View style={styles.actions}>
            <Pressable style={styles.button} onPress={addSide}>
              <Text style={styles.buttonText}>Add</Text>
            </Pressable>
            <Pressable onPress={() => setSide(null)}>
              <Text style={styles.link}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={() => setSide({ label: "", amount: "" })}>
          <Text style={styles.link}>Add side income</Text>
        </Pressable>
      )}

      <View style={[styles.banner, left === 0 ? styles.ok : left > 0 ? styles.todo : styles.over]}>
        <Text>{left < 0 ? "Over-assigned" : "Left to assign"}</Text>
        <Text style={styles.big}>{gbp(Math.abs(left))}</Text>
        <Text style={styles.meta}>of {gbp(income - carried)} available</Text>
      </View>
      {!saved ? <Text style={styles.meta}>Not saved yet. Amounts are filled in from your last cycle or each envelope&apos;s default.</Text> : null}

      {envelopes.map((e) => (
        <View key={e.id} style={styles.row}>
          <Text style={styles.grow}>{e.name}</Text>
          <TextInput
            style={styles.amount}
            keyboardType="decimal-pad"
            value={amounts[e.id] ?? ""}
            onChangeText={(v) => {
              setAmounts({ ...amounts, [e.id]: v });
              setMessage("");
            }}
          />
        </View>
      ))}
      <View style={styles.actions}>
        <Pressable style={styles.button} onPress={save}>
          <Text style={styles.buttonText}>Save</Text>
        </Pressable>
        <Pressable onPress={sendRest}>
          <Text style={styles.link}>Send the rest to guilt-free</Text>
        </Pressable>
      </View>
      {message ? <Text style={message.startsWith("Saved") ? styles.credit : styles.error}>{message}</Text> : null}

      <Text style={styles.heading}>Needs an envelope</Text>
      <TransactionList status="unassigned" from={cycle.starts_at} to={cycle.ends_at} reloadKey={reloadKey} onChanged={changed} empty="Everything in this cycle is filed." />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 24, gap: 8, maxWidth: 520, width: "100%", marginHorizontal: "auto" },
  loading: { padding: 24, textAlign: "center" },
  heading: { fontSize: 18, fontWeight: "600", marginTop: 16 },
  meta: { fontSize: 12, color: "#666" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#bbb" },
  grow: { flex: 1 },
  credit: { color: "#2f5d32" },
  remove: { color: "#a12a22", fontSize: 12 },
  form: { gap: 8 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderColor: "#999", borderRadius: 6, padding: 10, backgroundColor: "#fff" },
  amount: { width: 96, textAlign: "right", borderWidth: StyleSheet.hairlineWidth, borderColor: "#999", borderRadius: 6, padding: 6, backgroundColor: "#fff" },
  actions: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 4 },
  button: { backgroundColor: "#14233c", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  buttonText: { color: "#fff", fontWeight: "600" },
  link: { color: "#185fa5" },
  banner: { alignItems: "center", padding: 12, borderRadius: 8, marginTop: 12 },
  ok: { backgroundColor: "#e3efe0" },
  todo: { backgroundColor: "#fbeed5" },
  over: { backgroundColor: "#f8dedb" },
  big: { fontSize: 28, fontWeight: "600" },
  error: { color: "#a12a22" },
});
