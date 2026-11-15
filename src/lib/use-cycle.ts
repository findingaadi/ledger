import { useCallback, useEffect, useState } from "react";

import { loadCycles, loadSummary, type Cycle, type CycleSummary } from "./cycles";
import { gbp } from "./format";
import { supabase } from "./supabase";

export type CycleEnvelope = { id: string; name: string; kind: string; default_amount: number };
export type ManualIncome = { id: string; label: string; amount: number };

/** Everything the book's pages need for one pay cycle, plus the actions they can take. */
export type CycleState = {
  cycle: Cycle;
  summary: CycleSummary;
  envelopes: CycleEnvelope[];
  /** What is typed against each envelope, in pounds, before saving. */
  amounts: Record<string, string>;
  /** Which envelopes are in this cycle. Left-out envelopes get nothing. */
  included: Record<string, boolean>;
  saved: boolean;
  manual: ManualIncome[];
  /** Money available to assign, less what is typed in. */
  left: number;
  message: string;
  /** Bumped whenever a transaction is filed, so lists reload. */
  reloadKey: number;
  setAmount: (envelopeId: string, pounds: string) => void;
  toggleIncluded: (envelopeId: string) => void;
  sendRest: () => void;
  save: () => Promise<void>;
  /** Clears this cycle's budget: every envelope back to £0 and all of the money unassigned. */
  reset: () => Promise<void>;
  addSide: (label: string, pounds: string) => Promise<boolean>;
  removeSide: (entry: ManualIncome) => Promise<void>;
  changed: () => void;
};

export const toPence = (pounds: string) => Math.round(Number(pounds.trim() || "0") * 100);
const toPounds = (pence: number) => String(pence / 100);

export function useCycle(id: string): CycleState | null {
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [summary, setSummary] = useState<CycleSummary | null>(null);
  const [envelopes, setEnvelopes] = useState<CycleEnvelope[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [included, setIncluded] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const [manual, setManual] = useState<ManualIncome[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [message, setMessage] = useState("");

  // The numbers change when a transaction is filed, so they reload on their own without touching typed amounts.
  const loadNumbers = useCallback(async (c: Cycle) => {
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
      type Saved = { envelope_id: string; amount: number; included: boolean };
      const [env, mine, last] = await Promise.all([
        supabase.from("envelopes").select("id,name,kind,default_amount").order("sort").order("name"),
        supabase.from("allocations").select("envelope_id,amount,included").eq("cycle_id", c.id),
        previous
          ? supabase.from("allocations").select("envelope_id,amount,included").eq("cycle_id", previous.id)
          : Promise.resolve({ data: [] as Saved[] }),
      ]);
      const byEnvelope = (rows: Saved[] | null) => new Map((rows ?? []).map((r) => [r.envelope_id, r]));
      const own = byEnvelope(mine.data);
      const before = byEnvelope(last.data);
      const hasOwn = own.size > 0;
      // A saved cycle shows what was saved. A new one starts from each envelope's default
      // amount (the last amount saved for it) and last cycle's choice of envelopes.
      setIncluded(Object.fromEntries((env.data ?? []).map((e) =>
        [e.id, hasOwn ? (own.get(e.id)?.included ?? true) : (before.get(e.id)?.included ?? true)])));
      setAmounts(Object.fromEntries((env.data ?? []).map((e) => {
        const saved = own.get(e.id);
        return [e.id, toPounds(hasOwn ? (saved?.included === false ? e.default_amount : (saved?.amount ?? 0)) : e.default_amount)];
      })));
      setEnvelopes(env.data ?? []);
      setSaved(hasOwn);
      setCycle(c);
      loadNumbers(c);
    })();
  }, [id, loadNumbers]);

  if (!cycle || !summary) return null;

  const allocated = envelopes.reduce((sum, e) => sum + (included[e.id] === false ? 0 : toPence(amounts[e.id] ?? "") || 0), 0);
  const left = summary.income - summary.carried_in - allocated;

  return {
    cycle, summary, envelopes, amounts, included, saved, manual, left, message, reloadKey,
    setAmount: (envelopeId, pounds) => {
      setAmounts({ ...amounts, [envelopeId]: pounds });
      setMessage("");
    },
    toggleIncluded: (envelopeId) => {
      setIncluded({ ...included, [envelopeId]: included[envelopeId] === false });
      setMessage("");
    },
    sendRest: () => {
      const guiltFree = envelopes.find((e) => e.kind === "guilt_free");
      if (!guiltFree || left <= 0) return;
      const current = included[guiltFree.id] === false ? 0 : toPence(amounts[guiltFree.id] ?? "");
      setIncluded({ ...included, [guiltFree.id]: true });
      setAmounts({ ...amounts, [guiltFree.id]: toPounds(current + left) });
      setMessage("");
    },
    save: async () => {
      const rows = envelopes.map((e) => ({ envelope_id: e.id, amount: toPence(amounts[e.id] ?? ""), included: included[e.id] !== false }));
      if (rows.some((r) => r.included && (!Number.isFinite(r.amount) || r.amount < 0))) return setMessage("Amounts must be numbers like 150 or 23.50.");
      if (left > 0) return setMessage(`Assign the remaining ${gbp(left)} first.`);
      if (left < 0) return setMessage(`You've assigned ${gbp(-left)} more than came in.`);
      // Left-out envelopes keep their typed amount so it isn't lost, but save as zero.
      const { error } = await supabase.rpc("save_allocations", { p_cycle: cycle.id, p_rows: rows.map((r) => ({ ...r, amount: Number.isFinite(r.amount) ? r.amount : 0 })) });
      if (error) return setMessage("Couldn't save. Try again.");
      setSaved(true);
      setMessage("Saved. These amounts are now the defaults for next payday.");
      loadNumbers(cycle);
    },
    reset: async () => {
      const { error } = await supabase.from("allocations").delete().eq("cycle_id", cycle.id);
      if (error) return setMessage("Couldn't reset. Try again.");
      setAmounts(Object.fromEntries(envelopes.map((e) => [e.id, "0"])));
      setIncluded(Object.fromEntries(envelopes.map((e) => [e.id, true])));
      setSaved(false);
      setMessage("Reset. All of this month's money is unassigned again.");
      loadNumbers(cycle);
    },
    addSide: async (label, pounds) => {
      const amount = toPence(pounds);
      if (!label.trim() || !Number.isFinite(amount) || amount === 0) {
        setMessage("Enter what it was and an amount.");
        return false;
      }
      const { error } = await supabase.from("manual_income").insert({ cycle_id: cycle.id, label: label.trim(), amount });
      if (error) {
        setMessage("Couldn't save. Try again.");
        return false;
      }
      setMessage("");
      loadNumbers(cycle);
      return true;
    },
    removeSide: async (entry) => {
      await supabase.from("manual_income").delete().eq("id", entry.id);
      loadNumbers(cycle);
    },
    changed: () => {
      setReloadKey((k) => k + 1);
      loadNumbers(cycle);
    },
  };
}
