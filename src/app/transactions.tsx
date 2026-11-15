import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View } from "react-native";

import { DayHeader, groupByDay, ROW_FIELDS, TransactionRow, useFiling, type Day, type Row } from "@/components/transaction-list";
import { supabase } from "@/lib/supabase";
import { paper, serif } from "@/lib/theme";

const DAY = 86_400_000;

/** Every payment in the last six months, newest first, a heading for each day. */
export default function AllTransactions() {
  const [days, setDays] = useState<Day[] | null>(null);
  const [onlyUnfiled, setOnlyUnfiled] = useState(false);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 183 * DAY).toISOString();
    let q = supabase.from("transactions").select(ROW_FIELDS).gte("created", since).order("created", { ascending: false }).range(0, 4999);
    if (onlyUnfiled) q = q.eq("status", "unassigned");
    const { data } = await q.overrideTypes<Row[]>();
    setDays(groupByDay(data ?? []));
  }, [onlyUnfiled]);

  const { open, picker } = useFiling(load);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading data; state is set after the request
    load();
  }, [load]);

  return (
    <View style={styles.page}>
      <SectionList
        sections={days ?? []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.content}
        stickySectionHeadersEnabled
        initialNumToRender={30}
        ListHeaderComponent={
          <View style={styles.top}>
            <Text style={styles.note}>The last six months, newest first. Tap a payment to file it in an envelope.</Text>
            <Pressable onPress={() => setOnlyUnfiled(!onlyUnfiled)}>
              <Text style={styles.link}>{onlyUnfiled ? "Show everything" : "Show only those needing an envelope"}</Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={days ? <Text style={styles.note}>Nothing here.</Text> : <ActivityIndicator color={paper.faint} />}
        renderSectionHeader={({ section }) => (
          <View style={styles.sticky}>
            <DayHeader title={section.title} total={section.total} />
          </View>
        )}
        renderItem={({ item }) => <TransactionRow r={item} onPress={open} showDate={false} />}
      />
      {picker}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: paper.bg },
  content: { paddingHorizontal: 20, paddingBottom: 40, maxWidth: 560, width: "100%", alignSelf: "center" },
  top: { paddingTop: 14, gap: 4 },
  note: { fontFamily: serif, fontStyle: "italic", color: paper.faint },
  link: { fontFamily: serif, color: paper.ink, textDecorationLine: "underline", paddingVertical: 6 },
  sticky: { backgroundColor: paper.bg },
});
