import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { FilePicker, type EnvelopeOption } from "@/components/file-picker";
import { day, gbp } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { paper, serif } from "@/lib/theme";

export type Row = {
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

export const ROW_FIELDS = "id,created,amount,description,merchant_name,counterparty:raw->counterparty->>name,scheme,payee,declined,status,envelopes(name)";

const FILED: Record<string, string> = { neutral: "not counted", income: "income", unassigned: "needs an envelope" };
const CARD = new Set(["mastercard", "3dsecure"]);
/** Who the money went to or came from: the merchant, or the person on a bank transfer. */
export const label = (r: Row) => r.merchant_name ?? r.counterparty ?? r.description ?? "Unknown";
/**
 * The payment reference on a bank transfer, when it says something the name doesn't.
 * Card payments are skipped: their description is the raw card-terminal text.
 */
export const reference = (r: Row) =>
  r.description && !CARD.has(r.scheme ?? "") && r.description.trim().toLowerCase() !== label(r).trim().toLowerCase() ? r.description.trim() : null;

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const dayKey = (iso: string) => new Date(iso).toDateString();
const dayTitle = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export type Day = { key: string; title: string; total: number; data: Row[] };

/** Groups rows (already in the order wanted) into days, keeping that order. */
export function groupByDay(rows: Row[]): Day[] {
  const days: Day[] = [];
  for (const r of rows) {
    const key = dayKey(r.created);
    let d = days[days.length - 1];
    if (!d || d.key !== key) {
      d = { key, title: dayTitle(r.created), total: 0, data: [] };
      days.push(d);
    }
    d.data.push(r);
    if (!r.declined) d.total += r.amount;
  }
  return days;
}

/** A date written across the ledger, with the day's net total. */
export function DayHeader({ title, total }: { title: string; total: number }) {
  return (
    <View style={styles.dayHeader}>
      <Text style={styles.dayTitle}>{title}</Text>
      <Text style={[styles.dayTotal, total > 0 && styles.credit]}>{gbp(total, true)}</Text>
    </View>
  );
}

/** One transaction line: who, the reference, when and where it was filed, and the amount. */
export function TransactionRow({ r, onPress, showDate = true }: { r: Row; onPress: (r: Row) => void; showDate?: boolean }) {
  const ref = reference(r);
  return (
    <Pressable style={styles.row} onPress={() => onPress(r)} disabled={r.declined}>
      <View style={styles.grow}>
        <Text style={[styles.name, r.declined && styles.struck]}>{label(r)}</Text>
        {ref ? (
          <Text style={styles.reference} numberOfLines={1}>
            Ref: {ref}
          </Text>
        ) : null}
        <Text style={styles.meta}>
          {showDate ? day(r.created) : time(r.created)} ·{" "}
          <Text style={r.status === "unassigned" ? styles.warn : undefined}>
            {r.declined ? "declined" : (r.envelopes?.name ?? FILED[r.status])}
          </Text>
        </Text>
      </View>
      <Text style={[styles.amount, r.amount > 0 && styles.credit]}>{gbp(r.amount, true)}</Text>
    </Pressable>
  );
}

/** The envelope picker for filing a transaction, plus what it needs to know. */
export function useFiling(onChanged: () => void) {
  const [envelopes, setEnvelopes] = useState<EnvelopeOption[]>([]);
  const [askPayees, setAskPayees] = useState<Set<string>>(new Set());
  const [picking, setPicking] = useState<Row | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("envelopes").select("id,name").order("sort").order("name"),
      supabase.from("rules").select("value").eq("kind", "payee").eq("treatment", "ask"),
    ]).then(([env, ask]) => {
      setEnvelopes(env.data ?? []);
      setAskPayees(new Set((ask.data ?? []).map((r) => r.value)));
    });
  }, []);

  const picker = picking ? (
    <FilePicker
      tx={{ id: picking.id, label: label(picking), reference: reference(picking), amount: picking.amount }}
      envelopes={envelopes}
      canRemember={picking.amount < 0 && Boolean(picking.payee) && !askPayees.has(picking.payee ?? "")}
      onClose={(changed) => {
        setPicking(null);
        if (changed) onChanged();
      }}
    />
  ) : null;
  return { open: setPicking, picker };
}

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
  /** Oldest first, under a heading for each day, with no limit: a whole pay cycle as a ledger. */
  ledger?: boolean;
};

/** Transactions matching the filters, newest first (up to 50), or as a day-by-day ledger. Tap one to file it. */
export function TransactionList({ envelopeId, status, from, to, reloadKey, onChanged, empty = "Nothing here.", ledger }: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);

  const load = useCallback(async () => {
    let list = supabase.from("transactions").select(ROW_FIELDS).order("created", { ascending: Boolean(ledger) });
    list = ledger ? list.range(0, 1999) : list.limit(50);
    if (envelopeId) list = list.eq("envelope_id", envelopeId);
    if (status) list = list.eq("status", status);
    if (from) list = list.gte("created", from);
    if (to) list = list.lt("created", to);
    const { data } = await list.overrideTypes<Row[]>();
    setRows(data ?? []);
  }, [envelopeId, status, from, to, ledger]);

  const { open, picker } = useFiling(() => {
    load();
    onChanged?.();
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading data; state is set after the request
    load();
  }, [load, reloadKey]);

  return (
    <View style={styles.list}>
      {rows?.length === 0 ? <Text style={styles.empty}>{empty}</Text> : null}
      {ledger
        ? groupByDay(rows ?? []).map((d) => (
            <View key={d.key}>
              <DayHeader title={d.title} total={d.total} />
              {d.data.map((r) => (
                <TransactionRow key={r.id} r={r} onPress={open} showDate={false} />
              ))}
            </View>
          ))
        : rows?.map((r) => <TransactionRow key={r.id} r={r} onPress={open} />)}
      {picker}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { alignSelf: "stretch" },
  empty: { fontFamily: serif, fontStyle: "italic", color: paper.faint, paddingVertical: 8 },
  dayHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 14, paddingBottom: 3, borderBottomWidth: 1, borderColor: paper.faint },
  dayTitle: { fontFamily: serif, fontSize: 13, fontWeight: "bold", letterSpacing: 0.5, color: "#4a2c0c" },
  dayTotal: { fontFamily: serif, fontSize: 12, fontStyle: "italic", color: paper.faint },
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
