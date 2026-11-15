import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { day, gbp } from "@/lib/format";
import { syncTransactions } from "@/lib/monzo";
import { supabase } from "@/lib/supabase";

type Row = {
  id: string;
  created: string;
  amount: number;
  description: string | null;
  merchant_name: string | null;
  declined: boolean;
  status: string;
  envelopes: { name: string } | null;
};

const FILED: Record<string, string> = { neutral: "not counted", income: "income", unassigned: "needs an envelope" };

/** Syncs from Monzo on first show, then lists the most recent transactions. */
export function Transactions() {
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState("Syncing with Monzo…");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      await syncTransactions((n) => setBusy(`Syncing with Monzo… ${n} transactions`));
      const [list, count, oldest, accounts] = await Promise.all([
        supabase.from("transactions").select("id,created,amount,description,merchant_name,declined,status,envelopes(name)")
          .order("created", { ascending: false }).limit(50).overrideTypes<Row[]>(),
        supabase.from("transactions").select("id", { count: "exact", head: true }),
        supabase.from("transactions").select("created").order("created").limit(1),
        supabase.from("accounts").select("full_history"),
      ]);
      setRows(list.data ?? []);
      const since = oldest.data?.[0] ? ` since ${day(oldest.data[0].created)}` : "";
      const partial = accounts.data?.some((a) => !a.full_history) ? " (last 90 days only)" : "";
      setSummary(`${count.count ?? 0} transactions stored${since}${partial}`);
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
    <View style={styles.wrap}>
      <Text style={styles.summary}>{busy || error || summary}</Text>
      <Pressable onPress={refresh} disabled={Boolean(busy)}>
        <Text style={styles.link}>Refresh</Text>
      </Pressable>
      <FlatList
        style={styles.list}
        data={rows}
        keyExtractor={(r) => r.id}
        renderItem={({ item: r }) => (
          <View style={styles.row}>
            <View style={styles.grow}>
              <Text style={r.declined ? styles.struck : undefined}>{r.merchant_name ?? r.description}</Text>
              <Text style={styles.meta}>
                {day(r.created)} ·{" "}
                <Text style={r.status === "unassigned" ? styles.warn : undefined}>
                  {r.declined ? "declined" : (r.envelopes?.name ?? FILED[r.status])}
                </Text>
              </Text>
            </View>
            <Text style={r.amount > 0 ? styles.credit : undefined}>{gbp(r.amount, true)}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "stretch", flex: 1, alignItems: "center", gap: 8, maxWidth: 520, width: "100%", marginHorizontal: "auto" },
  summary: { textAlign: "center" },
  link: { color: "#185fa5" },
  list: { alignSelf: "stretch" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#bbb" },
  grow: { flex: 1 },
  meta: { fontSize: 12, color: "#666" },
  struck: { textDecorationLine: "line-through", color: "#888" },
  credit: { color: "#2f5d32" },
  warn: { color: "#a15c00" },
});
