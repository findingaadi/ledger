import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { FilePicker, type EnvelopeOption } from "@/components/file-picker";
import { day, gbp } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { paper, serif } from "@/lib/theme";

type Row = {
  id: string;
  created: string;
  amount: number;
  description: string | null;
  merchant_name: string | null;
  /** The other person or company on a bank transfer. */
  counterparty: string | null;
  scheme: string | null;
  payee: string | null;
  declined: boolean;
  status: string;
  envelopes: { name: string } | null;
};

type Props = {
  envelopeId?: string;
  status?: "unassigned" | "income";
  from?: string;
  to?: string | null;
  /** Change this to make the list reload. */
  reloadKey?: number;
  /** Called after a transaction is filed, so the parent can refresh its own numbers. */
  onChanged?: () => void;
  empty?: string;
};

const FILED: Record<string, string> = { neutral: "not counted", income: "income", unassigned: "needs an envelope" };
const CARD = new Set(["mastercard", "3dsecure"]);
/** Who the money went to or came from: the merchant, or the person on a bank transfer. */
const label = (r: Row) => r.merchant_name ?? r.counterparty ?? r.description ?? "Unknown";
/**
 * The payment reference on a bank transfer, when it says something the name doesn't.
 * Card payments are skipped: their description is the raw card-terminal text.
 */
const reference = (r: Row) =>
  r.description && !CARD.has(r.scheme ?? "") && r.description.trim().toLowerCase() !== label(r).trim().toLowerCase() ? r.description.trim() : null;

/** Up to 50 transactions matching the filters, newest first. Tap one to file it. */
export function TransactionList({ envelopeId, status, from, to, reloadKey, onChanged, empty = "Nothing here." }: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [envelopes, setEnvelopes] = useState<EnvelopeOption[]>([]);
  const [askPayees, setAskPayees] = useState<Set<string>>(new Set());
  const [picking, setPicking] = useState<Row | null>(null);

  const load = useCallback(async () => {
    let list = supabase.from("transactions")
      .select("id,created,amount,description,merchant_name,counterparty:raw->counterparty->>name,scheme,payee,declined,status,envelopes(name)")
      .order("created", { ascending: false }).limit(50);
    if (envelopeId) list = list.eq("envelope_id", envelopeId);
    if (status) list = list.eq("status", status);
    if (from) list = list.gte("created", from);
    if (to) list = list.lt("created", to);
    const [txs, env, ask] = await Promise.all([
      list.overrideTypes<Row[]>(),
      supabase.from("envelopes").select("id,name").order("sort").order("name"),
      supabase.from("rules").select("value").eq("kind", "payee").eq("treatment", "ask"),
    ]);
    setRows(txs.data ?? []);
    setEnvelopes(env.data ?? []);
    setAskPayees(new Set((ask.data ?? []).map((r) => r.value)));
  }, [envelopeId, status, from, to]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading data; state is set after the request
    load();
  }, [load, reloadKey]);

  return (
    <View style={styles.list}>
      {rows?.length === 0 ? <Text style={styles.empty}>{empty}</Text> : null}
      {rows?.map((r) => (
        <Pressable key={r.id} style={styles.row} onPress={() => setPicking(r)} disabled={r.declined}>
          <View style={styles.grow}>
            <Text style={[styles.name, r.declined && styles.struck]}>{label(r)}</Text>
            {reference(r) ? (
              <Text style={styles.reference} numberOfLines={1}>
                Ref: {reference(r)}
              </Text>
            ) : null}
            <Text style={styles.meta}>
              {day(r.created)} ·{" "}
              <Text style={r.status === "unassigned" ? styles.warn : undefined}>
                {r.declined ? "declined" : (r.envelopes?.name ?? FILED[r.status])}
              </Text>
            </Text>
          </View>
          <Text style={[styles.amount, r.amount > 0 && styles.credit]}>{gbp(r.amount, true)}</Text>
        </Pressable>
      ))}
      {picking ? (
        <FilePicker
          tx={{ id: picking.id, label: label(picking), reference: reference(picking), amount: picking.amount }}
          envelopes={envelopes}
          canRemember={picking.amount < 0 && Boolean(picking.payee) && !askPayees.has(picking.payee ?? "")}
          onClose={(changed) => {
            setPicking(null);
            if (changed) {
              load();
              onChanged?.();
            }
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { alignSelf: "stretch" },
  empty: { fontFamily: serif, fontStyle: "italic", color: paper.faint, paddingVertical: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 38, paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: paper.rule },
  grow: { flex: 1 },
  name: { fontFamily: serif, fontSize: 15, color: paper.text },
  reference: { fontFamily: serif, fontSize: 12, color: paper.text, opacity: 0.75 },
  meta: { fontFamily: serif, fontSize: 11.5, fontStyle: "italic", color: paper.faint },
  amount: { fontFamily: serif, fontSize: 15, color: paper.ink },
  struck: { textDecorationLine: "line-through", color: paper.faint },
  credit: { color: paper.green },
  warn: { color: paper.red },
});
