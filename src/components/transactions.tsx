import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { FilePicker, type EnvelopeOption } from "@/components/file-picker";
import { day, gbp } from "@/lib/format";
import { syncTransactions } from "@/lib/monzo";
import { supabase } from "@/lib/supabase";

type Row = {
  id: string;
  created: string;
  amount: number;
  description: string | null;
  merchant_name: string | null;
  payee: string | null;
  declined: boolean;
  status: string;
  envelopes: { name: string } | null;
};

const FILED: Record<string, string> = { neutral: "not counted", income: "income", unassigned: "needs an envelope" };
const label = (r: Row) => r.merchant_name ?? r.description ?? "Unknown";

/** Syncs from Monzo on first show, then lists recent transactions. Tap one to file it. */
export function Transactions() {
  const [rows, setRows] = useState<Row[]>([]);
  const [envelopes, setEnvelopes] = useState<EnvelopeOption[]>([]);
  const [askPayees, setAskPayees] = useState<Set<string>>(new Set());
  const [unfiled, setUnfiled] = useState(0);
  const [onlyUnfiled, setOnlyUnfiled] = useState(false);
  const [picking, setPicking] = useState<Row | null>(null);
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState("Syncing with Monzo…");
  const [error, setError] = useState("");

  const load = useCallback(async (sync: boolean, unfiledOnly: boolean) => {
    try {
      if (sync) await syncTransactions((n) => setBusy(`Syncing with Monzo… ${n} transactions`));
      let list = supabase.from("transactions")
        .select("id,created,amount,description,merchant_name,payee,declined,status,envelopes(name)")
        .order("created", { ascending: false }).limit(50);
      if (unfiledOnly) list = list.eq("status", "unassigned");
      const [txs, count, pending, oldest, accounts, env, ask] = await Promise.all([
        list.overrideTypes<Row[]>(),
        supabase.from("transactions").select("id", { count: "exact", head: true }),
        supabase.from("transactions").select("id", { count: "exact", head: true }).eq("status", "unassigned"),
        supabase.from("transactions").select("created").order("created").limit(1),
        supabase.from("accounts").select("full_history"),
        supabase.from("envelopes").select("id,name").order("sort").order("name"),
        supabase.from("rules").select("value").eq("kind", "payee").eq("treatment", "ask"),
      ]);
      setRows(txs.data ?? []);
      setUnfiled(pending.count ?? 0);
      setEnvelopes(env.data ?? []);
      setAskPayees(new Set((ask.data ?? []).map((r) => r.value)));
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
    load(true, false);
  }, [load]);

  const refresh = () => {
    setError("");
    setBusy("Syncing with Monzo…");
    load(true, onlyUnfiled);
  };
  const toggleFilter = () => {
    setOnlyUnfiled(!onlyUnfiled);
    load(false, !onlyUnfiled);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.summary}>{busy || error || summary}</Text>
      <View style={styles.bar}>
        <Pressable onPress={refresh} disabled={Boolean(busy)}>
          <Text style={styles.link}>Refresh</Text>
        </Pressable>
        <Pressable onPress={toggleFilter}>
          <Text style={styles.link}>{onlyUnfiled ? "Show all" : `Needs an envelope (${unfiled})`}</Text>
        </Pressable>
      </View>
      <FlatList
        style={styles.list}
        data={rows}
        keyExtractor={(r) => r.id}
        ListEmptyComponent={<Text style={styles.summary}>{busy ? "" : "Nothing here."}</Text>}
        renderItem={({ item: r }) => (
          <Pressable style={styles.row} onPress={() => setPicking(r)} disabled={r.declined}>
            <View style={styles.grow}>
              <Text style={r.declined ? styles.struck : undefined}>{label(r)}</Text>
              <Text style={styles.meta}>
                {day(r.created)} ·{" "}
                <Text style={r.status === "unassigned" ? styles.warn : undefined}>
                  {r.declined ? "declined" : (r.envelopes?.name ?? FILED[r.status])}
                </Text>
              </Text>
            </View>
            <Text style={r.amount > 0 ? styles.credit : undefined}>{gbp(r.amount, true)}</Text>
          </Pressable>
        )}
      />
      {picking ? (
        <FilePicker
          tx={{ id: picking.id, label: label(picking), amount: picking.amount }}
          envelopes={envelopes}
          canRemember={picking.amount < 0 && Boolean(picking.payee) && !askPayees.has(picking.payee ?? "")}
          onClose={(changed) => {
            setPicking(null);
            if (changed) load(false, onlyUnfiled);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "stretch", flex: 1, alignItems: "center", gap: 8, maxWidth: 520, width: "100%", marginHorizontal: "auto" },
  summary: { textAlign: "center" },
  bar: { flexDirection: "row", gap: 24 },
  link: { color: "#185fa5" },
  list: { alignSelf: "stretch" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#bbb" },
  grow: { flex: 1 },
  meta: { fontSize: 12, color: "#666" },
  struck: { textDecorationLine: "line-through", color: "#888" },
  credit: { color: "#2f5d32" },
  warn: { color: "#a15c00" },
});
