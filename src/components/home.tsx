import { Link, router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { loadCycles, loadSummary, type Cycle } from "@/lib/cycles";
import { day } from "@/lib/format";
import { syncTransactions } from "@/lib/monzo";

/** Signed-in home: syncs with Monzo, then lists pay cycles newest first. */
export function Home() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [attention, setAttention] = useState(false);
  const [busy, setBusy] = useState("Syncing with Monzo…");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      await syncTransactions((n) => setBusy(`Syncing with Monzo… ${n} transactions`));
      const all = await loadCycles();
      setCycles(all);
      // The newest cycle needs attention when money is unassigned or transactions are unfiled: the book that will glow.
      const newest = all[0] ? await loadSummary(all[0].id) : null;
      setAttention(Boolean(newest && (newest.left_to_assign !== 0 || newest.unfiled > 0)));
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy("");
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading data on mount; state is set after the request
    load();
  }, [load]);

  const refresh = () => {
    setError("");
    setBusy("Syncing with Monzo…");
    load();
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.page}>
      <Text style={styles.status}>{busy || error || "Up to date with Monzo"}</Text>
      <View style={styles.bar}>
        <Pressable onPress={refresh} disabled={Boolean(busy)}>
          <Text style={styles.link}>Refresh</Text>
        </Pressable>
        <Link href="/envelopes" style={styles.link}>
          Envelopes
        </Link>
        <Link href="/transactions" style={styles.link}>
          All transactions
        </Link>
      </View>

      <Text style={styles.heading}>Pay cycles</Text>
      {!busy && cycles.length === 0 ? <Text style={styles.meta}>No salary payment found yet.</Text> : null}
      {cycles.map((c, i) => (
        <Pressable key={c.id} style={styles.row} onPress={() => router.push({ pathname: "/cycle/[id]", params: { id: c.id } })}>
          <View style={styles.grow}>
            <Text style={styles.name}>{c.name}</Text>
            <Text style={styles.meta}>
              {day(c.starts_at)} to {c.ends_at ? day(c.ends_at) : "next payday"}
            </Text>
          </View>
          {i === 0 ? <Text style={attention ? styles.attention : styles.current}>{attention ? "needs attention" : "current"}</Text> : null}
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { alignSelf: "stretch" },
  page: { gap: 8, maxWidth: 520, width: "100%", marginHorizontal: "auto" },
  status: { textAlign: "center" },
  bar: { flexDirection: "row", justifyContent: "center", gap: 24 },
  link: { color: "#185fa5" },
  heading: { fontSize: 18, fontWeight: "600", marginTop: 16 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#bbb" },
  grow: { flex: 1 },
  name: { fontWeight: "600" },
  meta: { fontSize: 12, color: "#666" },
  current: { color: "#2f5d32", fontSize: 12 },
  attention: { color: "#a15c00", fontSize: 12, fontWeight: "600" },
});
