import { supabase } from "./supabase";

export type Cycle = { id: string; starts_at: string; ends_at: string | null; name: string };

const DAY = 86_400_000;

/** A cycle is named after the month most of it falls in: salary on 23 Oct is the November book. */
const cycleName = (startsAt: string) =>
  new Date(new Date(startsAt).getTime() + 15 * DAY).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

/** Every pay cycle, newest first. A cycle ends when the next one starts; the newest has no end yet. */
export async function loadCycles(): Promise<Cycle[]> {
  const { data } = await supabase.from("pay_cycles").select("id,starts_at").order("starts_at", { ascending: false });
  return (data ?? []).map((c, i, all) => ({
    id: c.id,
    starts_at: c.starts_at,
    ends_at: i > 0 ? all[i - 1].starts_at : null,
    name: cycleName(c.starts_at),
  }));
}
